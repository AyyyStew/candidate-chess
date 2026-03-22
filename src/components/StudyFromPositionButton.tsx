import React from "react";
import { GraduationCap, Wrench } from "lucide-react";
import { useBoard } from "../contexts/BoardContext";

interface StudyFromPositionButtonProps {
  onStudy: (fen: string) => void;
  onPlay?: (fen: string) => void;
}

export default function StudyFromPositionButton({
  onStudy,
  onPlay,
}: StudyFromPositionButtonProps) {
  const { isPreviewing, fen } = useBoard();
  if (!isPreviewing) return null;
  return (
    <div className="flex gap-2">
      <button
        onClick={() => onStudy(fen)}
        className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-interactive hover:bg-interactive-hi text-label transition-colors"
      >
        <GraduationCap size={15} />
        Study Position
      </button>
      {onPlay && (
        <button
          onClick={() => onPlay(fen)}
          className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-interactive hover:bg-interactive-hi text-label transition-colors"
        >
          <Wrench size={15} />
          Play Position
        </button>
      )}
    </div>
  );
}
