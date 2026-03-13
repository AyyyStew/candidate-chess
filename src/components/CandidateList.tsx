import React from "react";
import { formatEval } from "../utils/chess";
import type { Candidate, AnalysisResult, TopMove } from "../types";

function getStockfishRank(move: string, topMoves: TopMove[]): number | null {
  const idx = topMoves.findIndex((m) => m.move === move);
  return idx === -1 ? null : idx + 1;
}

interface CandidateListProps {
  candidates: Candidate[];
  results: AnalysisResult | null;
  onRemove: ((uci: string) => void) | null;
}

export default function CandidateList({
  candidates,
  results,
  onRemove,
}: CandidateListProps) {
  const isDone = !!results;
  const displayList = results?.candidates ?? candidates;
  const isThinking = !isDone && candidates.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Your Candidates
        </h3>
      </div>
      {candidates.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 text-center">
          <p className="text-gray-400 text-sm">Drag a piece to try a move</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {displayList.map((c, i) => {
          const rank = isDone
            ? getStockfishRank(c.move, results!.topMoves)
            : null;
          const category = isDone ? c.category : null;
          return (
            <div
              key={c.move}
              className={`animate-slide-in flex flex-col px-4 py-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 ${isDone ? "border-l-4" : ""} ${isThinking ? "animate-pulse" : ""}`}
              style={{
                borderLeftColor:
                  isDone && category ? category.color : undefined,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm w-4 shrink-0">
                  {i + 1}
                </span>
                <span className="font-bold text-lg">{c.san}</span>
                {rank && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                    #{rank} SF
                  </span>
                )}
                {isDone && category && (
                  <span
                    className="flex items-center gap-1 text-sm font-medium"
                    style={{ color: category.color }}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </span>
                )}
                {isDone && c.eval !== undefined && (
                  <span className="ml-auto flex flex-col items-end text-sm">
                    <span
                      className="font-semibold"
                      style={{ color: category?.color }}
                    >
                      {formatEval(c.eval)}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {formatEval(c.diffBest)} ΔBest
                    </span>
                  </span>
                )}
                {!isDone && onRemove && (
                  <button
                    onClick={() => onRemove(c.move)}
                    className="ml-auto text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              {isDone && c.line && c.line.sans.length > 0 && (
                <span className="mt-1 pl-7 text-xs font-mono text-gray-400 dark:text-gray-500">
                  <span className="text-gray-300 dark:text-gray-600 mr-1">
                    line:
                  </span>
                  {c.line.sans.slice(0, 5).join(" ")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
