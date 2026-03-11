import React from "react";

export default function Header({ dark, onToggle, mode, onModeChange }) {
  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
      <h1 className="text-xl font-bold tracking-tight">♟ Candidate Chess</h1>
      <div className="flex items-center gap-3">
        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm">
          <button
            onClick={() => onModeChange("game")}
            className={`px-3 py-1.5 transition-colors
              ${
                mode === "game"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            Game
          </button>
          <button
            onClick={() => onModeChange("analysis")}
            className={`px-3 py-1.5 transition-colors
              ${
                mode === "analysis"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
          >
            Analysis
          </button>
        </div>
        <button
          onClick={onToggle}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {dark ? "☀ Light" : "☾ Dark"}
        </button>
      </div>
    </header>
  );
}
