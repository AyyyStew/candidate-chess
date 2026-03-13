import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot, AnalysisResult } from "../types";

interface GamePanelProps {
  snap: GameSnapshot;
  results: AnalysisResult | null;
  onNext: () => void;
}

export default function GamePanel({ snap, results, onNext }: GamePanelProps) {
  const isDone = snap.phase === "done";
  const topMoves = isDone
    ? (results?.topMoves ?? [])
    : (snap.liveTopMoves ?? []);

  return (
    <FamilyFeudBoard
      topMoves={topMoves}
      candidates={snap.candidates}
      targetMoves={snap.targetMoves}
      isDone={isDone}
      strikes={snap.strikes}
      maxStrikes={snap.maxStrikes}
      onReset={onNext}
      resetMessage="Next Position"
    />
  );
}
