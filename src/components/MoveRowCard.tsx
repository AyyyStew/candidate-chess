import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { formatEval } from "../utils/chess";
import type { Category, PVLine } from "../types";
import PvLine from "./PvLine";

export interface MoveRowCardProps {
  /** Number shows a rank; "miss" renders the red miss style. */
  rank: number | "miss";
  san: string;
  category: Category | null;
  eval: number | null;
  /** When true, renders the hidden gem style instead of a miss. */
  hiddenGem?: boolean;
  /** true → ✓  false → —  undefined → no indicator */
  isHit?: boolean;
  /** Show a placeholder instead of the move (unrevealed slot). */
  hidden?: boolean;
  /** Animate the move reveal with a flip-card effect. */
  animate?: boolean;
  pvLine?: PVLine;
  startFen?: string;
  showLine?: boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MissRowProps {
  san: string;
  pvLineSlot: ReactNode;
  category: Category | null;
  evalScore: number | null;
}

function MissRow({ san, pvLineSlot, category, evalScore }: MissRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-red-950/40 border border-red-900/50">
      <span className="text-red-400 font-bold text-sm w-5 shrink-0">✕</span>
      {pvLineSlot ?? (
        <span className="font-semibold text-label flex-1">{san}</span>
      )}
      {category && (
        <span
          className="text-xs font-medium shrink-0"
          style={{ color: category.color }}
        >
          {category.icon} {category.label}
        </span>
      )}
      {evalScore != null && (
        <span className="text-xs text-faint tabular-nums shrink-0">
          {formatEval(evalScore)}
        </span>
      )}
    </div>
  );
}

interface HiddenGemRowProps {
  san: string;
  pvLineSlot: ReactNode;
  category: Category | null;
  evalScore: number | null;
}

function HiddenGemRow({
  san,
  pvLineSlot,
  category,
  evalScore,
}: HiddenGemRowProps) {
  return (
    <div className="relative group flex items-center gap-3 rounded-lg px-3 py-2.5 bg-cyan-950/50 border border-cyan-700/40">
      <span className="text-blue-400 font-bold text-sm w-5 shrink-0">💎</span>
      {pvLineSlot ?? (
        <span className="font-semibold text-label flex-1">{san}</span>
      )}
      {category && (
        <span
          className="text-xs font-medium shrink-0"
          style={{ color: category.color }}
        >
          {category.icon} {category.label}
        </span>
      )}
      {evalScore != null && (
        <span className="text-xs text-faint tabular-nums shrink-0">
          ~{formatEval(evalScore)}
        </span>
      )}
      {/* Tooltip */}
      <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        <div className="rounded-lg border border-surface-hi bg-surface p-3 shadow-xl text-xs text-muted leading-relaxed">
          💎 Hidden Gem — our precomputed engine missed this one. Browser
          Stockfish thinks it's strong. Nice find.
        </div>
      </div>
    </div>
  );
}

interface HiddenRowProps {
  rank: number;
}

function HiddenRow({ rank }: HiddenRowProps) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4"
      style={{
        borderLeftColor: "var(--color-edge)",
        background: "var(--color-surface)",
      }}
    >
      <span className="text-yellow-400/50 font-bold text-sm w-5 shrink-0">
        {rank}
      </span>
      <span className="font-black text-xl text-muted/30 tracking-widest flex-1">
        · · ·
      </span>
    </div>
  );
}

interface RevealedRowProps {
  rank: number;
  san: string;
  pvLineSlot: ReactNode;
  category: Category | null;
  evalScore: number | null;
  isHit?: boolean;
  animate: boolean;
  flipped: boolean;
  isRevealed: boolean;
}

function RevealedRow({
  rank,
  san,
  pvLineSlot,
  category,
  evalScore,
  isHit,
  animate,
  flipped,
  isRevealed,
}: RevealedRowProps) {
  const color = category?.color;
  const cardStyle =
    isHit && flipped && color
      ? {
          borderLeftColor: color,
          background: `linear-gradient(90deg, ${color}22 0%, transparent 100%)`,
        }
      : {
          borderLeftColor: "var(--color-edge)",
          background: "var(--color-surface)",
        };

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3 py-2.5 border-l-4 transition-colors duration-500"
      style={cardStyle}
    >
      {/* Rank */}
      <span
        className={`font-bold text-sm w-5 shrink-0 transition-all duration-500 ${
          isHit && flipped ? "text-yellow-400" : "text-yellow-400/50"
        }`}
      >
        {rank}
      </span>

      {/* Move / line — flip card during animation, then inline PvLine */}
      {animate && !flipped ? (
        <div className="flip-card flex-1" style={{ height: "28px" }}>
          <div className={`flip-card-inner ${flipped ? "flipped" : ""}`}>
            <div className="flip-card-front">
              <div className="h-5 w-20 rounded-md bg-surface-hi/50" />
            </div>
            <div className="flip-card-back">
              <span className="font-semibold text-text">{san}</span>
            </div>
          </div>
        </div>
      ) : (
        (pvLineSlot ?? (
          <span className="font-semibold text-text flex-1">{san}</span>
        ))
      )}

      {/* Category */}
      {isRevealed && category && (
        <span
          className={`text-xs font-medium shrink-0 ${animate ? "animate-reveal-pop" : ""}`}
          style={{
            color: category.color,
            ...(animate ? { animationDelay: "400ms" } : {}),
          }}
        >
          {category.icon} {category.label}
        </span>
      )}

      {/* Eval */}
      {isRevealed && evalScore != null && (
        <span
          className={`text-xs text-faint tabular-nums shrink-0 ${animate ? "animate-reveal-pop" : ""}`}
          style={animate ? { animationDelay: "460ms" } : {}}
        >
          {formatEval(evalScore)}
        </span>
      )}

      {/* Hit indicator */}
      {isRevealed &&
        isHit !== undefined &&
        (isHit ? (
          <span className="text-xs text-green-400 font-medium shrink-0">✓</span>
        ) : (
          <span className="text-xs text-faint shrink-0">—</span>
        ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MoveRowCard({
  rank,
  san,
  category,
  eval: evalScore,
  hiddenGem = false,
  isHit,
  hidden = false,
  animate = false,
  pvLine,
  startFen,
  showLine = false,
}: MoveRowCardProps) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (hidden) return;
    if (animate) {
      const t = setTimeout(() => setFlipped(true), 60);
      return () => clearTimeout(t);
    } else {
      setFlipped(true);
    }
  }, [animate, hidden]);

  const isMiss = rank === "miss";
  const isRevealed = !hidden && flipped;

  // Inline helper (not a component — avoids remounting PvLine on every render)
  const pvLineSlot =
    pvLine && pvLine.sans.length > 0 && startFen ? (
      <PvLine
        startFen={startFen}
        sans={pvLine.sans}
        inline
        locked={!showLine}
      />
    ) : null;

  if (isMiss && hiddenGem)
    return (
      <HiddenGemRow
        san={san}
        pvLineSlot={pvLineSlot}
        category={category}
        evalScore={evalScore}
      />
    );
  if (isMiss)
    return (
      <MissRow
        san={san}
        pvLineSlot={pvLineSlot}
        category={category}
        evalScore={evalScore}
      />
    );
  if (hidden) return <HiddenRow rank={rank as number} />;
  return (
    <RevealedRow
      rank={rank as number}
      san={san}
      pvLineSlot={pvLineSlot}
      category={category}
      evalScore={evalScore}
      isHit={isHit}
      animate={animate}
      flipped={flipped}
      isRevealed={isRevealed}
    />
  );
}
