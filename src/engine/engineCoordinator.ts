import { createEnginePool } from "./enginePool";
import { createEngineAnalysis } from "./engineAnalysis";
import type { EngineAnalysis } from "./engineAnalysis";
import type { Position } from "../types";
import { getRandomPosition } from "../services/positionService";

interface CoordinatorOptions {
  goCommand?: string;
  searchMoveCount?: number;
}

interface AdvanceResult {
  position: Position;
  analysis: EngineAnalysis;
  preloaded: boolean;
}

interface PreloadedPosition {
  position: Position;
  topMoves: any[];
  positionEval: number;
}

export interface EngineCoordinator {
  onReady: (cb: () => void) => void;
  preloadNext: () => void;
  advance: () => Promise<AdvanceResult>;
  destroy: () => void;
  readonly ready: boolean;
}

export function createEngineCoordinator({
  goCommand = "go depth 15",
  searchMoveCount = 20,
}: CoordinatorOptions = {}): EngineCoordinator {
  const pool = createEnginePool();
  let nextPosition: PreloadedPosition | null = null;
  let preloading = false;
  let readyCallback: (() => void) | null = null;
  let isReady = false;

  pool.onReady(() => {
    if (isReady) return;
    isReady = true;
    console.log("[coordinator] pool ready");
    readyCallback?.();
  });

  function preloadNext(): void {
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

  async function advance(): Promise<AdvanceResult> {
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

  function destroy(): void {
    pool.destroy();
  }

  return {
    onReady(cb: () => void) {
      readyCallback = cb;
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
