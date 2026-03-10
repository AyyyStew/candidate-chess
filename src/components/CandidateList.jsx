import React from "react";
import { formatEval, evalColor } from "../utils/chess";

const CANDIDATE_LIMIT = 3;

export default function CandidateList({ candidates, results, bestEval }) {
  const isDone = !!results;

  // Use results.candidates (has evals) when available, else plain candidates
  const displayList = results?.candidates ?? candidates;

  return (
    <div>
      <h3 style={{ margin: "0 0 8px" }}>
        Your Candidates ({candidates.length} / {CANDIDATE_LIMIT})
      </h3>

      {candidates.length === 0 && (
        <p style={{ color: "#888" }}>Drag a piece to try a move</p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {displayList.map((c, i) => {
          const diff = (c.eval ?? 0) - bestEval;
          return (
            <li key={i} style={{ padding: "4px 0" }}>
              {i + 1}. {c.san}
              {isDone && c.eval !== undefined && (
                <span style={{ marginLeft: 12, color: evalColor(diff) }}>
                  {formatEval(c.eval)} ({formatEval(diff)} vs best)
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
