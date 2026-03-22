import { Chess } from "chess.js";
import type { Category } from "../types";

export const STARTING_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function isValidFen(fen: string): boolean {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function parsePgn(
  pgn: string,
): { moves: { san: string; fenAfter: string }[]; initialFen: string } | null {
  try {
    const game = new Chess();
    game.loadPgn(pgn);
    const sanMoves = game.history();
    if (sanMoves.length === 0) return null;

    const fenMatch = pgn.match(/\[FEN "([^"]+)"\]/i);
    const replay = fenMatch ? new Chess(fenMatch[1]) : new Chess();
    const initialFen = replay.fen();

    const moves: { san: string; fenAfter: string }[] = [];
    for (const san of sanMoves) {
      replay.move(san);
      moves.push({ san, fenAfter: replay.fen() });
    }
    return { moves, initialFen };
  } catch {
    return null;
  }
}

export function formatEval(value: number | undefined | null): string {
  if (value === undefined || value === null) return "-";
  if (value >= 9000) return `M${10000 - Math.round(value)}`;
  if (value <= -9000) return `-M${10000 - Math.round(-value)}`;
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

export function isBlackToMove(fen: string): boolean {
  return fen.includes(" b ");
}

export function normalizeEval(evalScore: number, fen: string): number {
  return isBlackToMove(fen) ? -evalScore : evalScore;
}

export function evalToWinPercent(evalScore: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evalScore * 100)) - 1);
}

export function getMoveCategory(
  rawPositionEval: number,
  rawMoveEval: number,
  isBlack: boolean,
  rawBestEval: number | null = null,
): Category {
  const sign = isBlack ? -1 : 1;
  const before = evalToWinPercent(sign * rawPositionEval);
  const after = evalToWinPercent(sign * rawMoveEval);
  const drop = before - after;

  if (rawBestEval !== null && rawMoveEval === rawBestEval)
    return { label: "Best", icon: "★", color: "#22c55e" };
  if (drop < 1) return { label: "Excellent", icon: "✦", color: "#84cc16" };
  if (drop < 3) return { label: "Good", icon: "✓", color: "#a3e635" };
  if (drop < 7) return { label: "Inaccuracy", icon: "?!", color: "#facc15" };
  if (drop < 15) return { label: "Mistake", icon: "?", color: "#f97316" };
  return { label: "Blunder", icon: "??", color: "#ef4444" };
}
