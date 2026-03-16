const PIP_ACTIVE_BG = "#22c55e";
const PIP_ACTIVE_SHADOW = "0 0 6px rgba(34,197,94,0.55)";
const PIP_INACTIVE_BG = "#1f2937";

interface PipsIndicatorProps {
  analysisReady: boolean;
  isDone: boolean;
  targetMoves: number;
  hitCount: number;
}

export function PipsIndicator({
  analysisReady,
  isDone,
  targetMoves,
  hitCount,
}: PipsIndicatorProps) {
  return (
    <div className="flex items-center gap-3">
      {!analysisReady && !isDone ? (
        <span className="text-xs text-faint animate-pulse tracking-widest uppercase">
          Analyzing
        </span>
      ) : (
        <div className="flex items-center gap-1.5">
          {Array.from({ length: targetMoves }).map((_, i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full transition-all duration-500"
              style={
                i < hitCount
                  ? { background: PIP_ACTIVE_BG, boxShadow: PIP_ACTIVE_SHADOW }
                  : { background: PIP_INACTIVE_BG }
              }
            />
          ))}
        </div>
      )}
      {analysisReady && !isDone && (
        <span className="text-xs text-faint">
          {hitCount} / {targetMoves}
        </span>
      )}
    </div>
  );
}

interface StrikeIndicatorProps {
  strikes: number;
  maxStrikes: number;
  size?: "sm" | "lg";
}

export function StrikeIndicator({
  strikes,
  maxStrikes,
  size = "lg",
}: StrikeIndicatorProps) {
  const textSize = size === "sm" ? "text-2xl" : "text-3xl";
  const gap = size === "sm" ? "gap-1.5" : "gap-2";
  return (
    <div className={`flex ${gap} items-center`}>
      {Array.from({ length: maxStrikes }).map((_, i) => {
        const lost = i < strikes;
        return (
          <span
            key={i}
            className={`${textSize} transition-all duration-300`}
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
  );
}
