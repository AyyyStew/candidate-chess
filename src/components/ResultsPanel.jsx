import React from "react";
import { formatEval } from "../utils/chess";

export default function ResultsPanel({ results, onReset }) {
  const { topMoves, positionEval, bestEval, candidates } = results;
  const candidateMoves = new Set(candidates.map((c) => c.move));

  return (
    <div>
      {/* Position eval */}
      <div className="mb-4 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Position Eval
        </span>
        <span className="font-bold text-lg">{formatEval(positionEval)}</span>
      </div>

      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Stockfish Top Moves
      </h3>

      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Move</th>
              <th className="px-4 py-2 text-left font-medium">Eval</th>
              <th className="px-4 py-2 text-left font-medium">Δ Best</th>
              <th className="px-4 py-2 text-left font-medium">Δ Position</th>
            </tr>
          </thead>
          <tbody>
            {topMoves.map((m, i) => {
              const isCandidate = candidateMoves.has(m.move);
              return (
                <tr
                  key={i}
                  className={`border-t border-gray-100 dark:border-gray-800
        ${i === 0 ? "bg-green-50 dark:bg-green-950" : "bg-white dark:bg-gray-900"}
        ${isCandidate ? "ring-2 ring-inset ring-blue-400 dark:ring-blue-500" : ""}`}
                >
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold">
                    <span className="flex items-center gap-2">
                      {m.san}
                      {isCandidate && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                          Your pick
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">
                    {formatEval(m.eval)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {formatEval(m.diffBest)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {formatEval(m.diffPos)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        onClick={onReset}
        className="mt-4 w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
      >
        Start Over
      </button>
    </div>
  );
}
