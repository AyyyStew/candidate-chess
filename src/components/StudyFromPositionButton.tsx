import React from "react";
import { useBoard } from "../contexts/BoardContext";

interface StudyFromPositionButtonProps {
  onStudy: (fen: string) => void;
}

export default function StudyFromPositionButton({ onStudy }: StudyFromPositionButtonProps) {
  const { isPreviewing, fen } = useBoard();
  if (!isPreviewing) return null;
  return (
    <button
      onClick={() => onStudy(fen)}
      className="w-full py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
    >
      Study this position →
    </button>
  );
}
