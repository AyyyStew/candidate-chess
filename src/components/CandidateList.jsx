import React from "react";
import { formatEval } from "../utils/chess";

export default function CandidateList({ candidates, results, candidateLimit }) {
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
                  <th className="px-4 py-2 text-left font-medium">Category</th>
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
              const rank = isDone
                ? results.topMoves.findIndex((m) => m.move === c.move) + 1 ||
                  null
                : null;

              return (
                <tr
                  key={i}
                  className="border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
                  style={{
                    borderLeft: isDone
                      ? `4px solid ${c.category?.color}`
                      : "4px solid transparent",
                  }}
                >
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold">{c.san}</td>

                  {isDone && (
                    <>
                      <td className="px-4 py-2.5">
                        <span
                          className="flex items-center gap-1.5 font-medium"
                          style={{ color: c.category?.color }}
                        >
                          <span className="text-base leading-none">
                            {c.category?.icon}
                          </span>
                          <span>{c.category?.label}</span>
                        </span>
                      </td>
                      <td
                        className="px-4 py-2.5 font-medium"
                        style={{ color: c.category?.color }}
                      >
                        {formatEval(c.eval)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {formatEval(c.diffBest)}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400">
                        {formatEval(c.diffPos)}
                      </td>
                      <td className="px-4 py-2.5">
                        {rank > 0 && (
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
