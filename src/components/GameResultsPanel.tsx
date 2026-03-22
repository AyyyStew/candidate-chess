import { useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import type React from "react";
import type { GameSnapshot } from "../types";
import { candidateToSquare } from "../utils/daily";
import MoveRowCard from "./MoveRowCard";
import { PipsIndicator } from "./PipsAndStrikes";

interface GameResultsPanelProps {
  snap: GameSnapshot;
  /** Short title appended after "CandidateChess – " in the share text.
   *  e.g. "Daily – Mar 22, 2026" | "Random Position" | "Custom Position" */
  shareTitle: string;
  /** URL included at the end of the share text. Defaults to the site origin. */
  shareUrl?: string;
  /** Optional content rendered below the score row (e.g. streak display). */
  extraHeader?: React.ReactNode;
  /** Primary call-to-action button rendered at the very bottom.
   *  Provide `href` to render as a navigable link (right-click → new tab);
   *  omit it for function-only actions (e.g. reset). */
  primaryAction?: {
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    href?: string;
    onClick: () => void;
  };
}

function IconClipboard() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function GameResultsPanel({
  snap,
  shareTitle,
  shareUrl,
  extraHeader,
  primaryAction,
}: GameResultsPanelProps) {
  const [copied, setCopied] = useState(false);

  const hits = snap.candidates.filter((c) => c.status === "hit").length;
  const target = snap.targetMoves;
  const topMoves = snap.liveTopMoves.slice(0, target);
  const misses = snap.candidates.filter((c) => c.status === "miss");
  const foundMoves = new Set(
    snap.candidates.filter((c) => c.status === "hit").map((c) => c.move),
  );
  const squares = snap.candidates
    .filter((c) => c.status !== "pending")
    .map((c) => candidateToSquare(c, snap.liveTopMoves));

  const url = shareUrl ?? window.location.origin;
  const shareText = `CandidateChess – ${shareTitle}\n${hits}/${target} candidate moves ${squares.join("")}\n${url}`;

  function handleShare() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Score header — mirrors the game header column layout */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black text-text">{hits}</span>
          <span className="text-base text-muted">/ {target} moves found</span>
        </div>
        <PipsIndicator
          analysisReady={true}
          isDone={true}
          targetMoves={target}
          hitCount={hits}
        />
        <div className="flex gap-1 text-base">
          {squares.map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>
      </div>

      {extraHeader}

      {/* Top moves */}
      {topMoves.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-faint uppercase tracking-widest">
            Top moves
          </p>
          <div className="flex flex-col gap-1.5">
            {topMoves.map((answer, i) => (
              <MoveRowCard
                key={i}
                rank={i + 1}
                san={answer.san}
                category={answer.category}
                eval={answer.eval}
                isHit={foundMoves.has(answer.move)}
                pvLine={answer.line}
                startFen={snap.fen}
                showLine={true}
              />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleShare}
          className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-interactive hover:bg-interactive-hi transition-colors text-label"
        >
          {copied ? <IconCheck /> : <IconClipboard />}
          {copied ? "Copied!" : "Share result"}
        </button>

        <Link
          to="/library"
          className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-interactive hover:bg-interactive-hi text-label transition-colors"
        >
          <BookOpen size={15} />
          Position Library
        </Link>

        {primaryAction &&
          (primaryAction.href ? (
            <Link
              to={primaryAction.href}
              onClick={primaryAction.onClick}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hi text-white transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 flex items-center justify-center gap-2"
            >
              <primaryAction.icon size={16} />
              {primaryAction.label}
            </Link>
          ) : (
            <button
              onClick={primaryAction.onClick}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-accent hover:bg-accent-hi text-white transition-all shadow-lg shadow-accent/25 hover:shadow-accent/40 flex items-center justify-center gap-2"
            >
              <primaryAction.icon size={16} />
              {primaryAction.label}
            </button>
          ))}
      </div>

      {/* Misses */}
      {misses.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 group relative">
            <p className="text-xs text-faint uppercase tracking-widest">
              Misses
            </p>
            <span className="text-xs text-faint/40 leading-none">ⓘ</span>
            <div className="pointer-events-none absolute bottom-full left-0 mb-2 w-72 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
              <div className="rounded-lg border border-surface-hi bg-surface p-3 shadow-xl text-xs text-muted leading-relaxed">
                <p className="font-semibold text-label mb-1">
                  About miss evaluations
                </p>
                <p>
                  Evaluations for missed moves are estimated by your browser's
                  local engine and may not perfectly match the server's
                  pre-computed analysis, which runs at a higher depth on native
                  hardware.
                </p>
                <p className="mt-1.5">
                  If a missed move appeared suspiciously strong, its eval is
                  capped to the weakest pre-computed top move and marked with{" "}
                  <span className="font-mono text-label">&gt;</span> or{" "}
                  <span className="font-mono text-label">&lt;</span> to indicate
                  the true ranking is likely worse.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {misses.map((c, i) => (
              <MoveRowCard
                key={i}
                rank="miss"
                san={c.san}
                category={c.category ?? null}
                eval={c.eval ?? null}
                pvLine={c.line}
                startFen={snap.fen}
                showLine={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
