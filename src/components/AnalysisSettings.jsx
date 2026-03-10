import React from "react";

export default function AnalysisSettings({
  depth,
  topMoves,
  onDepthChange,
  onTopMovesChange,
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 flex flex-col gap-4">
      <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Engine Settings
      </h3>

      {/* Depth slider */}
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

      {/* Top moves slider */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <label className="text-gray-600 dark:text-gray-300 font-medium">
            Top Moves
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
    </div>
  );
}
