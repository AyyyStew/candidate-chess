import React from "react";
import { formatEval, evalColor } from "../utils/chess";

const CANDIDATE_LIMIT = 3;

function getStockfishRank(move, topMoves) {
  const idx = topMoves.findIndex((m) => m.move === move);
  return idx === -1 ? null : idx + 1;
}

function borderColor(diff) {
  if (diff >= -0.3) return "border-green-500";
  if (diff >= -1.0) return "border-orange-400";
  return "border-red-500";
}

export default function CandidateList({ candidates, results, bestEval }) {
  const isDone = !!results;
  const displayList = results?.candidates ?? candidates;

  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Your Candidates ({candidates.length} / {CANDIDATE_LIMIT})
      </h3>

      {candidates.length === 0 && (
        <p className="text-gray-400 text-sm">Drag a piece to try a move</p>
      )}

      <ul className="flex flex-col gap-2">
        {displayList.map((c, i) => {
          const diff = (c.eval ?? 0) - bestEval;
          const rank = isDone
            ? getStockfishRank(c.move, results.topMoves)
            : null;

          return (
            <li
              key={i}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-l-4 bg-white dark:bg-gray-900 shadow-sm
                ${isDone ? borderColor(diff) : "border-gray-300 dark:border-gray-700"}`}
            >
              <span className="text-gray-400 text-sm w-5">{i + 1}.</span>
              <span className="font-bold text-lg">{c.san}</span>

              {rank && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                  #{rank} Stockfish
                </span>
              )}

              {isDone && c.eval !== undefined && (
                <span
                  className="ml-auto text-sm font-medium"
                  style={{ color: evalColor(diff) }}
                >
                  {formatEval(c.eval)}
                  <span className="text-gray-400 font-normal ml-1.5">
                    ({formatEval(diff)} vs best)
                  </span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
