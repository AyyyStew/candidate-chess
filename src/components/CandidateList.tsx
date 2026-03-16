import React from "react";
import { Chess } from "chess.js";
import { debug } from "../utils/debug";
import { formatEval } from "../utils/chess";
import type { Candidate, AnalysisResult, TopMove } from "../types";
import PvLine from "./PvLine";
import { useBoard } from "../contexts/BoardContext";

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
  const { showPreviewFen, clearPreview } = useBoard();
  const isDone = !!results;
  const displayList = results?.candidates ?? candidates;
  const isThinking = !isDone && candidates.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-muted uppercase tracking-wide">
          Your Candidates
        </h3>
      </div>
      {candidates.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-edge-hi p-6 text-center">
          <p className="text-muted text-sm">Drag a piece to try a move</p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {displayList.map((c, i) => {
          const rank = isDone
            ? getStockfishRank(c.move, results!.topMoves)
            : null;
          const category = isDone ? c.category : null;
          let fenAfter = results?.fen ?? null;
          if (isDone && fenAfter) {
            try {
              const g = new Chess(results!.fen);
              g.move({
                from: c.move.slice(0, 2),
                to: c.move.slice(2, 4),
                promotion: c.move[4] ?? "q",
              });
              fenAfter = g.fen();
            } catch {
              /* keep original */
            }
          }
          return (
            <div
              key={c.move}
              className={`animate-slide-in flex flex-col px-4 py-3 rounded-xl bg-surface border border-edge ${isDone ? "border-l-4" : ""} ${isThinking ? "animate-pulse" : ""}`}
              style={{
                borderLeftColor:
                  isDone && category ? category.color : undefined,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-muted text-sm w-4 shrink-0">{i + 1}</span>
                <button
                  className="font-bold text-lg hover:text-blue-400 transition-colors"
                  onClick={() =>
                    isDone && fenAfter
                      ? showPreviewFen(fenAfter)
                      : clearPreview()
                  }
                >
                  {c.san}
                </button>
                {rank && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">
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
                    {c.diffBest !== undefined && (
                      <span className="text-muted text-xs">
                        {formatEval(c.diffBest)} ΔBest
                      </span>
                    )}
                    {c.diffPos !== undefined && (
                      <span className="text-muted text-xs">
                        {formatEval(c.diffPos)} ΔPos
                      </span>
                    )}
                  </span>
                )}
                {!isDone && onRemove && (
                  <button
                    onClick={() => onRemove(c.move)}
                    className="ml-auto text-faint hover:text-red-400 transition-colors text-lg leading-none"
                  >
                    ×
                  </button>
                )}
              </div>
              {isDone && c.line && (() => {
                debug("CandidateList", "line for", c.san, "sans:", c.line.sans, "startFen:", results!.fen);
                return c.line.sans.length > 0;
              })() && (
                <div className="mt-1 pl-7">
                  <PvLine startFen={results!.fen} sans={c.line.sans} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
