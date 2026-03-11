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

export function isBlackToMove(fen) {
  return fen.includes(" b ");
}

export function normalizeEval(evalScore, fen) {
  return isBlackToMove(fen) ? -evalScore : evalScore;
}

export function evalToWinPercent(evalScore) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evalScore * 100)) - 1);
}

export function getMoveCategory(
  rawPositionEval,
  rawMoveEval,
  rawBestEval,
  isBlack,
) {
  const sign = isBlack ? -1 : 1;

  // if this is within 0.05 win% of the best move, it's Best
  const moveWin = evalToWinPercent(sign * rawMoveEval);
  const bestWin = evalToWinPercent(sign * rawBestEval);
  if (Math.abs(moveWin - bestWin) <= 0.5)
    return { label: "Best", icon: "★", color: "#22c55e" };

  // otherwise categorize by drop from position
  const before = evalToWinPercent(sign * rawPositionEval);
  const drop = before - moveWin;

  if (drop < 1) return { label: "Excellent", icon: "✦", color: "#84cc16" };
  if (drop < 3) return { label: "Good", icon: "✓", color: "#a3e635" };
  if (drop < 7) return { label: "Inaccuracy", icon: "?!", color: "#facc15" };
  if (drop < 15) return { label: "Mistake", icon: "?", color: "#f97316" };
  return { label: "Blunder", icon: "??", color: "#ef4444" };
}
