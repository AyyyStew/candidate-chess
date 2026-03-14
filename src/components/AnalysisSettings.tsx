import React from "react";

interface AnalysisSettingsProps {
  depth: number;
  topMoves: number;
  candidateLimit: number;
  useMovetime: boolean;
  movetime: number;
  onDepthChange: (v: number) => void;
  onTopMovesChange: (v: number) => void;
  onCandidateLimitChange: (v: number) => void;
  onUseMovetimeChange: (v: boolean) => void;
  onMovetimeChange: (v: number) => void;
}

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
}: AnalysisSettingsProps) {
  return (
    <div className="rounded-xl border border-edge bg-surface px-4 py-3 flex flex-col gap-4">
      <h3 className="font-semibold text-sm text-muted uppercase tracking-wide">
        Engine Settings
      </h3>
      <div className="flex items-center gap-3">
        <span
          className={`text-sm font-medium ${!useMovetime ? "text-accent" : "text-muted"}`}
        >
          Depth
        </span>
        <button
          onClick={() => onUseMovetimeChange(!useMovetime)}
          className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${useMovetime ? "bg-accent" : "bg-gray-600"}`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${useMovetime ? "translate-x-4" : "translate-x-0"}`}
          />
        </button>
        <span
          className={`text-sm font-medium ${useMovetime ? "text-accent" : "text-muted"}`}
        >
          Time
        </span>
      </div>
      {!useMovetime && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <label className="text-label font-medium">Depth</label>
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
          <div className="flex justify-between text-xs text-muted">
            <span>Fast (6)</span>
            <span>Deep (20)</span>
          </div>
        </div>
      )}
      {useMovetime && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <label className="text-label font-medium">Think Time</label>
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
          <div className="flex justify-between text-xs text-muted">
            <span>0.5s</span>
            <span>10s</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <label className="text-label font-medium">Top Moves Shown</label>
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
        <div className="flex justify-between text-xs text-muted">
          <span>3</span>
          <span>10</span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm">
          <label className="text-label font-medium">
            Minimum Candidates Required
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
        <div className="flex justify-between text-xs text-muted">
          <span>2</span>
          <span>5</span>
        </div>
      </div>
    </div>
  );
}
