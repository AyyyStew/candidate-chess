// FILE: src/components/GamePanel.jsx
import React from "react";
import FamilyFeudBoard from "./FamilyFeudBoard";

export default function GamePanel({ snap, results, onNext }) {
  const isDone = snap.phase === "done";
  // Use results.topMoves when done, live top moves while playing
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
