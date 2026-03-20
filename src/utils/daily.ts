export const RANK_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

import type { Candidate, TopMove } from "../types";
import { getRank } from "../types";

export function candidateToSquare(
  c: Candidate,
  liveTopMoves: TopMove[],
): string {
  if (c.status === "hidden_gem") return "💎";
  if (c.status !== "hit") return "❌";
  const rank = getRank(liveTopMoves, c.move);
  return rank != null && rank >= 1 && rank <= 5 ? RANK_EMOJI[rank - 1] : "🟩";
}
