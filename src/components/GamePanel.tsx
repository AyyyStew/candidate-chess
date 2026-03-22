import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot } from "../types";
import { useIsMobile } from "../hooks/useIsMobile";

interface GamePanelProps {
  snap: GameSnapshot;
}

export default function GamePanel({ snap }: GamePanelProps) {
  const isMobile = useIsMobile();
  // On mobile the GameLayout renders the full game stack directly;
  // GamePanel would duplicate FamilyFeudBoard (and its sound effects).
  if (isMobile) return null;
  const isDone = snap.phase === "done";

  return (
    <FamilyFeudBoard
      fen={snap.fen}
      topMoves={snap.liveTopMoves ?? []}
      candidates={snap.candidates}
      targetMoves={snap.targetMoves}
      isDone={isDone}
      strikes={snap.strikes}
      maxStrikes={snap.maxStrikes}
      analysisReady={snap.analysisReady}
    />
  );
}
