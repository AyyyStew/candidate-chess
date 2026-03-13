import React, { useEffect } from "react";

interface MoveEntry {
  san: string;
  fenAfter: string;
}

interface MoveHistoryProps {
  history: MoveEntry[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  disabled: boolean;
}

export default function MoveHistory({
  history,
  currentIndex,
  onNavigate,
  disabled,
}: MoveHistoryProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (disabled) return;
      if (e.key === "ArrowLeft") onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight") onNavigate(currentIndex + 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, onNavigate, disabled]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      <div className="flex flex-wrap gap-1 mb-3 max-h-24 overflow-y-auto">
        {history.map((move, i) => {
          const moveNum = Math.floor(i / 2) + 1;
          const isWhite = i % 2 === 0;
          const isActive = i === currentIndex;
          return (
            <span key={i} className="flex items-center gap-0.5">
              {isWhite && (
                <span className="text-gray-400 text-xs">{moveNum}.</span>
              )}
              <button
                onClick={() => onNavigate(i)}
                disabled={disabled || currentIndex < 0}
                className={`px-1.5 py-0.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                {move.san}
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2">
        {[
          {
            label: "⟪",
            onClick: () => onNavigate(-1),
            disabled: disabled || currentIndex < 0,
          },
          {
            label: "←",
            onClick: () => onNavigate(currentIndex - 1),
            disabled: disabled || currentIndex < 0,
          },
          {
            label: "→",
            onClick: () => onNavigate(currentIndex + 1),
            disabled: currentIndex >= history.length - 1,
          },
          {
            label: "⟫",
            onClick: () => onNavigate(history.length - 1),
            disabled: currentIndex >= history.length - 1,
          },
        ].map(({ label, onClick, disabled: d }) => (
          <button
            key={label}
            onClick={onClick}
            disabled={d}
            className="flex-1 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
