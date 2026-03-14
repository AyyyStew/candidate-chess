import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot, AnalysisResult } from "../types";

interface GamePanelProps {
  snap: GameSnapshot;
  results: AnalysisResult | null;
  onNext: () => void;
  resetMessage?: string;
}

export default function GamePanel({
  snap,
  results,
  onNext,
  resetMessage,
}: GamePanelProps) {
  const isDone = snap.phase === "done";
  const topMoves = isDone
    ? (results?.topMoves ?? [])
    : (snap.liveTopMoves ?? []);

  console.log(
    "[GamePanel] isDone:",
    isDone,
    "topMoves:",
    topMoves.length,
    "liveTopMoves:",
    snap.liveTopMoves?.length,
  );

  return (
    <FamilyFeudBoard
      fen={snap.fen}
      topMoves={topMoves}
      candidates={snap.candidates}
      targetMoves={snap.targetMoves}
      isDone={isDone}
      strikes={snap.strikes}
      maxStrikes={snap.maxStrikes}
      onReset={onNext}
      resetMessage={resetMessage ?? "Play Another Position?"}
    />
  );
}
