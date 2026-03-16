import type { GameSnapshot } from "../types";

interface Props {
  snap: GameSnapshot;
}

export default function StrikesPipsBar({ snap }: Props) {
  const isDone = snap.phase === "done";
  const hitCount = snap.candidates.filter((c) => c.status === "hit").length;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-edge-hi bg-surface px-4 py-3">
      {/* Pips / analyzing */}
      <div className="flex items-center gap-3">
        {!snap.analysisReady && !isDone ? (
          <span className="text-xs text-faint animate-pulse tracking-widest uppercase">
            Analyzing
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {Array.from({ length: snap.targetMoves }).map((_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full transition-all duration-500"
                style={
                  i < hitCount
                    ? { background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.55)" }
                    : { background: "#1f2937" }
                }
              />
            ))}
          </div>
        )}
        {snap.analysisReady && !isDone && (
          <span className="text-xs text-faint">
            {hitCount} / {snap.targetMoves}
          </span>
        )}
      </div>

      {/* Strike indicator */}
      <div className="flex gap-1.5 items-center">
        {Array.from({ length: snap.maxStrikes }).map((_, i) => {
          const lost = i < snap.strikes;
          return (
            <span
              key={i}
              className="text-2xl transition-all duration-300"
              style={{
                opacity: lost ? 0.12 : 1,
                transform: lost ? "scale(0.75)" : "scale(1)",
                filter: lost ? "grayscale(1)" : "none",
              }}
            >
              ❤️
            </span>
          );
        })}
      </div>
    </div>
  );
}
