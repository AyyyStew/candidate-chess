import React, { useEffect } from "react";

export default function MoveHistory({ history, currentIndex, onNavigate }) {
  // keyboard arrow keys
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowLeft") onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight") onNavigate(currentIndex + 1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, onNavigate]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3">
      {/* Move list */}
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
                className={`px-1.5 py-0.5 rounded text-sm font-medium transition-colors
                  ${
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

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onNavigate(-1)}
          disabled={currentIndex < 0}
          className="flex-1 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          ⟪
        </button>
        <button
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex < 0}
          className="flex-1 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          ←
        </button>
        <button
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex >= history.length - 1}
          className="flex-1 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          →
        </button>
        <button
          onClick={() => onNavigate(history.length - 1)}
          disabled={currentIndex >= history.length - 1}
          className="flex-1 py-1.5 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          ⟫
        </button>
      </div>
    </div>
  );
}
