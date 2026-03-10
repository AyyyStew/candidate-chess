import React from "react";
import { formatEval, evalColor } from "../utils/chess";

const CANDIDATE_LIMIT = 3;

function getStockfishRank(move, topMoves) {
  const idx = topMoves.findIndex((m) => m.move === move);
  return idx === -1 ? null : idx + 1;
}

function borderColor(diff) {
  if (diff >= -0.3) return "border-green-500 dark:border-green-400";
  if (diff >= -1.0) return "border-orange-400 dark:border-orange-300";
  return "border-red-500 dark:border-red-400";
}

export default function CandidateList({
  candidates,
  results,
  bestEval,
  positionEval,
  candidateLimit,
}) {
  const isDone = !!results;
  const displayList = results?.candidates ?? candidates;

  return (
    <div>
      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Your Candidates ({candidates.length} / {candidateLimit})
      </h3>

      {candidates.length === 0 && (
        <p className="text-gray-400 text-sm">Drag a piece to try a move</p>
      )}

      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Move</th>
              {isDone && (
                <>
                  <th className="px-4 py-2 text-left font-medium">Eval</th>
                  <th className="px-4 py-2 text-left font-medium">Δ Best</th>
                  <th className="px-4 py-2 text-left font-medium">
                    Δ Position
                  </th>
                  <th className="px-4 py-2 text-left font-medium">SF Rank</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayList.map((c, i) => {
              const diff = (c.eval ?? 0) - bestEval;
              const diffPos = (c.eval ?? 0) - positionEval;
              const rank = isDone
                ? getStockfishRank(c.move, results.topMoves)
                : null;

              return (
                <tr
                  key={i}
                  className={`border-l-4 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900
    ${isDone ? borderColor(diff) : ""}`}
                >
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold">{c.san}</td>
                  {isDone && (
                    <>
                      <td
                        className="px-4 py-2.5 font-medium"
                        style={{ color: evalColor(diff) }}
                      >
                        {formatEval(c.eval)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {formatEval(diff)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {formatEval(diffPos)}
                      </td>
                      <td className="px-4 py-2.5">
                        {rank && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                            #{rank}
                          </span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
