interface PositionBannerProps {
  label: string;
  event?: string;
  moveNumber: number;
  orientation: "white" | "black";
  pgn?: string | null;
}

export default function PositionBanner({
  label,
  event,
  moveNumber,
  orientation,
  pgn,
}: PositionBannerProps) {
  return (
    <div className="rounded-xl border border-edge-hi bg-surface px-4 py-3 flex items-center justify-between gap-6 shadow-lg shadow-black/30">
      <div className="min-w-0">
        <h2 className="font-black text-lg text-text leading-tight">
          {pgn ? (
            <a
              href={`https://lichess.org/analysis/pgn/${encodeURIComponent(pgn)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 decoration-2 inline-flex items-center gap-2"
            >
              {label}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-4 h-4 shrink-0 opacity-60"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </a>
          ) : (
            label
          )}
        </h2>
        {event && <p className="text-xs text-muted mt-0.5">{event}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-label">
            {orientation === "white" ? "White" : "Black"} to move
          </span>
          <span
            className="w-2.5 h-2.5 rounded-full ring-1 ring-white/10"
            style={{
              background: orientation === "white" ? "#f3f4f6" : "#030712",
              boxShadow:
                orientation === "white"
                  ? "0 0 6px rgba(243,244,246,0.35)"
                  : "0 0 6px rgba(0,0,0,0.8)",
            }}
          />
        </div>
        <div className="text-right">
          <p className="text-xs text-faint uppercase tracking-widest mb-0.5">
            Move
          </p>
          <p className="font-black text-2xl text-yellow-400 leading-none">
            {moveNumber}
          </p>
        </div>
      </div>
    </div>
  );
}
