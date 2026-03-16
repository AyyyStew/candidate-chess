import { useState, useEffect, useRef } from "react";
import type { TopMove, Candidate } from "../types";
import MoveRowCard from "./MoveRowCard";
import successSound from "../assets/sounds/edited/success.wav";
import failureSound from "../assets/sounds/edited/failure.wav";
import { playSuccessJingle } from "../utils/sounds";

const SUCCESS_SOUND = new Audio(successSound);
const FAILURE_SOUND = new Audio(failureSound);

interface StrikeIndicatorProps {
  strikes: number;
  maxStrikes: number;
}

function StrikeIndicator({ strikes, maxStrikes }: StrikeIndicatorProps) {
  return (
    <div className="flex gap-2 items-center">
      {Array.from({ length: maxStrikes }).map((_, i) => {
        const lost = i < strikes;
        return (
          <span
            key={i}
            className="text-3xl transition-all duration-300"
            style={{
              opacity: lost ? 0.12 : 1,
              transform: lost ? "scale(0.75)" : "scale(1)",
              filter: lost ? "grayscale(1)" : "none",
            }}
          >
            ❤️
          </span>
        );
      })}
    </div>
  );
}

interface FamilyFeudBoardProps {
  fen: string;
  topMoves: TopMove[];
  candidates: Candidate[];
  targetMoves: number;
  isDone: boolean;
  strikes: number;
  maxStrikes: number;
  onReset: () => void;
  resetMessage?: string;
}

export default function FamilyFeudBoard({
  fen,
  topMoves,
  candidates,
  targetMoves,
  isDone,
  strikes,
  maxStrikes,
  onReset,
  resetMessage,
}: FamilyFeudBoardProps) {
  const [revealedMoves, setRevealedMoves] = useState<Set<string>>(new Set());
  const seenMoves = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(playSuccessJingle, 100);
    return () => clearTimeout(t);
  }, [isDone]);

  useEffect(() => {
    candidates.forEach((c) => {
      if (c.status === "pending" || seenMoves.current.has(c.move)) return;
      seenMoves.current.add(c.move);
      if (c.status === "hit") {
        setRevealedMoves((prev) => new Set([...prev, c.move]));
        SUCCESS_SOUND.currentTime = 0;
        SUCCESS_SOUND.play().catch(() => {});
      } else if (c.status === "miss") {
        FAILURE_SOUND.currentTime = 0;
        FAILURE_SOUND.play().catch(() => {});
      }
    });
  }, [candidates]);

  const hitMoves = candidates.filter((c) => c.status === "hit");
  const missMoves = candidates.filter((c) => c.status === "miss");
  const pending = candidates.some((c) => c.status === "pending");
  const isLoading = topMoves.length === 0 && !isDone;

  type Slot =
    | { loading: true; index: number }
    | (TopMove & { hit: Candidate | undefined; loading: false });

  const slots: Slot[] = isLoading
    ? Array.from({ length: targetMoves }).map((_, i) => ({
        loading: true as const,
        index: i,
      }))
    : topMoves.slice(0, targetMoves).map((m) => ({
        ...m,
        hit: hitMoves.find((c) => c.move === m.move),
        loading: false as const,
      }));

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted uppercase tracking-widest mb-0.5">
            Challenge
          </p>
          <h3 className="font-black text-xl text-text leading-tight">
            Find the Top <span className="text-yellow-400">{targetMoves}</span>{" "}
            Moves
          </h3>
        </div>
        <StrikeIndicator strikes={strikes} maxStrikes={maxStrikes} />
      </div>

      {/* Main board */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-faint uppercase tracking-widest">Top moves</p>
        {slots.map((slot, i) => {
          if (slot.loading) {
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4 bg-blue-950/40"
                style={{ borderLeftColor: "var(--color-edge)" }}
              >
                <span className="text-yellow-400/20 font-bold text-sm w-5 shrink-0">{i + 1}</span>
                <div
                  className="h-4 rounded-md bg-blue-900/60 animate-pulse flex-1"
                  style={{ maxWidth: `${88 + ((i * 29) % 64)}px`, animationDelay: `${i * 80}ms` }}
                />
                <div
                  className="h-3 w-10 rounded-md bg-blue-900/40 animate-pulse"
                  style={{ animationDelay: `${i * 80 + 120}ms` }}
                />
              </div>
            );
          }

          const m = slot as TopMove & { hit: Candidate | undefined; loading: false };
          const isRevealed = !!m.hit || isDone;
          const isNew = !!m.hit && revealedMoves.has(m.hit.move);
          const category = m.hit?.category ?? m.category ?? null;

          return (
            <MoveRowCard
              key={m.move}
              rank={i + 1}
              san={m.san}
              eval={m.eval}
              category={category}
              animate={isNew}
              isHit={!!m.hit}
              hidden={!isRevealed}
              startFen={fen}
              pvLine={m.line}
              showLine={isDone}
            />
          );
        })}
      </div>

      {/* Misses */}
      {missMoves.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint uppercase tracking-widest">Misses</p>
          <div className="flex flex-col gap-1.5">
            {missMoves.map((c) => (
              <MoveRowCard
                key={c.move}
                rank="miss"
                san={c.san}
                eval={c.eval ?? 0}
                category={c.category ?? null}
                pvLine={c.line}
                startFen={fen}
                showLine={isDone}
              />
            ))}
          </div>
        </div>
      )}

      {pending && (
        <p className="text-sm text-muted animate-pulse text-center tracking-wide">
          Evaluating...
        </p>
      )}

      {isDone && (
        <button
          onClick={onReset}
          className="w-full py-3 rounded-xl font-bold text-base bg-interactive hover:bg-interactive-hi transition-colors"
        >
          {resetMessage ?? "Start Over"}
        </button>
      )}
    </div>
  );
}
