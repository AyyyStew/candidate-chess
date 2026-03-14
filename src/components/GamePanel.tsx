import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot } from "../types";

interface GamePanelProps {
  snap: GameSnapshot;
  onNext: () => void;
  resetMessage?: string;
}

export default function GamePanel({ snap, onNext, resetMessage }: GamePanelProps) {
  return (
    <FamilyFeudBoard
      fen={snap.fen}
      topMoves={snap.liveTopMoves ?? []}
      candidates={snap.candidates}
      targetMoves={snap.targetMoves}
      isDone={snap.phase === "done"}
      strikes={snap.strikes}
      maxStrikes={snap.maxStrikes}
      onReset={onNext}
      resetMessage={resetMessage ?? "Play Another Position?"}
    />
  );
}
