import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameSnapshot } from "../types";

interface DailyResultsModalProps {
  snap: GameSnapshot;
  activeDate: string;
  onClose: () => void;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getHeadline(hits: number, target: number, strikes: number, maxStrikes: number): string {
  if (hits === target) return "Perfect game!";
  if (strikes >= maxStrikes) return "Better luck tomorrow.";
  if (hits >= target * 0.8) return "So close!";
  if (hits >= target * 0.5) return "Solid effort.";
  return "Keep practicing.";
}

const RANK_EMOJI = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];

function rankEmoji(rank: number | null | undefined): string {
  if (rank == null || rank < 1 || rank > RANK_EMOJI.length) return "🟩";
  return RANK_EMOJI[rank - 1];
}

function buildShareText(snap: GameSnapshot, url: string): string {
  const hits = snap.candidates.filter((c) => !c.pending && c.isHit).length;
  const squares = snap.candidates
    .filter((c) => !c.pending)
    .map((c) => (c.isHit ? rankEmoji(c.rank) : "🟥"))
    .join("");
  return `CandidateChess Daily – ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}\n${hits}/${snap.targetMoves} candidate moves ${squares}\n${url}`;
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconDice() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
      <circle cx="16" cy="8" r="1.5" fill="currentColor" />
      <circle cx="8" cy="16" r="1.5" fill="currentColor" />
      <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export default function DailyResultsModal({ snap, activeDate, onClose }: DailyResultsModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const hits = snap.candidates.filter((c) => !c.pending && c.isHit).length;
  const resolved = snap.candidates.filter((c) => !c.pending);
  const shareUrl = window.location.href;
  const headline = getHeadline(hits, snap.targetMoves, snap.strikes, snap.maxStrikes);

  function handleShare() {
    navigator.clipboard.writeText(buildShareText(snap, shareUrl)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative bg-surface border border-edge rounded-2xl p-8 max-w-sm w-full mx-4 flex flex-col gap-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-faint hover:text-text transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-faint uppercase tracking-widest">Daily Challenge · {formatDate(activeDate)}</p>
          <h2 className="font-black text-2xl text-text">{headline}</h2>
        </div>

        {/* Score + squares */}
        <div className="bg-bg rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-4xl font-black text-text">{hits}</span>
            <span className="text-lg text-muted font-medium">/ {snap.targetMoves} moves found</span>
          </div>
          <div className="flex gap-2 text-2xl">
            {resolved.map((c, i) => (
              <span key={i} title={c.isHit ? `Move #${c.rank}` : "Miss"}>
                {c.isHit ? rankEmoji(c.rank) : "🟥"}
              </span>
            ))}
            {Array.from({ length: Math.max(0, snap.targetMoves - resolved.length) }).map((_, i) => (
              <span key={`empty-${i}`}>⬜</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleShare}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {copied ? <IconCheck /> : <IconClipboard />}
            {copied ? "Copied to clipboard!" : "Copy result"}
          </button>
          <button
            onClick={() => navigate("/random")}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-interactive hover:bg-interactive-hi transition-colors text-label flex items-center justify-center gap-2"
          >
            <IconDice />
            Play a random position
          </button>
        </div>
      </div>
    </div>
  );
}
