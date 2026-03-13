import { getMoveCategory } from "../utils/chess";
import { makeTopMove, makeCandidate, makeAnalysisResult } from "../types";
import type { TopMove, Candidate, AnalysisResult } from "../types";
import type { EnginePool } from "./enginePool";

interface EngineAnalysisOptions {
  pool: EnginePool;
  goCommand: string;
  topMoveCount?: number;
}

export interface EngineAnalysis {
  startAnalysis: (fen: string) => void;
  loadPrecomputed: (
    fen: string,
    topMoves: TopMove[],
    positionEval: number,
  ) => void;
  evaluateMove: (uci: string, san: string) => Promise<Candidate>;
  buildTopMovesResult: (candidates?: Candidate[]) => AnalysisResult;
  reset: () => void;
  waitForAnalysis: () => Promise<void>;
  isReady: () => boolean;
}

export function createEngineAnalysis({
  pool,
  goCommand,
  topMoveCount = 5,
}: EngineAnalysisOptions): EngineAnalysis {
  let topMoves: TopMove[] | null = null;
  let positionEval: number | null = null;
  let lockedFen: string | null = null;
  let readyResolve: (() => void) | null = null;

  function isAnalysisReady(): boolean {
    return (topMoves?.length ?? 0) > 0 && positionEval !== null;
  }

  function notifyReady(): void {
    if (isAnalysisReady() && readyResolve) {
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
    console.log("[engineAnalysis] startAnalysis", fen);
    lockedFen = fen;
    topMoves = null;
    positionEval = null;
    readyResolve = null;

    pool.getTopMoves(fen, 20, goCommand).then((moves) => {
      console.log("[engineAnalysis] topMoves ready", moves.length);
      topMoves = moves;
      notifyReady();
    });

    pool.getPositionEval(fen, goCommand).then((score) => {
      console.log("[engineAnalysis] positionEval ready", score);
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
    topMoves = precomputedTopMoves;
    positionEval = precomputedEval;
    readyResolve = null;
  }

  async function evaluateMove(uci: string, san: string): Promise<Candidate> {
    await waitForAnalysis();
    const isBlack = lockedFen!.includes(" b ");
    const rawBestEval = topMoves![0]?.rawEval ?? 0;

    const topMove = topMoves!.find((m) => m.move === uci);
    let rawMoveEval: number;
    let line: import("../types").PVLine;

    if (topMove) {
      rawMoveEval = topMove.rawEval;
      line = { moves: topMove.line.moves.slice(1), sans: topMove.line.sans.slice(1) };
    } else {
      const result = await pool.getMoveWithLine(lockedFen!, uci, goCommand);
      rawMoveEval = result.eval;
      line = result.line;
    }

    const category = getMoveCategory(
      positionEval!,
      rawMoveEval,
      isBlack,
      rawBestEval,
    );
    const rankIdx = topMoves!.findIndex((m) => m.move === uci);

    return makeCandidate({
      move: uci,
      san,
      pending: false,
      eval: rawMoveEval,
      category,
      rank: rankIdx === -1 ? null : rankIdx + 1,
      diffBest: rawMoveEval - rawBestEval,
      diffPos: rawMoveEval - positionEval!,
      line,
    });
  }

  function buildTopMovesResult(candidates: Candidate[] = []): AnalysisResult {
    const rawBestEval = topMoves?.[0]?.rawEval ?? 0;
    const isBlack = lockedFen?.includes(" b ") ?? false;
    const safePositionEval = positionEval ?? 0;

    const builtTopMoves = (topMoves ?? []).slice(0, topMoveCount).map((m) =>
      makeTopMove({
        move: m.move,
        san: m.san,
        rawEval: m.rawEval,
        diffBest: m.rawEval - rawBestEval,
        diffPos: m.rawEval - safePositionEval,
        category: getMoveCategory(
          safePositionEval,
          m.rawEval,
          isBlack,
          rawBestEval,
        ),
        line: m.line ?? { moves: [], sans: [] },
      }),
    );

    return makeAnalysisResult({
      fen: lockedFen ?? "",
      positionEval: safePositionEval,
      bestEval: rawBestEval,
      topMoves: builtTopMoves,
      candidates,
    });
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
    reset,
    waitForAnalysis,
    isReady: isAnalysisReady,
  };
}
