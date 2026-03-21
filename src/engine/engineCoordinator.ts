import { Chess } from "chess.js";
import { createEnginePool } from "./enginePool";
import { debug } from "../utils/debug";
import { createEngineAnalysis } from "./engineAnalysis";
import type { EngineAnalysis } from "./engineAnalysis";
import type { Position, TopMove, PositionPV } from "../types";
import { getMoveCategory } from "../utils/chess";
import { getRandomPosition } from "../services/positionService";

export function buildFromPvs(
  fen: string,
  pvs: PositionPV[],
): { topMoves: TopMove[]; positionEval: number } {
  const isBlack = fen.includes(" b ");
  const rawMoves = pvs.map((pv) => {
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
      line: { moves: uciMoves, sans },
    };
  });

  const positionEval = rawMoves[0]?.rawEval ?? 0;
  const bestEval = rawMoves[0]?.rawEval ?? 0;

  const topMoves: TopMove[] = rawMoves.map((m) => ({
    move: m.move,
    san: m.san,
    rawEval: m.rawEval,
    eval: m.rawEval,
    diffBest: m.rawEval - bestEval,
    diffPos: m.rawEval - positionEval,
    category: getMoveCategory(positionEval, m.rawEval, isBlack, bestEval),
    line: m.line,
  }));

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
  advanceWithPosition: (position: Position) => Promise<AdvanceResult>;
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
    debug("coordinator", "pool ready");
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
      debug("coordinator", "preload done (from pvs):", position.label);
      return;
    }

    pool
      .preloadAnalysis(position.fen, searchMoveCount, goCommand)
      .then((result) => {
        preloading = false;
        if (!result) return;
        nextPosition = { position, ...result };
        debug("coordinator", "preload done:", position.label);
      });
  }

  async function advance(): Promise<AdvanceResult> {
    const cached = nextPosition;
    nextPosition = null;
    pool.rotate();
    preloadNext();

    const analysis = createEngineAnalysis({ pool, goCommand });

    if (cached) {
      debug("coordinator", "advance using preloaded:", cached.position.label);
      analysis.loadPrecomputed(
        cached.position.fen,
        cached.topMoves,
        cached.positionEval,
      );
      return { position: cached.position, analysis, preloaded: true };
    }

    const position = await getRandomPosition();
    debug("coordinator", "advance fallback — fetching position", position);
    if (position.pvs && position.pvs.length > 0) {
      const { topMoves, positionEval } = buildFromPvs(
        position.fen,
        position.pvs,
      );
      analysis.loadPrecomputed(position.fen, topMoves, positionEval);
      return { position, analysis, preloaded: true };
    }

    debug("coordinator", "advance fallback — engine will think");
    analysis.startAnalysis(position.fen);
    return { position, analysis, preloaded: false };
  }

  function destroy(): void {
    pool.destroy();
  }

  async function advanceWithPosition(
    position: Position,
  ): Promise<AdvanceResult> {
    const analysis = createEngineAnalysis({ pool, goCommand });
    if (position.pvs && position.pvs.length > 0) {
      const { topMoves, positionEval } = buildFromPvs(
        position.fen,
        position.pvs,
      );
      analysis.loadPrecomputed(position.fen, topMoves, positionEval);
      return { position, analysis, preloaded: true };
    }
    analysis.startAnalysis(position.fen);
    return { position, analysis, preloaded: false };
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
    advanceWithPosition,
    destroy,
    get ready() {
      return isReady;
    },
  };
}
