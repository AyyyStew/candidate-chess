import { useEffect, useRef } from "react";
import type { Candidate, TopMove } from "../types";
import MoveRowCard from "./MoveRowCard";
import {
  playSuccessJingle,
  playSuccessSound,
  playFailureSound,
} from "../utils/sounds";

interface Props {
  candidates: Candidate[];
  topMoves: TopMove[];
  fen: string;
  isDone: boolean;
}

export default function GuessList({
  candidates,
  topMoves,
  fen,
  isDone,
}: Props) {
  const seenMoves = useRef<Set<string>>(new Set());

  // Play hit/miss sounds as guesses resolve
  useEffect(() => {
    candidates.forEach((c) => {
      if (c.status === "pending" || seenMoves.current.has(c.move)) return;
      seenMoves.current.add(c.move);
      if (c.status === "hit") {
        playSuccessSound();
      } else if (c.status === "miss") {
        playFailureSound();
      }
    });
  }, [candidates]);

  // Play jingle when game ends
  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(playSuccessJingle);
    return () => clearTimeout(t);
  }, [isDone]);

  if (candidates.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-faint uppercase tracking-widest">
        Your Guesses
      </p>
      <div className="flex flex-col gap-1.5">
        {[...candidates].reverse().map((c) => {
          if (c.status === "pending") {
            return (
              <div
                key={c.move}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4 animate-pulse"
                style={{
                  borderLeftColor: "var(--color-edge)",
                  background: "var(--color-surface)",
                }}
              >
                <span className="font-semibold text-muted flex-1">{c.san}</span>
                <span className="text-xs text-faint tracking-widest uppercase">
                  evaluating
                </span>
              </div>
            );
          }
          const rankIndex = topMoves.findIndex((m) => m.move === c.move);
          const rank =
            c.status === "hit" && rankIndex >= 0 ? rankIndex + 1 : "miss";
          return (
            <MoveRowCard
              key={c.move}
              rank={rank}
              san={c.san}
              eval={c.eval ?? null}
              category={c.category ?? null}
              isHit={c.status === "hit"}
              pvLine={c.line}
              startFen={fen}
              showLine={isDone}
            />
          );
        })}
      </div>
    </div>
  );
}
