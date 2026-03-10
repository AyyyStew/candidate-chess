import React from "react";
import { formatEval } from "../utils/chess";

export default function ResultsPanel({ results, onReset }) {
  return (
    <div>
      <h3 style={{ margin: "0 0 8px" }}>Stockfish Top Moves</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {results.topMoves.map((m, i) => (
          <li key={i} style={{ padding: "4px 0" }}>
            {i + 1}. {m.san}
            <span style={{ marginLeft: 12, color: "#4caf50" }}>
              {formatEval(m.eval)}
            </span>
          </li>
        ))}
      </ul>

      <button onClick={onReset} style={{ marginTop: 16 }}>
        Start Over
      </button>
    </div>
  );
}
