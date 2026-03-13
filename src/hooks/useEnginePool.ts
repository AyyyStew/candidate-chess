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
          dispatch();
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

    return { enqueue };
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
        if (!line.startsWith("info") || !line.includes("multipv")) return;

        const pvMatch = line.match(/multipv (\d+)/);
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const depthInfo = line.match(/depth (\d+)/);
        const pvMovesMatch = line.match(/ pv (.+)$/);

        if (!pvMatch || !scoreMatch) return;
        if (targetDepth && parseInt(depthInfo?.[1]) !== targetDepth) return;

        const pvIndex = pvMatch[1];
        const uciMoves = pvMovesMatch ? pvMovesMatch[1].trim().split(" ") : [];
        const uciMove = uciMoves[0];
        if (!uciMove) return;

        // Convert full PV to SAN
        const sans = [];
        try {
          const tempGame = new Chess(fen);
          for (const uci of uciMoves) {
            const m = tempGame.move({
              from: uci.slice(0, 2),
              to: uci.slice(2, 4),
              promotion: uci[4] ?? "q",
            });
            if (!m) break;
            sans.push(m.san);
          }
        } catch {
          /* empty */
        }

        const firstSan = sans[0] ?? uciMove;
        const rawScore = parseInt(scoreMatch[1]) / 100;

        results[pvIndex] = {
          move: uciMove,
          san: firstSan,
          rawEval: isBlack ? -rawScore : rawScore,
          line: {
            moves: uciMoves,
            sans,
          },
        };
      })
      .then(() => Object.values(results).slice(0, topMovesCount));
  }

  function getPositionEval(fen, goCommand) {
    const isBlack = fen.includes(" b ");
    let lastEval = null;

    return positionQueue
      .enqueue(["stop", `position fen ${fen}`, goCommand], (line) => {
        if (!line.startsWith("info") || !line.includes("score cp")) return;
        const m = line.match(/score cp (-?\d+)/);
        if (m) lastEval = parseInt(m[1]) / 100;
      })
      .then(() => (lastEval !== null ? (isBlack ? -lastEval : lastEval) : 0));
  }

  function getRawMoveEval(fen, move, goCommand) {
    const game = new Chess(fen);
    const isBlack = fen.includes(" b ");
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] ?? "q",
    });
    const fenAfter = game.fen();
    let lastEval = null;

    return evaluateQueue
      .enqueue(["stop", `position fen ${fenAfter}`, goCommand], (line) => {
        if (!line.startsWith("info") || !line.includes("score cp")) return;
        const m = line.match(/score cp (-?\d+)/);
        if (m) lastEval = parseInt(m[1]) / 100;
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

  return {
    ready,
    rotate,
    preloadAnalysis,
    getTopMoves: (fen, n, cmd) => activeRef.current.getTopMoves(fen, n, cmd),
    getPositionEval: (fen, cmd) => activeRef.current.getPositionEval(fen, cmd),
    getRawMoveEval: (fen, move, cmd) =>
      activeRef.current.getRawMoveEval(fen, move, cmd),
  };
}
