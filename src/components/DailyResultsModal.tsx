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

function buildShareText(snap: GameSnapshot, url: string): string {
  const hits = snap.candidates.filter((c) => !c.pending && c.isHit).length;
  const squares = snap.candidates
    .filter((c) => !c.pending)
    .map((c) => (c.isHit ? "🟩" : "🟥"))
    .join("");

  return `CandidateChess Daily\nI found ${hits}/${snap.targetMoves} moves ${squares}\n${url}`;
}

export default function DailyResultsModal({ snap, activeDate, onClose }: DailyResultsModalProps) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const hits = snap.candidates.filter((c) => !c.pending && c.isHit).length;
  const shareUrl = window.location.href;

  function handleShare() {
    const text = buildShareText(snap, shareUrl);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handlePlayRandom() {
    navigate("/random");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Card */}
      <div
        className="relative bg-surface border border-edge rounded-2xl p-8 max-w-sm w-full mx-4 flex flex-col gap-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-faint hover:text-text transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="flex flex-col gap-1">
          <p className="text-xs text-faint uppercase tracking-widest">Daily Challenge</p>
          <h2 className="font-black text-2xl text-text">{formatDate(activeDate)}</h2>
        </div>

        {/* Score */}
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold text-label">
            Found{" "}
            <span className="text-text font-black">{hits}/{snap.targetMoves}</span>{" "}
            moves
          </p>

          {/* Emoji squares */}
          <div className="flex gap-1.5 text-2xl">
            {snap.candidates
              .filter((c) => !c.pending)
              .map((c, i) => (
                <span key={i}>{c.isHit ? "🟩" : "🟥"}</span>
              ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "var(--color-accent)", color: "#fff" }}
          >
            {copied ? "Copied!" : "Share Result"}
          </button>
          <button
            onClick={handlePlayRandom}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-interactive hover:bg-interactive-hi transition-colors text-label"
          >
            Play a Random Position
          </button>
        </div>
      </div>
    </div>
  );
}
