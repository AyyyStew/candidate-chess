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
  if (value === undefined || value === null) return "-";
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

export function evalToWinPercent(evalScore) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evalScore * 100)) - 1);
}

export function getMoveCategory(
  rawPositionEval,
  rawMoveEval,
  isBlack,
  rawBestEval = null,
) {
  const sign = isBlack ? -1 : 1;
  const before = evalToWinPercent(sign * rawPositionEval);
  const after = evalToWinPercent(sign * rawMoveEval);
  const drop = before - after;

  // only the actual best move gets Best
  if (rawBestEval !== null && rawMoveEval === rawBestEval)
    return { label: "Best", icon: "★", color: "#22c55e" };

  if (drop < 1) return { label: "Excellent", icon: "✦", color: "#84cc16" };
  if (drop < 3) return { label: "Good", icon: "✓", color: "#a3e635" };
  if (drop < 7) return { label: "Inaccuracy", icon: "?!", color: "#facc15" };
  if (drop < 15) return { label: "Mistake", icon: "?", color: "#f97316" };
  return { label: "Blunder", icon: "??", color: "#ef4444" };
}
