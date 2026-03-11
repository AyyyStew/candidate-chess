import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";

function createEngineInstance() {
  function makeWorker(multiPV) {
    const worker = new Worker("/stockfish.js");
    worker.postMessage("uci");
    worker.postMessage(`setoption name MultiPV value ${multiPV}`);
    worker.postMessage("isready");
    return worker;
  }

  const analyzeWorker = makeWorker(10);
  const evaluateWorker = makeWorker(1);
  const positionWorker = makeWorker(1);

  let readyCount = 0;
  let readyResolve = null;
  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  function onReady(event) {
    if (typeof event.data !== "string") return;
    if (event.data.trim() === "readyok") {
      readyCount += 1;
      if (readyCount >= 3) readyResolve();
    }
  }

  analyzeWorker.onmessage = onReady;
  evaluateWorker.onmessage = onReady;
  positionWorker.onmessage = onReady;

  function terminate() {
    analyzeWorker.terminate();
    evaluateWorker.terminate();
    positionWorker.terminate();
  }

  function getTopMoves(fen, topMovesCount, goCommand) {
    return new Promise((resolve) => {
      const results = {};
      const depthMatch = goCommand.match(/depth (\d+)/);
      const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;
      const isBlack = fen.includes(" b ");

      analyzeWorker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line.startsWith("info") && line.includes("multipv")) {
          const pvMatch = line.match(/multipv (\d+).*pv (\S+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const infoDepth = line.match(/depth (\d+)/);
          const depthOk = targetDepth
            ? parseInt(infoDepth?.[1]) === targetDepth
            : true;
          if (pvMatch && scoreMatch && depthOk) {
            const uciMove = pvMatch[2];
            const tempGame = new Chess(fen);
            let san = uciMove;
            try {
              const m = tempGame.move({
                from: uciMove.slice(0, 2),
                to: uciMove.slice(2, 4),
                promotion: "q",
              });
              san = m.san;
            } catch {}
            const rawScore = parseInt(scoreMatch[1]) / 100;
            results[pvMatch[1]] = {
              move: uciMove,
              san,
              rawEval: isBlack ? -rawScore : rawScore,
            };
          }
        }
        if (line.startsWith("bestmove")) {
          resolve(Object.values(results).slice(0, topMovesCount));
        }
      };

      analyzeWorker.postMessage("stop");
      analyzeWorker.postMessage(
        `setoption name MultiPV value ${topMovesCount}`,
      );
      analyzeWorker.postMessage(`position fen ${fen}`);
      analyzeWorker.postMessage(goCommand);
    });
  }

  function getPositionEval(fen, goCommand) {
    return new Promise((resolve) => {
      const isBlack = fen.includes(" b ");
      let lastEval = null;
      positionWorker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
        if (line.startsWith("bestmove")) {
          resolve(lastEval !== null ? (isBlack ? -lastEval : lastEval) : 0);
        }
      };
      positionWorker.postMessage("stop");
      positionWorker.postMessage(`position fen ${fen}`);
      positionWorker.postMessage(goCommand);
    });
  }

  function getRawMoveEval(fen, move, goCommand) {
    return new Promise((resolve) => {
      const game = new Chess(fen);
      const isBlack = fen.includes(" b ");
      game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: "q",
      });
      const fenAfter = game.fen();
      let lastEval = null;
      evaluateWorker.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
        if (line.startsWith("bestmove")) {
          const raw = lastEval !== null ? -lastEval : 0;
          resolve(isBlack ? -raw : raw);
        }
      };
      evaluateWorker.postMessage("stop");
      evaluateWorker.postMessage(`position fen ${fenAfter}`);
      evaluateWorker.postMessage(goCommand);
    });
  }

  return {
    readyPromise,
    terminate,
    getTopMoves,
    getPositionEval,
    getRawMoveEval,
  };
}

export function useEnginePool() {
  const activeRef = useRef(null);
  const standbyRef = useRef(null);
  const [ready, setReady] = useState(false);

  function spawnStandby() {
    standbyRef.current = createEngineInstance();
  }

  useEffect(() => {
    const active = createEngineInstance();
    activeRef.current = active;
    active.readyPromise.then(() => setReady(true));
    spawnStandby();

    return () => {
      activeRef.current?.terminate();
      standbyRef.current?.terminate();
    };
  }, []);

  const rotate = useCallback(() => {
    activeRef.current?.terminate();
    const next = standbyRef.current;
    activeRef.current = next;
    standbyRef.current = null;
    setReady(false);
    next.readyPromise.then(() => setReady(true));
    spawnStandby();
  }, []);

  // Runs analysis on the standby engine — for preloading next position
  function preloadAnalysis(fen, topMovesCount, goCommand) {
    const standby = standbyRef.current;
    if (!standby) return Promise.resolve(null);

    return standby.readyPromise.then(() =>
      Promise.all([
        standby.getTopMoves(fen, topMovesCount, goCommand),
        standby.getPositionEval(fen, goCommand),
      ]).then(([topMoves, positionEval]) => ({ fen, topMoves, positionEval })),
    );
  }

  function getTopMoves(fen, topMovesCount, goCommand) {
    return activeRef.current.getTopMoves(fen, topMovesCount, goCommand);
  }

  function getPositionEval(fen, goCommand) {
    return activeRef.current.getPositionEval(fen, goCommand);
  }

  function getRawMoveEval(fen, move, goCommand) {
    return activeRef.current.getRawMoveEval(fen, move, goCommand);
  }

  return {
    ready,
    rotate,
    preloadAnalysis,
    getTopMoves,
    getPositionEval,
    getRawMoveEval,
  };
}
