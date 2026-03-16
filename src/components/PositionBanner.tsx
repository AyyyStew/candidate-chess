import { useState } from "react";

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
  const [expanded, setExpanded] = useState(false);

  const labelContent = pgn ? (
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
  );

  return (
    <div className="rounded-xl border border-edge-hi bg-surface px-4 py-3 shadow-lg shadow-black/30">
      {/* Always visible: color to move + move number + mobile expand toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          <span className="text-xs font-semibold text-label">
            {orientation === "white" ? "White" : "Black"} to move
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xs text-faint uppercase tracking-widest">
              Move
            </span>
            <span className="font-black text-2xl text-yellow-400 leading-none">
              {moveNumber}
            </span>
          </div>

          {/* Expand toggle — mobile only */}
          <button
            className="sm:hidden text-muted hover:text-text transition-colors"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Hide game info" : "Show game info"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Label + event: always visible on sm+, collapsible on mobile */}
      <div className={`mt-2 min-w-0 ${expanded ? "block" : "hidden"} sm:block`}>
        <h2 className="font-black text-lg text-text leading-tight">
          {labelContent}
        </h2>
        {event && <p className="text-xs text-muted mt-0.5">{event}</p>}
      </div>
    </div>
  );
}
