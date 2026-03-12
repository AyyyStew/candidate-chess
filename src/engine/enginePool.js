// src/engine/enginePool.js
import { Chess } from "chess.js";

function createWorker(multiPV) {
  const worker = new Worker("/stockfish.js");
  worker.postMessage("uci");
  worker.postMessage(`setoption name MultiPV value ${multiPV}`);
  worker.postMessage("isready");
  return worker;
}

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

  return {
    enqueue(commands, onMessage) {
      return new Promise((resolve) => {
        queue.push({ commands, onMessage, onDone: resolve });
        dispatch();
      });
    },
  };
}

function createEngineInstance() {
  const analyzeWorker = createWorker(10);
  const evaluateWorker = createWorker(1);
  const positionWorker = createWorker(1);

  let readyCount = 0;
  let isReady = false;
  let readyResolve;
  const readyPromise = new Promise((resolve) => {
    readyResolve = resolve;
  });

  function onReady(event) {
    if (typeof event.data !== "string") return;
    if (event.data.trim() === "readyok") {
      readyCount++;
      if (readyCount >= 3) {
        isReady = true;
        readyResolve();
      }
    }
  }
  analyzeWorker.addEventListener("message", onReady);
  evaluateWorker.addEventListener("message", onReady);
  positionWorker.addEventListener("message", onReady);

  const analyzeQueue = makeQueue(analyzeWorker);
  const evaluateQueue = makeQueue(evaluateWorker);
  const positionQueue = makeQueue(positionWorker);

  function getTopMoves(fen, topMovesCount, goCommand) {
    const depthMatch = goCommand.match(/depth (\d+)/);
    const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;
    const isBlack = fen.includes(" b ");
    const results = {};

    return analyzeQueue
      .enqueue(
        [
          "stop",
          `setoption name MultiPV value ${topMovesCount}`,
          `position fen ${fen}`,
          goCommand,
        ],
        (line) => {
          if (!line.startsWith("info") || !line.includes("multipv")) return;
          const pvMatch = line.match(/multipv (\d+).*pv (\S+)/);
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const depthMatch2 = line.match(/depth (\d+)/);
          if (!pvMatch || !scoreMatch) return;
          if (targetDepth && parseInt(depthMatch2?.[1]) !== targetDepth) return;

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
          } catch {
            /* empty */
          }

          const rawScore = parseInt(scoreMatch[1]) / 100;
          results[pvMatch[1]] = {
            move: uciMove,
            san,
            rawEval: isBlack ? -rawScore : rawScore,
          };
        },
      )
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
    game.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: "q" });
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

  function terminate() {
    analyzeWorker.terminate();
    evaluateWorker.terminate();
    positionWorker.terminate();
  }

  return {
    readyPromise,
    isReady: () => isReady,
    terminate,
    getTopMoves,
    getPositionEval,
    getRawMoveEval,
  };
}

export function createEnginePool() {
  let active = createEngineInstance();
  let standby = createEngineInstance();
  let onReadyCallback = null;

  active.readyPromise.then(() => onReadyCallback?.());

  function rotate() {
    active.terminate();
    active = standby;
    standby = createEngineInstance();
    if (active.isReady()) {
      onReadyCallback?.();
    } else {
      active.readyPromise.then(() => onReadyCallback?.());
    }
  }

  async function preloadAnalysis(fen, topMovesCount, goCommand) {
    await standby.readyPromise;
    const [topMoves, positionEval] = await Promise.all([
      standby.getTopMoves(fen, topMovesCount, goCommand),
      standby.getPositionEval(fen, goCommand),
    ]);
    return { fen, topMoves, positionEval };
  }

  function destroy() {
    active.terminate();
    standby.terminate();
  }

  return {
    onReady(cb) {
      onReadyCallback = cb;
    },
    isReady: () => active.isReady(),
    rotate,
    preloadAnalysis,
    getTopMoves: (fen, n, cmd) => active.getTopMoves(fen, n, cmd),
    getPositionEval: (fen, cmd) => active.getPositionEval(fen, cmd),
    getRawMoveEval: (fen, move, cmd) => active.getRawMoveEval(fen, move, cmd),
    destroy,
  };
}
