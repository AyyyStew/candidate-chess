import React, { useState, useEffect } from "react";
import { formatEval } from "../utils/chess";

function StrikeIndicator({ strikes, maxStrikes }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: maxStrikes }).map((_, i) => (
        <div
          key={i}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-colors
            ${
              i < strikes
                ? "bg-red-500 border-red-500 text-white"
                : "border-gray-300 dark:border-gray-600 text-transparent"
            }`}
        >
          X
        </div>
      ))}
    </div>
  );
}

function HiddenRow({ rank }) {
  return (
    <tr className="border-t border-gray-100 dark:border-gray-800 bg-blue-950">
      <td className="px-4 py-3 text-yellow-400 font-bold w-8">{rank}</td>
      <td className="px-4 py-3 font-mono text-blue-400 tracking-widest">
        — — —
      </td>
      <td className="px-4 py-3" />
      <td className="px-4 py-3" />
    </tr>
  );
}

function RevealedRow({ rank, san, evalScore, category, diffBest, animate }) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setFlipped(true), 50);
      return () => clearTimeout(t);
    } else {
      setFlipped(true);
    }
  }, [animate]);

  return (
    <tr
      className="border-t border-gray-100 dark:border-gray-800 transition-all duration-500"
      style={{
        backgroundColor: flipped
          ? (category?.color + "22" ?? "#22c55e22")
          : "#1e3a5f",
        borderLeft: flipped
          ? `4px solid ${category?.color ?? "#22c55e"}`
          : "4px solid transparent",
        opacity: flipped ? 1 : 0.3,
      }}
    >
      <td className="px-4 py-3 text-yellow-400 font-bold w-8">{rank}</td>
      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
        {flipped ? san : "— — —"}
      </td>
      <td
        className="px-4 py-3 text-sm font-medium"
        style={{ color: category?.color }}
      >
        {flipped ? (category?.label ?? "") : ""}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 text-right">
        {flipped ? formatEval(evalScore) : ""}
      </td>
    </tr>
  );
}

function MissRow({ san, evalScore, category }) {
  return (
    <tr className="border-t border-red-900 bg-red-950 animate-slide-in">
      <td className="px-4 py-3 text-red-500 font-bold text-lg">✗</td>
      <td className="px-4 py-3 font-bold text-gray-300">{san}</td>
      <td
        className="px-4 py-3 text-sm font-medium"
        style={{ color: category?.color }}
      >
        {category?.label}
      </td>
      <td className="px-4 py-3 text-sm text-gray-400 text-right">
        {formatEval(evalScore)}
      </td>
    </tr>
  );
}

export default function FamilyFeudBoard({
  topMoves,
  candidates,
  targetMoves,
  isDone,
  strikes,
  maxStrikes,
  onReset,
}) {
  const [revealedMoves, setRevealedMoves] = useState(new Set());

  // track newly revealed moves for animation
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

  // map top moves with their candidate hit if found
  const slots = topMoves.slice(0, targetMoves).map((m) => {
    const hit = hitMoves.find((c) => c.move === m.move);
    return { ...m, hit };
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Find the Top {targetMoves} Moves
        </h3>
        <StrikeIndicator strikes={strikes} maxStrikes={maxStrikes} />
      </div>

      {/* Engine still loading */}
      {topMoves.length === 0 && (
        <p className="text-sm text-gray-400 animate-pulse">
          Engine analyzing position...
        </p>
      )}

      {/* Main board table */}
      {topMoves.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left font-medium w-8">#</th>
                <th className="px-4 py-2 text-left font-medium">Move</th>
                <th className="px-4 py-2 text-left font-medium">Quality</th>
                <th className="px-4 py-2 text-right font-medium">Eval</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((m, i) => {
                const isRevealed = !!m.hit || isDone;
                const isNew = !!m.hit && revealedMoves.has(m.hit?.move);
                const category = m.hit?.category ?? null;

                if (isRevealed) {
                  return (
                    <RevealedRow
                      key={m.move}
                      rank={i + 1}
                      san={m.san}
                      evalScore={m.eval}
                      category={category}
                      diffBest={m.diffBest}
                      animate={isNew}
                    />
                  );
                }
                return <HiddenRow key={m.move} rank={i + 1} />;
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Miss rows */}
      {missMoves.length > 0 && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
            Not in top {targetMoves}
          </h4>
          <div className="rounded-xl overflow-hidden border border-red-900">
            <table className="w-full text-sm">
              <tbody>
                {missMoves.map((c) => (
                  <MissRow
                    key={c.move}
                    san={c.san}
                    evalScore={c.eval}
                    category={c.category}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending */}
      {pending && (
        <p className="text-sm text-gray-400 animate-pulse text-center">
          Evaluating...
        </p>
      )}

      {/* Reset button when done */}
      {isDone && (
        <button
          onClick={onReset}
          className="w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          Start Over
        </button>
      )}
    </div>
  );
}
