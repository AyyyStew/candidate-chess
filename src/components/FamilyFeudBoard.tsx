import React, { useState, useEffect } from "react";
import { formatEval } from "../utils/chess";
import type { TopMove, Candidate, Category, PVLine } from "../types";
import PvLine from "./PvLine";

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

interface RevealedRowProps {
  rank: number;
  san: string;
  evalScore: number;
  category: Category | null;
  animate: boolean;
  wasGuessed: boolean;
  hidden: boolean;
  startFen: string;
  line: PVLine;
  showLine: boolean;
}

function RevealedRow({
  rank,
  san,
  evalScore,
  category,
  animate,
  wasGuessed,
  hidden,
  startFen,
  line,
  showLine,
}: RevealedRowProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (hidden) return;
    if (animate) {
      const t = setTimeout(() => setFlipped(true), 60);
      return () => clearTimeout(t);
    } else {
      setFlipped(true);
    }
  }, [animate, hidden]);

  const isRevealed = !hidden && flipped;

  const rowStyle =
    wasGuessed && flipped
      ? {
          background: `linear-gradient(90deg, ${category?.color}30 0%, ${category?.color}14 55%, ${category?.color}06 100%)`,
          borderLeft: `5px solid ${category?.color}`,
        }
      : { borderLeft: "5px solid transparent" };

  // Unrevealed — board is ready, move is just hidden
  if (hidden) {
    return (
      <tr
        className="border-t border-edge"
        style={{ borderLeft: "5px solid transparent" }}
      >
        <td className="pl-5 pr-3 py-4">
          <span className="text-2xl font-black text-yellow-400/50">{rank}</span>
        </td>
        <td
          className="px-4 py-4 font-black text-xl text-muted/30 tracking-widest"
          colSpan={3}
        >
          · · ·
        </td>
      </tr>
    );
  }

  return (
    <React.Fragment>
      <tr
        className="border-t border-edge transition-colors duration-500"
        style={rowStyle}
      >
        {/* Rank */}
        <td className="pl-5 pr-3 py-4">
          <span
            className={`font-black transition-all duration-500 ${
              wasGuessed && flipped
                ? "text-yellow-400 text-2xl"
                : "text-yellow-400/50 text-xl"
            }`}
          >
            {rank}
          </span>
        </td>

        {/* Move — flip card for animated reveal, plain text otherwise */}
        <td className="px-4 py-4 w-36">
          {animate ? (
            <div className="flip-card" style={{ height: "32px" }}>
              <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
                <div className="flip-card-front">
                  <div className="h-5 w-28 rounded-md bg-surface-hi/50 " />
                </div>
                <div className="flip-card-back">
                  <span className="font-black text-xl">{san}</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="font-black text-xl">{san}</span>
          )}
        </td>

        {/* Category — pops in after flip */}
        <td className="px-4 py-4">
          {isRevealed && category && (
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold ${animate ? "animate-reveal-pop" : ""}`}
              style={{
                color: category.color,
                ...(animate ? { animationDelay: "400ms" } : {}),
              }}
            >
              <span className="text-base">{category.icon}</span>
              <span>{category.label}</span>
            </span>
          )}
        </td>

        {/* Eval */}
        <td className="px-4 pr-5 py-4 text-right">
          {isRevealed && (
            <span
              className={`text-sm font-mono text-muted ${animate ? "animate-reveal-pop" : ""}`}
              style={animate ? { animationDelay: "460ms" } : {}}
            >
              {formatEval(evalScore)}
            </span>
          )}
        </td>
      </tr>

      {isRevealed && showLine && line.sans.length > 0 && (
        <tr style={rowStyle}>
          <td />
          <td
            colSpan={3}
            className="px-4 pt-0.5 pb-3 text-xs font-mono text-faint"
          >
            <PvLine startFen={startFen} sans={line.sans} />
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

interface MissRowProps {
  san: string;
  evalScore: number;
  category: Category | null;
  line?: PVLine;
  startFen: string;
  isDone: boolean;
}

function MissRow({
  san,
  evalScore,
  category,
  line,
  startFen,
  isDone,
}: MissRowProps) {
  const rowStyle = { borderTop: "1px solid rgba(185, 28, 28, 0.5)" };
  return (
    <React.Fragment>
      <tr style={rowStyle} className="bg-red-950/80 animate-slide-in">
        <td className="pl-5 pr-3 py-4">
          <span className="text-red-400 font-black text-2xl leading-none">
            ✗
          </span>
        </td>
        <td className="px-4 py-4 font-black text-lg text-label">{san}</td>
        <td
          className="px-4 py-4 text-sm font-semibold"
          style={{ color: category?.color }}
        >
          {category?.label}
        </td>
        <td className="px-4 pr-5 py-4 text-sm text-muted text-right">
          {formatEval(evalScore)}
        </td>
      </tr>
      {isDone && line && line.sans.length > 0 && (
        <tr style={rowStyle} className="bg-red-950/80">
          <td />
          <td
            colSpan={3}
            className="px-4 pt-0.5 pb-3 text-xs font-mono text-faint"
          >
            <PvLine startFen={startFen} sans={line.sans} />
          </td>
        </tr>
      )}
    </React.Fragment>
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

  useEffect(() => {
    candidates.forEach((c) => {
      if (!c.pending && c.isHit && !revealedMoves.has(c.move)) {
        setRevealedMoves((prev) => new Set([...prev, c.move]));
      }
    });
  }, [candidates]);

  const hitMoves = candidates.filter((c) => !c.pending && c.isHit);
  const missMoves = candidates.filter((c) => !c.pending && c.isMiss);
  const pending = candidates.some((c) => c.pending);
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
      <div className="rounded-xl overflow-hidden border border-edge-hi shadow-xl shadow-black/50">
        <table className="w-full">
          <thead className="bg-surface-hi border-b border-edge-hi">
            <tr>
              <th className="pl-5 pr-3 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest w-12">
                #
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">
                Move
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-muted uppercase tracking-widest">
                Quality
              </th>
              <th className="px-4 pr-5 py-3 text-right text-xs font-bold text-muted uppercase tracking-widest">
                Eval
              </th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, i) => {
              if (slot.loading) {
                return (
                  <tr
                    key={i}
                    className="border-t border-edge bg-blue-950/40"
                    style={{ borderLeft: "5px solid transparent" }}
                  >
                    <td className="pl-5 pr-3 py-4">
                      <span className="text-xl font-black text-yellow-400/20">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-4" colSpan={3}>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-5 rounded-md bg-blue-900/60 animate-pulse"
                          style={{
                            width: `${88 + ((i * 29) % 64)}px`,
                            animationDelay: `${i * 80}ms`,
                          }}
                        />
                        <div
                          className="ml-auto h-4 w-12 rounded-md bg-blue-900/40 animate-pulse"
                          style={{ animationDelay: `${i * 80 + 120}ms` }}
                        />
                      </div>
                    </td>
                  </tr>
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
                <RevealedRow
                  key={m.move}
                  rank={i + 1}
                  san={m.san}
                  evalScore={m.eval}
                  category={category}
                  animate={isNew}
                  wasGuessed={!!m.hit}
                  hidden={!isRevealed}
                  startFen={fen}
                  line={m.line}
                  showLine={isDone}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Misses */}
      {missMoves.length > 0 && (
        <div>
          <h4 className="text-xs text-red-400/70 uppercase tracking-widest font-bold mb-2">
            Misses
          </h4>
          <div className="rounded-xl overflow-hidden border border-red-900/60 shadow-lg shadow-red-950/30">
            <table className="w-full divide-y divide-red-900/40">
              <tbody>
                {missMoves.map((c) => (
                  <MissRow
                    key={c.move}
                    san={c.san}
                    evalScore={c.eval ?? 0}
                    category={c.category ?? null}
                    line={c.line}
                    startFen={fen}
                    isDone={isDone}
                  />
                ))}
              </tbody>
            </table>
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
