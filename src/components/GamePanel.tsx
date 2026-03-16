import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import { PipsIndicator } from "./PipsAndStrikes";
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
        <PipsIndicator
          analysisReady={snap.analysisReady}
          isDone={isDone}
          targetMoves={snap.targetMoves}
          hitCount={hitCount}
        />
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
