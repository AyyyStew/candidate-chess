import React from "react";
import { useEngine } from "../contexts/EngineContext";
import { useBoard } from "../contexts/BoardContext";
import FamilyFeudBoard from "./FamilyFeudBoard";

export default function GamePanel({ mode, onReset, resetMessage }) {
  const { engineAnalysis } = useEngine();
  const board = useBoard();

  const topMoves = mode.isDone
    ? mode.results.topMoves
    : engineAnalysis.liveTopMoves;

  const handleReset =
    onReset ??
    (() => {
      mode.reset();
      board.reset();
    });

  return (
    <FamilyFeudBoard
      topMoves={topMoves}
      candidates={mode.candidates}
      targetMoves={mode.targetMoves}
      isDone={mode.isDone}
      strikes={mode.strikes}
      maxStrikes={mode.maxStrikes}
      onReset={handleReset}
      resetMessage={resetMessage}
    />
  );
}
