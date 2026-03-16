import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";

interface GamePanelProps {
  snap: GameSnapshot;
  onNext: () => void;
  resetMessage?: string;
  showHeader?: boolean;
}

export default function GamePanel({
  snap,
  onNext,
  resetMessage,
  showHeader = true,
}: GamePanelProps) {
  const isMobile = useIsMobile();
  // On mobile the GameLayout renders the full game stack directly;
  // GamePanel would duplicate FamilyFeudBoard (and its sound effects).
  if (isMobile) return null;
  const isDone = snap.phase === "done";
  const hitCount = snap.candidates.filter((c) => c.status === "hit").length;

  return (
    <div className="flex flex-col gap-5">
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
                      ? {
                          background: "#22c55e",
                          boxShadow: "0 0 6px rgba(34,197,94,0.55)",
                        }
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
