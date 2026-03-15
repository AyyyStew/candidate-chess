// src/types.ts

export interface PVLine {
  moves: string[];
  sans: string[];
}

export interface Category {
  label: string;
  icon: string;
  color: string;
}

export interface TopMove {
  move: string;
  san: string;
  rawEval: number;
  eval: number;
  diffBest: number;
  diffPos: number;
  category: Category | null;
  line: PVLine;
}

// The pure analysis result for a single move — no game state.
// Sessions use this to assemble a Candidate with their own game fields.
export interface EvaluatedMove {
  move: string;
  san: string;
  eval: number;
  rank: number | null;
  category: Category | null;
  diffBest: number;
  diffPos: number;
  line: PVLine;
}

export interface Candidate {
  move: string;
  san: string;
  pending: boolean;
  eval?: number;
  diffBest?: number;
  diffPos?: number;
  rank?: number | null;
  category?: Category | null;
  isHit?: boolean;
  isMiss?: boolean;
  line?: PVLine;
}

export interface AnalysisResult {
  fen: string;
  positionEval: number;
  bestEval: number;
  topMoves: TopMove[];
  candidates: Candidate[];
}

export interface PositionPV {
  best_move: string;
  cp: number;
  line: string;
}

export interface Position {
  id: number;
  sourceIndex?: number;
  fen: string;
  label: string;
  event: string;
  moveNumber: number;
  orientation: "white" | "black";
  pgn?: string | null;
  moves?: string[];
  pvs?: PositionPV[];
}

export interface GameSnapshot {
  phase: "active" | "done";
  fen: string;
  orientation: "white" | "black";
  label: string;
  event: string;
  moveNumber: number;
  pgn?: string | null;
  candidates: Candidate[];
  strikes: number;
  maxStrikes: number;
  targetMoves: number;
  liveTopMoves: TopMove[];
  analysisReady: boolean;
}

export interface StudySnapshot {
  phase: "idle" | "active" | "comparing" | "done";
  lockedFen: string | null;
  candidates: Candidate[];
  results: AnalysisResult | null;
  analysisReady: boolean;
  minCandidates: number;
  canCompare: boolean;
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function makeTopMove(
  data: Partial<TopMove> & { move: string; san: string; rawEval: number },
): TopMove {
  const rawEval = data.rawEval ?? 0;
  const bestEval = (data as any).bestEval ?? rawEval;
  return {
    move: data.move,
    san: data.san,
    rawEval,
    eval: rawEval,
    diffBest: data.diffBest ?? rawEval - bestEval,
    diffPos: data.diffPos ?? 0,
    category: data.category ?? null,
    line: data.line ?? { moves: [], sans: [] },
  };
}

export function makeCandidate(
  data: Partial<Candidate> & { move: string; san: string },
): Candidate {
  if (!data.move) throw new Error("Candidate requires move (UCI)");
  if (!data.san) throw new Error("Candidate requires san");
  return {
    move: data.move,
    san: data.san,
    pending: data.pending ?? false,
    eval: data.eval,
    diffBest: data.diffBest,
    diffPos: data.diffPos,
    rank: data.rank ?? null,
    category: data.category ?? null,
    isHit: data.isHit,
    isMiss: data.isMiss,
    line: data.line,
  };
}

export function makeAnalysisResult(
  data: Partial<AnalysisResult> & { fen: string },
): AnalysisResult {
  if (!data.fen) throw new Error("AnalysisResult requires fen");
  return {
    fen: data.fen,
    positionEval: data.positionEval ?? 0,
    bestEval: data.bestEval ?? 0,
    topMoves: data.topMoves ?? [],
    candidates: data.candidates ?? [],
  };
}

export function makePosition(
  data: Partial<Position> & { fen: string; label: string },
): Position {
  if (!data.fen) throw new Error("Position requires fen");
  if (!data.label) throw new Error("Position requires label");
  return {
    id: data.id ?? 0,
    sourceIndex: data.sourceIndex,
    fen: data.fen,
    label: data.label,
    event: data.event ?? "",
    moveNumber: data.moveNumber ?? 1,
    orientation: data.orientation ?? "white",
    pgn: data.pgn ?? null,
    moves: data.moves ?? [],
    pvs: data.pvs,
  };
}
