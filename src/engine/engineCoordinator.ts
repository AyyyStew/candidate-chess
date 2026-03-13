// FILE: src/engine/engineCoordinator.js
import { createEnginePool } from "./enginePool";
import { createEngineAnalysis } from "./engineAnalysis";
import { getRandomPosition } from "../services/positionService";

export function createEngineCoordinator({
  goCommand = "go depth 15",
  searchMoveCount = 20,
} = {}) {
  const pool = createEnginePool();
  let nextPosition = null;
  let preloading = false;
  let readyCallback = null;
  let isReady = false;

  pool.onReady(() => {
    if (isReady) return;
    isReady = true;
    console.log("[coordinator] pool ready");
    readyCallback?.();
  });

  function preloadNext() {
    if (preloading) return;
    preloading = true;
    const position = getRandomPosition();
    pool
      .preloadAnalysis(position.fen, searchMoveCount, goCommand)
      .then((result) => {
        preloading = false;
        if (!result) return;
        nextPosition = { position, ...result };
        console.log("[coordinator] preload done:", position.label);
      });
  }

  async function advance() {
    const cached = nextPosition;
    nextPosition = null;
    pool.rotate();
    preloadNext();

    const analysis = createEngineAnalysis({ pool, goCommand });

    if (cached) {
      console.log(
        "[coordinator] advance using preloaded:",
        cached.position.label,
      );
      analysis.loadPrecomputed(
        cached.position.fen,
        cached.topMoves,
        cached.positionEval,
      );
      return { position: cached.position, analysis, preloaded: true };
    }

    console.log("[coordinator] advance fallback — engine will think");
    const position = getRandomPosition();
    analysis.startAnalysis(position.fen);
    return { position, analysis, preloaded: false };
  }

  function destroy() {
    pool.destroy();
  }

  return {
    onReady(cb) {
      readyCallback = cb;
      // Fire immediately if pool is already ready
      if (isReady) {
        cb();
      } else if (pool.isReady()) {
        isReady = true;
        cb();
      }
    },
    preloadNext,
    advance,
    destroy,
    get ready() {
      return isReady;
    },
  };
}
