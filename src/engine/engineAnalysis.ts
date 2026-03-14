import { getMoveCategory } from "../utils/chess";
import { makeAnalysisResult } from "../types";
import type { TopMove, Candidate, AnalysisResult, EvaluatedMove } from "../types";
import type { EnginePool } from "./enginePool";

interface EngineAnalysisOptions {
  pool: EnginePool;
  goCommand: string;
  // Controls slice in buildTopMovesResult — only needed for study mode.
  // Game mode uses getTopMoves() directly, which returns all moves.
  topMoveCount?: number;
}

export interface EngineAnalysis {
  startAnalysis: (fen: string) => void;
  loadPrecomputed: (
    fen: string,
    topMoves: TopMove[],
    positionEval: number,
  ) => void;
  evaluateMove: (uci: string, san: string) => Promise<EvaluatedMove>;
  buildTopMovesResult: (candidates?: Candidate[]) => AnalysisResult;
  getTopMoves: () => TopMove[];
  getPositionEval: () => number;
  getFen: () => string;
  reset: () => void;
  waitForAnalysis: () => Promise<void>;
  isReady: () => boolean;
}

export function createEngineAnalysis({
  pool,
  goCommand,
  topMoveCount = Infinity,
}: EngineAnalysisOptions): EngineAnalysis {
  let topMoves: TopMove[] | null = null;
  let positionEval: number | null = null;
  let lockedFen: string | null = null;
  let readyResolve: (() => void) | null = null;

  function isAnalysisReady(): boolean {
    return (topMoves?.length ?? 0) > 0 && positionEval !== null;
  }

  // Computes category, diffBest, diffPos for all moves relative to each other.
  // Called once when moves + positionEval are both available.
  function enrichTopMoves(moves: TopMove[]): TopMove[] {
    const bestEval = moves[0]?.rawEval ?? 0;
    const isBlack = (lockedFen ?? "").includes(" b ");
    const safePositionEval = positionEval ?? 0;
    return moves.map((m) => ({
      ...m,
      diffBest: m.rawEval - bestEval,
      diffPos: m.rawEval - safePositionEval,
      category: getMoveCategory(safePositionEval, m.rawEval, isBlack, bestEval),
    }));
  }

  function notifyReady(): void {
    if (isAnalysisReady() && readyResolve) {
      topMoves = enrichTopMoves(topMoves!);
      readyResolve();
      readyResolve = null;
    }
  }

  function waitForAnalysis(): Promise<void> {
    if (isAnalysisReady()) return Promise.resolve();
    return new Promise((resolve) => {
      readyResolve = resolve;
    });
  }

  function startAnalysis(fen: string): void {
    lockedFen = fen;
    topMoves = null;
    positionEval = null;
    readyResolve = null;

    pool.getTopMoves(fen, 20, goCommand).then((moves) => {
      topMoves = moves;
      notifyReady();
    });

    pool.getPositionEval(fen, goCommand).then((score) => {
      positionEval = score;
      notifyReady();
    });
  }

  function loadPrecomputed(
    fen: string,
    precomputedTopMoves: TopMove[],
    precomputedEval: number,
  ): void {
    lockedFen = fen;
    positionEval = precomputedEval;
    topMoves = enrichTopMoves(precomputedTopMoves);
    readyResolve = null;
  }

  async function evaluateMove(uci: string, san: string): Promise<EvaluatedMove> {
    await waitForAnalysis();
    const isBlack = lockedFen!.includes(" b ");
    const rawBestEval = topMoves![0]?.rawEval ?? 0;

    const topMove = topMoves!.find((m) => m.move === uci);
    let rawMoveEval: number;
    let line: import("../types").PVLine;

    if (topMove) {
      rawMoveEval = topMove.rawEval;
      line = topMove.line;
    } else {
      const result = await pool.getMoveWithLine(lockedFen!, uci, goCommand);
      rawMoveEval = result.eval;
      line = {
        moves: [uci, ...result.line.moves],
        sans: [san, ...result.line.sans],
      };
    }

    const category = getMoveCategory(
      positionEval!,
      rawMoveEval,
      isBlack,
      rawBestEval,
    );
    const rankIdx = topMoves!.findIndex((m) => m.move === uci);

    return {
      move: uci,
      san,
      eval: rawMoveEval,
      rank: rankIdx === -1 ? null : rankIdx + 1,
      category,
      diffBest: rawMoveEval - rawBestEval,
      diffPos: rawMoveEval - positionEval!,
      line,
    };
  }

  // Used by study mode to get results with optional display count slicing.
  // Game mode uses getTopMoves() directly.
  function buildTopMovesResult(candidates: Candidate[] = []): AnalysisResult {
    return makeAnalysisResult({
      fen: lockedFen ?? "",
      positionEval: positionEval ?? 0,
      bestEval: topMoves?.[0]?.rawEval ?? 0,
      topMoves: (topMoves ?? []).slice(0, topMoveCount),
      candidates,
    });
  }

  function getTopMoves(): TopMove[] {
    return topMoves ?? [];
  }

  function getPositionEval(): number {
    return positionEval ?? 0;
  }

  function getFen(): string {
    return lockedFen ?? "";
  }

  function reset(): void {
    topMoves = null;
    positionEval = null;
    lockedFen = null;
    readyResolve = null;
  }

  return {
    startAnalysis,
    loadPrecomputed,
    evaluateMove,
    buildTopMovesResult,
    getTopMoves,
    getPositionEval,
    getFen,
    reset,
    waitForAnalysis,
    isReady: isAnalysisReady,
  };
}
