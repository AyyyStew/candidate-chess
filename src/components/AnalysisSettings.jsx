import React from "react";

export default function AnalysisSettings({
  depth,
  topMoves,
  candidateLimit,
  useMovetime,
  movetime,
  onDepthChange,
  onTopMovesChange,
  onCandidateLimitChange,
  onUseMovetimeChange,
  onMovetimeChange,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-4">
      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Engine Settings
      </h3>

      {/* Depth vs Movetime toggle */}
      <div className="flex items-center gap-3">
        <span
          className={`text-sm font-medium ${!useMovetime ? "text-blue-600" : "text-gray-400"}`}
        >
          Depth
        </span>
        <button
          onClick={() => onUseMovetimeChange(!useMovetime)}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0
    ${useMovetime ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"}`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200
    ${useMovetime ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
        <span
          className={`text-sm font-medium ${useMovetime ? "text-blue-600" : "text-gray-400"}`}
        >
          Time
        </span>
      </div>

      {/* Depth slider — shown when not using movetime */}
      {!useMovetime && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <label className="text-gray-600 dark:text-gray-300 font-medium">
              Depth
            </label>
            <span className="font-bold">{depth}</span>
          </div>
          <input
            type="range"
            min={6}
            max={20}
            value={depth}
            onChange={(e) => onDepthChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>Fast (6)</span>
            <span>Deep (20)</span>
          </div>
        </div>
      )}

      {/* Movetime slider — shown when using movetime */}
      {useMovetime && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <label className="text-gray-600 dark:text-gray-300 font-medium">
              Think Time
            </label>
            <span className="font-bold">{movetime / 1000}s</span>
          </div>
          <input
            type="range"
            min={500}
            max={10000}
            step={500}
            value={movetime}
            onChange={(e) => onMovetimeChange(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>0.5s</span>
            <span>10s</span>
          </div>
        </div>
      )}

      {/* Top moves slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <label className="text-gray-600 dark:text-gray-300 font-medium">
            Top Moves Shown
          </label>
          <span className="font-bold">{topMoves}</span>
        </div>
        <input
          type="range"
          min={3}
          max={10}
          value={topMoves}
          onChange={(e) => onTopMovesChange(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>3</span>
          <span>10</span>
        </div>
      </div>

      {/* Candidate limit slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <label className="text-gray-600 dark:text-gray-300 font-medium">
            Candidate Limit
          </label>
          <span className="font-bold">{candidateLimit}</span>
        </div>
        <input
          type="range"
          min={2}
          max={5}
          value={candidateLimit}
          onChange={(e) => onCandidateLimitChange(Number(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>2</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
}
