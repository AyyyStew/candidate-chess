import React from "react";
import { useBoard } from "../contexts/BoardContext";

interface StudyFromPositionButtonProps {
  onStudy: (fen: string) => void;
  onPlay?: (fen: string) => void;
}

export default function StudyFromPositionButton({ onStudy, onPlay }: StudyFromPositionButtonProps) {
  const { isPreviewing, fen } = useBoard();
  if (!isPreviewing) return null;
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onStudy(fen)}
        className="flex-1 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-sm"
      >
        Study Position
      </button>
      {onPlay && (
        <button
          onClick={() => onPlay(fen)}
          className="flex-1 py-2.5 rounded-xl font-semibold bg-accent hover:bg-accent-hi text-white transition-colors text-sm"
        >
          Play Position
        </button>
      )}
    </div>
  );
}
