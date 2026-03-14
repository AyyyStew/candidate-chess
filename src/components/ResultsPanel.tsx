import React, { useState } from "react";
import { Chess } from "chess.js";
import { formatEval } from "../utils/chess";
import type { AnalysisResult } from "../types";
import PvLine from "./PvLine";
import { useBoard } from "../contexts/BoardContext";

const DEFAULT_VISIBLE = 5;

interface ResultsPanelProps {
  results: AnalysisResult;
  onReset: () => void;
}

export default function ResultsPanel({ results, onReset }: ResultsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { showPreviewFen } = useBoard();
  const { topMoves, positionEval, candidates } = results;

  function getFenAfterMove(uci: string): string | null {
    try {
      const g = new Chess(results.fen);
      g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? "q" });
      return g.fen();
    } catch {
      return null;
    }
  }
  const candidateMoves = new Set(candidates.map((c) => c.move));
  const visibleMoves = expanded ? topMoves : topMoves.slice(0, DEFAULT_VISIBLE);
  const hasMore = topMoves.length > DEFAULT_VISIBLE;

  return (
    <div>
      <h3 className="font-semibold text-sm text-muted uppercase tracking-wide mb-3">
        Stockfish Top Moves
      </h3>
      <div className="border-l-4 border-edge-hi mb-4 px-4 py-3 rounded-xl bg-surface flex items-center justify-between">
        <span className="text-sm text-muted font-medium">Position Eval</span>
        <span className="font-bold text-lg">{formatEval(positionEval)}</span>
      </div>
      <div className="rounded-xl overflow-hidden border border-edge">
        <table className="w-full text-sm">
          <thead className="bg-surface-hi text-muted">
            <tr>
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Move</th>
              <th className="px-4 py-2 text-left font-medium">Quality</th>
              <th className="px-4 py-2 text-left font-medium">Eval</th>
              <th className="px-4 py-2 text-left font-medium">Δ Best</th>
              <th className="px-4 py-2 text-left font-medium">Δ Position</th>
            </tr>
          </thead>
          <tbody>
            {visibleMoves.map((m, i) => {
              const isCandidate = candidateMoves.has(m.move);
              const rowStyle = {
                borderLeft:
                  isCandidate && m.category
                    ? `4px solid ${m.category.color}`
                    : `4px solid transparent`,
                backgroundColor:
                  isCandidate && m.category?.color
                    ? `${m.category.color}22`
                    : undefined,
              };
              const rowBase = isCandidate ? "" : "bg-surface";
              const line = m.line.sans.slice(0, 5).join(" ");
              return (
                <React.Fragment key={i}>
                  <tr
                    className={`border-t border-edge ${rowBase}`}
                    style={rowStyle}
                  >
                    <td className="px-4 pt-2.5 pb-0 text-muted">{i + 1}</td>
                    <td className="px-4 pt-2.5 pb-0 font-bold">
                      <button
                        className="hover:text-blue-400 transition-colors"
                        onClick={() => { const f = getFenAfterMove(m.move); if (f) showPreviewFen(f); }}
                      >
                        {m.san}
                      </button>
                    </td>
                    <td
                      className="px-4 pt-2.5 pb-0 text-sm font-medium"
                      style={{ color: m.category?.color }}
                    >
                      {m.category && (
                        <span className="flex items-center gap-1">
                          <span>{m.category.icon}</span>
                          <span>{m.category.label}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 pt-2.5 pb-0 text-green-400 font-medium">
                      {formatEval(m.eval)}
                    </td>
                    <td className="px-4 pt-2.5 pb-0 text-muted">
                      {formatEval(m.diffBest)}
                    </td>
                    <td className="px-4 pt-2.5 pb-0 text-muted">
                      {formatEval(m.diffPos)}
                    </td>
                  </tr>
                  {line && (
                    <tr className={`${rowBase}`} style={rowStyle}>
                      <td />
                      <td
                        colSpan={5}
                        className="px-4 pt-0.5 pb-2 text-xs font-mono text-faint"
                      >
                        <PvLine startFen={results.fen} sans={m.line.sans} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {hasMore && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="w-full py-2 text-sm text-muted hover:text-label bg-surface-hi hover:bg-interactive-hi transition-colors border-t border-edge-hi"
          >
            {expanded
              ? "▲ Show less"
              : `▼ Show ${topMoves.length - DEFAULT_VISIBLE} more moves`}
          </button>
        )}
      </div>
      <button
        onClick={onReset}
        className="mt-4 w-full py-2.5 rounded-xl font-semibold bg-interactive hover:bg-interactive-hi transition-colors"
      >
        Start Over
      </button>
    </div>
  );
}
