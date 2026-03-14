import { Chess } from "chess.js";
import { createEnginePool } from "./enginePool";
import { createEngineAnalysis } from "./engineAnalysis";
import type { EngineAnalysis } from "./engineAnalysis";
import type { Position, TopMove, PositionPV } from "../types";
import { getRandomPosition } from "../services/positionService";

export function buildFromPvs(
  fen: string,
  pvs: PositionPV[],
): { topMoves: TopMove[]; positionEval: number } {
  const isBlack = fen.includes(" b ");
  const topMoves: TopMove[] = pvs.map((pv) => {
    const uciMoves = pv.line.split(" ").filter(Boolean);
    const sans: string[] = [];
    try {
      const game = new Chess(fen);
      for (const uci of uciMoves) {
        const m = game.move({
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
    const rawEval = isBlack ? -(pv.cp / 100) : pv.cp / 100;
    return {
      move: pv.best_move,
      san: sans[0] ?? pv.best_move,
      rawEval,
      eval: rawEval,
      diffBest: 0,
      diffPos: 0,
      category: null as TopMove["category"],
      line: { moves: uciMoves, sans },
    };
  });
  const positionEval = topMoves[0]?.rawEval ?? 0;
  return { topMoves, positionEval };
}

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
  preloadNext: () => Promise<void>;
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

  async function preloadNext(): Promise<void> {
    if (preloading) return;
    preloading = true;
    const position = await getRandomPosition();

    if (position.pvs && position.pvs.length > 0) {
      const { topMoves, positionEval } = buildFromPvs(
        position.fen,
        position.pvs,
      );
      preloading = false;
      nextPosition = { position, topMoves, positionEval };
      console.log("[coordinator] preload done (from pvs):", position.label);
      return;
    }

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

    const position = await getRandomPosition();
    console.log(position);

    console.log("[coordinator] advance fallback — fetching position");
    if (position.pvs && position.pvs.length > 0) {
      const { topMoves, positionEval } = buildFromPvs(
        position.fen,
        position.pvs,
      );
      analysis.loadPrecomputed(position.fen, topMoves, positionEval);
      return { position, analysis, preloaded: true };
    }

    console.log("[coordinator] advance fallback — engine will think");
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
