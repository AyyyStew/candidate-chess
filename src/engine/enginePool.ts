import { useEffect, useRef, useState, useCallback } from "react";
import { Chess } from "chess.js";
import type { TopMove, PVLine } from "../types";

interface QueueJob {
  commands: string[];
  onMessage: (line: string) => void;
  onDone: () => void;
}

interface EngineInstance {
  readyPromise: Promise<void>;
  terminate: () => void;
  getTopMoves: (
    fen: string,
    topMovesCount: number,
    goCommand: string,
  ) => Promise<TopMove[]>;
  getPositionEval: (fen: string, goCommand: string) => Promise<number>;
  getRawMoveEval: (
    fen: string,
    move: string,
    goCommand: string,
  ) => Promise<number>;
  isReady: () => boolean;
}

export interface EnginePool {
  ready: boolean;
  rotate: () => void;
  preloadAnalysis: (
    fen: string,
    topMovesCount: number,
    goCommand: string,
  ) => Promise<{
    fen: string;
    topMoves: TopMove[];
    positionEval: number;
  } | null>;
  getTopMoves: (fen: string, n: number, cmd: string) => Promise<TopMove[]>;
  getPositionEval: (fen: string, cmd: string) => Promise<number>;
  getRawMoveEval: (fen: string, move: string, cmd: string) => Promise<number>;
}

function createEngineInstance(): EngineInstance {
  function makeWorker(multiPV: number): Worker {
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
  let readyResolve: (() => void) | null = null;
  let isReady = false;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  function onReady(event: MessageEvent): void {
    if (typeof event.data !== "string") return;
    if (event.data.trim() === "readyok") {
      readyCount += 1;
      if (readyCount >= 3) {
        isReady = true;
        readyResolve?.();
      }
    }
  }
  analyzeWorker.addEventListener("message", onReady);
  evaluateWorker.addEventListener("message", onReady);
  positionWorker.addEventListener("message", onReady);

  function makeQueue(worker: Worker) {
    let running = false;
    const queue: QueueJob[] = [];

    function dispatch(): void {
      if (running || queue.length === 0) return;
      running = true;
      const { commands, onMessage, onDone } = queue[0];

      const handler = (event: MessageEvent): void => {
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

    function enqueue(
      commands: string[],
      onMessage: (line: string) => void,
    ): Promise<void> {
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

  function terminate(): void {
    analyzeWorker.terminate();
    evaluateWorker.terminate();
    positionWorker.terminate();
  }

  function getTopMoves(
    fen: string,
    topMovesCount: number,
    goCommand: string,
  ): Promise<TopMove[]> {
    const depthMatch = goCommand.match(/depth (\d+)/);
    const targetDepth = depthMatch ? parseInt(depthMatch[1]) : null;
    const isBlack = fen.includes(" b ");
    const results: Record<string, TopMove> = {};

    const commands = [
      "stop",
      `setoption name MultiPV value ${topMovesCount}`,
      `position fen ${fen}`,
      goCommand,
    ];

    return analyzeQueue
      .enqueue(commands, (line: string) => {
        if (!line.startsWith("info") || !line.includes("multipv")) return;

        const pvMatch = line.match(/multipv (\d+)/);
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const depthInfo = line.match(/depth (\d+)/);
        const pvMovesMatch = line.match(/ pv (.+)$/);

        if (!pvMatch || !scoreMatch) return;
        if (targetDepth && parseInt(depthInfo?.[1] ?? "0") !== targetDepth)
          return;

        const pvIndex = pvMatch[1];
        const uciMoves = pvMovesMatch ? pvMovesMatch[1].trim().split(" ") : [];
        const uciMove = uciMoves[0];
        if (!uciMove) return;

        const sans: string[] = [];
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
        const rawEval = isBlack ? -rawScore : rawScore;

        results[pvIndex] = {
          move: uciMove,
          san: firstSan,
          rawEval,
          eval: rawEval,
          diffBest: 0,
          diffPos: 0,
          category: null,
          line: { moves: uciMoves, sans } satisfies PVLine,
        };
      })
      .then(() => Object.values(results).slice(0, topMovesCount));
  }

  function getPositionEval(fen: string, goCommand: string): Promise<number> {
    const isBlack = fen.includes(" b ");
    let lastEval: number | null = null;

    return positionQueue
      .enqueue(["stop", `position fen ${fen}`, goCommand], (line: string) => {
        if (!line.startsWith("info") || !line.includes("score cp")) return;
        const m = line.match(/score cp (-?\d+)/);
        if (m) lastEval = parseInt(m[1]) / 100;
      })
      .then(() => (lastEval !== null ? (isBlack ? -lastEval : lastEval) : 0));
  }

  function getRawMoveEval(
    fen: string,
    move: string,
    goCommand: string,
  ): Promise<number> {
    const game = new Chess(fen);
    const isBlack = fen.includes(" b ");
    game.move({
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move[4] ?? "q",
    });
    const fenAfter = game.fen();
    let lastEval: number | null = null;

    return evaluateQueue
      .enqueue(
        ["stop", `position fen ${fenAfter}`, goCommand],
        (line: string) => {
          if (!line.startsWith("info") || !line.includes("score cp")) return;
          const m = line.match(/score cp (-?\d+)/);
          if (m) lastEval = parseInt(m[1]) / 100;
        },
      )
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

export function useEnginePool(): EnginePool {
  const activeRef = useRef<EngineInstance | null>(null);
  const standbyRef = useRef<EngineInstance | null>(null);
  const [ready, setReady] = useState(false);

  function spawnStandby(): void {
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

  const rotate = useCallback((): void => {
    activeRef.current?.terminate();
    const next = standbyRef.current!;
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

  function preloadAnalysis(
    fen: string,
    topMovesCount: number,
    goCommand: string,
  ) {
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
    getTopMoves: (fen, n, cmd) => activeRef.current!.getTopMoves(fen, n, cmd),
    getPositionEval: (fen, cmd) => activeRef.current!.getPositionEval(fen, cmd),
    getRawMoveEval: (fen, move, cmd) =>
      activeRef.current!.getRawMoveEval(fen, move, cmd),
  };
}

export function createEnginePool() {
  let active = createEngineInstance();
  let standby = createEngineInstance();
  let onReadyCallback: (() => void) | null = null;

  active.readyPromise.then(() => onReadyCallback?.());

  function rotate(): void {
    active.terminate();
    active = standby;
    standby = createEngineInstance();
    if (active.isReady()) {
      onReadyCallback?.();
    } else {
      active.readyPromise.then(() => onReadyCallback?.());
    }
  }

  function preloadAnalysis(
    fen: string,
    topMovesCount: number,
    goCommand: string,
  ) {
    return standby.readyPromise.then(() =>
      Promise.all([
        standby.getTopMoves(fen, topMovesCount, goCommand),
        standby.getPositionEval(fen, goCommand),
      ]).then(([topMoves, positionEval]) => ({ fen, topMoves, positionEval })),
    );
  }

  function destroy(): void {
    active.terminate();
    standby.terminate();
  }

  return {
    onReady(cb: () => void) {
      onReadyCallback = cb;
    },
    isReady: () => active.isReady(),
    ready: active.isReady(),
    rotate,
    preloadAnalysis,
    destroy,
    getTopMoves: (fen: string, n: number, cmd: string) =>
      active.getTopMoves(fen, n, cmd),
    getPositionEval: (fen: string, cmd: string) =>
      active.getPositionEval(fen, cmd),
    getRawMoveEval: (fen: string, move: string, cmd: string) =>
      active.getRawMoveEval(fen, move, cmd),
  };
}
