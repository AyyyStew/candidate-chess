import React from "react";
import { formatEval } from "../utils/chess";

export default function ResultsPanel({ results, positionEval }) {
  const best = results.topMoves[0]?.eval ?? 0;

  // build a set of candidate moves for quick lookup
  const candidateMoves = new Set(results.candidates.map((c) => c.move));

  return (
    <div>
      {/* Position eval card */}

      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Stockfish Top Moves
      </h3>
      <div className="mb-4 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Position Evaluation Before Move
        </span>
        <span className="font-bold text-lg">{formatEval(positionEval)}</span>
      </div>

      <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 text-left font-medium"></th>

              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Move</th>
              <th className="px-4 py-2 text-left font-medium">Eval</th>
              <th className="px-4 py-2 text-left font-medium">Δ Best</th>
              <th className="px-4 py-2 text-left font-medium">Δ Position</th>
            </tr>
          </thead>
          <tbody>
            {results.topMoves.map((m, i) => {
              const diff = m.eval - best;
              const diffPos = m.eval - positionEval;
              const isCandidate = candidateMoves.has(m.move);

              return (
                <tr
                  key={i}
                  className={`border-t border-gray-100 dark:border-gray-800
                    ${i === 0 ? "bg-green-50 dark:bg-green-950" : "bg-white dark:bg-gray-900"}
                    ${isCandidate ? "ring-2 ring-inset ring-blue-400 dark:ring-blue-600" : ""}`}
                >
                  <td className="px-4 py-2.5 text-gray-400">
                    {" "}
                    {isCandidate && (
                      <span className="text-xs font-bold rounded-full">
                        Your pick
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-bold flex items-center gap-2">
                    {m.san}
                  </td>
                  <td className="px-4 py-2.5 text-green-600 dark:text-green-400 font-medium">
                    {formatEval(m.eval)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {formatEval(diff)}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">
                    {formatEval(diffPos)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
