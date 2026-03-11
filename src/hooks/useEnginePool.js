// FILE: src/hooks/useEnginePool.js
import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";

function createEngineInstance() {
  function makeWorker(multiPV) {
    const worker = new Worker("/stockfish.js");
    // Use addEventListener so multiple handlers can coexist
    worker.postMessage("uci");
    worker.postMessage(`setoption name MultiPV value ${multiPV}`);
    worker.postMessage("isready");
    return worker;
  }

  const analyzeWorker = makeWorker(10);
  const evaluateWorker = makeWorker(1);
  const positionWorker = makeWorker(1);

  // --- Ready handshake ---
  let readyCount = 0;
  let readyResolve = null;
  let isReady = false;
  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  function onReady(event) {
    if (typeof event.data !== "string") return;

    if (event.data.trim() === "readyok") {
      readyCount += 1;
      if (readyCount >= 3) {
        isReady = true;
        readyResolve();
      }
    }
  }
  analyzeWorker.addEventListener("message", onReady);
  evaluateWorker.addEventListener("message", onReady);
  positionWorker.addEventListener("message", onReady);

  // --- Per-worker serial job queues ---
  // Each worker processes one job at a time; jobs are queued and dispatched
  // in order. This prevents onmessage stomping entirely.
  function makeQueue(worker) {
    let running = false;
    const queue = [];

    function dispatch() {
      if (running || queue.length === 0) return;
      running = true;
      const { commands, onMessage, onDone } = queue[0];

      const handler = (event) => {
        if (typeof event.data !== "string") return;
        const line = event.data.trim();
        onMessage(line);
        if (line.startsWith("bestmove")) {
          worker.removeEventListener("message", handler);
          running = false;
          queue.shift();
          onDone();
          dispatch(); // next job
        }
      };

      worker.addEventListener("message", handler);
      for (const cmd of commands) worker.postMessage(cmd);
    }

    function enqueue(commands, onMessage) {
      return new Promise((resolve) => {
        queue.push({ commands, onMessage, onDone: resolve });
        dispatch();
      });
    }

    function stop() {
      worker.postMessage("stop");
    }

    return { enqueue, stop };
  }

  const analyzeQueue = makeQueue(analyzeWorker);
  const evaluateQueue = makeQueue(evaluateWorker);
  const positionQueue = makeQueue(positionWorker);

  function terminate() {
    analyzeWorker.terminate();
    evaluateWorker.terminate();
    positionWorker.terminate();
  }

  function getTopMoves(fen, topMovesCount, goCommand) {
    const depthMatch = goCommand.match(/depth (\d+)/);
    const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;
    const isBlack = fen.includes(" b ");
    const results = {};

    const commands = [
      "stop",
      `setoption name MultiPV value ${topMovesCount}`,
      `position fen ${fen}`,
      goCommand,
    ];

    return analyzeQueue
      .enqueue(commands, (line) => {
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
      })
      .then(() => Object.values(results).slice(0, topMovesCount));
  }

  function getPositionEval(fen, goCommand) {
    const isBlack = fen.includes(" b ");
    let lastEval = null;

    const commands = ["stop", `position fen ${fen}`, goCommand];

    return positionQueue
      .enqueue(commands, (line) => {
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
      })
      .then(() => (lastEval !== null ? (isBlack ? -lastEval : lastEval) : 0));
  }

  function getRawMoveEval(fen, move, goCommand) {
    const game = new Chess(fen);
    const isBlack = fen.includes(" b ");
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: "q",
    });
    const fenAfter = game.fen();
    let lastEval = null;

    const commands = ["stop", `position fen ${fenAfter}`, goCommand];

    return evaluateQueue
      .enqueue(commands, (line) => {
        if (line.startsWith("info") && line.includes("score cp")) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          if (scoreMatch) lastEval = parseInt(scoreMatch[1]) / 100;
        }
      })
      .then(() => {
        const raw = lastEval !== null ? -lastEval : 0;
        return isBlack ? -raw : raw;
      });
  }

  return {
    readyPromise,
    terminate,
    getTopMoves,
    getPositionEval,
    getRawMoveEval,
    isReady: () => isReady,
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
    if (next.isReady()) {
      setReady(true);
    } else {
      setReady(false);
      next.readyPromise.then(() => setReady(true));
    }
    spawnStandby();
  }, []);
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
