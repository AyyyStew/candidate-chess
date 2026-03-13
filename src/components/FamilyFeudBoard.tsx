import React, { useState, useEffect } from "react";
import { formatEval } from "../utils/chess";

function StrikeIndicator({ strikes, maxStrikes }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: maxStrikes }).map((_, i) => {
        const lost = i < strikes;
        return (
          <span
            key={i}
            className="text-2xl transition-all duration-300"
            style={{
              opacity: lost ? 0.15 : 1,
              transform: lost ? "scale(0.8)" : "scale(1)",
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

function BoardRow({
  rank,
  san,
  evalScore,
  category,
  animate,
  wasGuessed,
  hidden,
  loading,
}) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!hidden && !loading) {
      if (animate) {
        const t = setTimeout(() => setFlipped(true), 50);
        return () => clearTimeout(t);
      } else {
        setFlipped(true);
      }
    }
  }, [animate, hidden, loading]);

  if (loading) {
    return (
      <tr className="border-t border-gray-100 dark:border-gray-800 bg-blue-950">
        <td className="px-4 py-3 text-yellow-400 font-bold w-8">{rank}</td>
        <td className="px-4 py-3" colSpan={3}>
          <div className="h-4 w-24 rounded bg-gray-700 animate-pulse" />
        </td>
      </tr>
    );
  }

  if (hidden) {
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

  return (
    <tr
      className="border-t border-gray-100 dark:border-gray-800 transition-all duration-500"
      style={{
        backgroundColor:
          wasGuessed && flipped ? category?.color + "22" : undefined,
        borderLeft:
          wasGuessed && flipped
            ? `4px solid ${category?.color}`
            : "4px solid transparent",
      }}
    >
      <td className="px-4 py-3 text-yellow-400 font-bold w-8">{rank}</td>
      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
        {flipped ? san : "— — —"}
      </td>
      <td
        className="px-4 py-3 text-sm font-medium"
        style={{ color: wasGuessed ? category?.color : "#6b7280" }}
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
    <tr
      style={{ borderTop: "1px solid rgba(185, 28, 28, 0.6)" }}
      className="bg-red-950 animate-slide-in"
    >
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

const TABLE_HEAD = (
  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
    <tr>
      <th className="px-4 py-2 text-left font-medium w-8">#</th>
      <th className="px-4 py-2 text-left font-medium">Move</th>
      <th className="px-4 py-2 text-left font-medium">Quality</th>
      <th className="px-4 py-2 text-right font-medium">Eval</th>
    </tr>
  </thead>
);

export default function FamilyFeudBoard({
  topMoves,
  candidates,
  targetMoves,
  isDone,
  strikes,
  maxStrikes,
  onReset,
  resetMessage,
}) {
  const [revealedMoves, setRevealedMoves] = useState(new Set());

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
  const loading = topMoves.length === 0;

  const slots = topMoves.slice(0, targetMoves).map((m) => {
    const hit = hitMoves.find((c) => c.move === m.move);
    return { ...m, hit };
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Find the Top {targetMoves} Moves
        </h3>
        <StrikeIndicator strikes={strikes} maxStrikes={maxStrikes} />
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          {TABLE_HEAD}
          <tbody>
            {loading
              ? Array.from({ length: targetMoves }).map((_, i) => (
                  <BoardRow key={i} rank={i + 1} loading />
                ))
              : slots.map((m, i) => {
                  const isRevealed = !!m.hit || isDone;
                  const isNew = !!m.hit && revealedMoves.has(m.hit?.move);
                  const category = m.hit?.category ?? m.category ?? null;
                  return (
                    <BoardRow
                      key={m.move}
                      rank={i + 1}
                      san={m.san}
                      evalScore={m.eval}
                      category={category}
                      animate={isNew}
                      wasGuessed={m.hit}
                      hidden={!isRevealed}
                    />
                  );
                })}
          </tbody>
        </table>
      </div>

      {missMoves.length > 0 && (
        <div>
          <h4 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
            Misses
          </h4>
          <div className="rounded-xl overflow-hidden border border-red-900">
            <table className="w-full text-sm divide-y divide-red-500">
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

      {pending && (
        <p className="text-sm text-gray-400 animate-pulse text-center">
          Evaluating...
        </p>
      )}

      {isDone && (
        <button
          onClick={onReset}
          className="w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {resetMessage ?? "Start Over"}
        </button>
      )}
    </div>
  );
}
