import { Chess } from "chess.js";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function isValidFen(fen) {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function formatEval(value) {
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

export function evalColor(diffFromBest) {
  if (diffFromBest >= -0.3) return "#4caf50"; // green  — good
  if (diffFromBest >= -1.0) return "#ff9800"; // orange — inaccuracy
  return "#f44336"; // red    — blunder
}
