import { useState, useEffect, useRef } from "react";
import type { TopMove, Candidate } from "../types";
import MoveRowCard from "./MoveRowCard";
import {
  playSuccessJingle,
  playSuccessSound,
  playFailureSound,
} from "../utils/sounds";
import { StrikeIndicator } from "./PipsAndStrikes";
import { getMoveCategory } from "../utils/chess";

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
  /** Mobile context: hides the header and misses section since GameLayout
   *  renders StrikesPipsBar and GuessList above/below the board instead. */
  isMobile?: boolean;
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
  isMobile = false,
}: FamilyFeudBoardProps) {
  const [revealedMoves, setRevealedMoves] = useState<Set<string>>(new Set());
  const seenMoves = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(playSuccessJingle);
    return () => clearTimeout(t);
  }, [isDone]);

  useEffect(() => {
    candidates.forEach((c) => {
      if (c.status === "pending" || seenMoves.current.has(c.move)) return;
      seenMoves.current.add(c.move);
      if (c.status === "hit") {
        setRevealedMoves((prev) => new Set([...prev, c.move]));
        playSuccessSound();
      } else if (c.status === "miss") {
        playFailureSound();
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
      {!isMobile && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest mb-0.5">
              Challenge
            </p>
            <h3 className="font-black text-xl text-text leading-tight">
              Find the Top{" "}
              <span className="text-yellow-400">{targetMoves}</span> Moves
            </h3>
          </div>
          <StrikeIndicator strikes={strikes} maxStrikes={maxStrikes} />
        </div>
      )}

      {/* Main board */}
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-faint uppercase tracking-widest">
          Top moves
        </p>
        {slots.map((slot, i) => {
          if (slot.loading) {
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4 bg-blue-950/40"
                style={{ borderLeftColor: "var(--color-edge)" }}
              >
                <span className="text-yellow-400/20 font-bold text-sm w-5 shrink-0">
                  {i + 1}
                </span>
                <div
                  className="h-4 rounded-md bg-blue-900/60 animate-pulse flex-1"
                  style={{
                    maxWidth: `${88 + ((i * 29) % 64)}px`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
                <div
                  className="h-3 w-10 rounded-md bg-blue-900/40 animate-pulse"
                  style={{ animationDelay: `${i * 80 + 120}ms` }}
                />
              </div>
            );
          }

          const m = slot as TopMove & {
            hit: Candidate | undefined;
            loading: false;
          };
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

      {/* Misses — hidden on mobile since GuessList already shows them */}
      {!isMobile && missMoves.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 group relative">
            <p className="text-xs text-faint uppercase tracking-widest">
              Misses
            </p>
            <span className="text-xs text-faint/40 leading-none">ⓘ</span>
            {/* Tooltip — visible on hover of the misses header */}
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              <div className="rounded-lg border border-surface-hi bg-surface p-3 shadow-xl text-xs text-muted leading-relaxed">
                <p className="font-semibold text-label mb-1">
                  About miss evaluations
                </p>
                <p>
                  Evaluations for missed moves are estimated by your browser's
                  local engine and may not perfectly match the server's
                  pre-computed analysis, which runs at a higher depth on native
                  hardware.
                </p>
                <p className="mt-1.5">
                  If a missed move appeared suspiciously strong, its eval is
                  capped to the weakest pre-computed top move and marked with{" "}
                  <span className="font-mono text-label">&gt;</span> or{" "}
                  <span className="font-mono text-label">&lt;</span> to indicate
                  the true ranking is likely worse.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {(() => {
              const floorEval = topMoves[topMoves.length - 1]?.eval ?? null;
              const isBlackToMove = fen.includes(" b ");
              const positionEval = topMoves[0]?.rawEval ?? 0;
              const bestEval = topMoves[0]?.rawEval ?? 0;
              const capSign: "<" | ">" = isBlackToMove ? ">" : "<";
              return missMoves.map((c) => {
                const missEval = c.eval ?? 0;
                const isPrecomputed = topMoves.some((m) => m.move === c.move);
                const appearsTooGood =
                  floorEval !== null &&
                  (isBlackToMove ? missEval < floorEval : missEval > floorEval);
                const shouldCap = !isPrecomputed && appearsTooGood;
                const displayEval = shouldCap ? floorEval : missEval;
                const displayCategory = shouldCap
                  ? getMoveCategory(
                      positionEval,
                      floorEval!,
                      isBlackToMove,
                      bestEval,
                    )
                  : (c.category ?? null);
                return (
                  <MoveRowCard
                    key={c.move}
                    rank="miss"
                    san={c.san}
                    eval={displayEval}
                    evalCapSign={shouldCap ? capSign : undefined}
                    category={displayCategory}
                    pvLine={c.line}
                    startFen={fen}
                    showLine={isDone}
                  />
                );
              });
            })()}
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
          className="w-full py-3 rounded-xl font-bold text-base bg-accent hover:bg-accent-hi text-white transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40"
        >
          {resetMessage ?? "Start Over"}
        </button>
      )}
    </div>
  );
}
