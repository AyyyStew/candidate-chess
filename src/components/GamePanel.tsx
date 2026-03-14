import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot } from "../types";

interface GamePanelProps {
  snap: GameSnapshot;
  onNext: () => void;
  resetMessage?: string;
  showHeader?: boolean;
}

export default function GamePanel({ snap, onNext, resetMessage, showHeader = true }: GamePanelProps) {
  const isDone = snap.phase === "done";
  const hitCount = snap.candidates.filter((c) => !c.pending && c.isHit).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Game context header — only when the page doesn't own it */}
      {showHeader && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs text-faint uppercase tracking-widest mb-1">
              Move {snap.moveNumber}
            </p>
            <h2 className="font-black text-2xl text-text leading-tight truncate">
              {snap.label}
            </h2>
            {snap.event && (
              <p className="text-sm text-muted mt-0.5 truncate">{snap.event}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 mt-1">
            <span
              className="w-3 h-3 rounded-full ring-1 ring-white/10 shrink-0"
              style={{
                background: snap.orientation === "white" ? "#f3f4f6" : "#030712",
                boxShadow:
                  snap.orientation === "white"
                    ? "0 0 6px rgba(243,244,246,0.35)"
                    : "0 0 6px rgba(0,0,0,0.8)",
              }}
            />
            <span className="text-sm font-semibold text-label whitespace-nowrap">
              {snap.orientation === "white" ? "White" : "Black"} to move
            </span>
          </div>
        </div>
      )}

      {/* Progress / analyzing bar — also carries side-to-move when header is hidden */}
      <div className="flex items-center justify-between gap-3 -mt-2">
        <div className="flex items-center gap-3">
          {!snap.analysisReady && !isDone ? (
            <span className="text-xs text-faint animate-pulse tracking-widest uppercase">
              Analyzing
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: snap.targetMoves }).map((_, i) => (
                <div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full transition-all duration-500"
                  style={
                    i < hitCount
                      ? { background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.55)" }
                      : { background: "#1f2937" }
                  }
                />
              ))}
            </div>
          )}
          {snap.analysisReady && !isDone && (
            <span className="text-xs text-faint">
              {hitCount} / {snap.targetMoves}
            </span>
          )}
        </div>

      </div>

      <FamilyFeudBoard
        fen={snap.fen}
        topMoves={snap.liveTopMoves ?? []}
        candidates={snap.candidates}
        targetMoves={snap.targetMoves}
        isDone={isDone}
        strikes={snap.strikes}
        maxStrikes={snap.maxStrikes}
        onReset={onNext}
        resetMessage={resetMessage ?? "Play Another Position?"}
      />
    </div>
  );
}
