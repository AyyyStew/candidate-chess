import React from "react";
import { useIsMobile } from "../hooks/useIsMobile";
import StrikesPipsBar from "./StrikesPipsBar";
import GuessList from "./GuessList";
import FamilyFeudBoard from "./FamilyFeudBoard";
import type { GameSnapshot } from "../types";

interface GameLayoutProps {
  /** The BoardPanel node */
  board: React.ReactNode;
  /** Desktop right-column content (GamePanel or DailyResultsPanel) */
  panel: React.ReactNode;
  /** Current game snapshot — when provided and activeGame=true, enables the
   *  full mobile game layout (strikes+pips, board, guess list, eval board). */
  snap?: GameSnapshot | null;
  /** Set false when the right panel is a results panel rather than an active
   *  game panel — mobile will just stack board + panel instead. */
  activeGame?: boolean;
  /** Action buttons rendered below the panel/board when the game is done. */
  actions?: React.ReactNode;
}

export default function GameLayout({
  board,
  panel,
  snap,
  activeGame = true,
  actions,
}: GameLayoutProps) {
  const isMobile = useIsMobile();

  // ── Desktop: two-column layout ────────────────────────────────────────────
  if (!isMobile) {
    return (
      <div className="flex gap-8">
        {board}
        <div className="flex-1 flex flex-col gap-5">
          {panel}
          {actions}
        </div>
      </div>
    );
  }

  // ── Mobile: simple stack (no active game, or no snap yet) ─────────────────
  if (!snap || !activeGame) {
    return (
      <div className="flex flex-col gap-5">
        {board}
        {panel}
        {actions}
      </div>
    );
  }

  // ── Mobile: active game layout ────────────────────────────────────────────
  const isDone = snap.phase === "done";

  return (
    <div className="flex flex-col gap-4">
      <StrikesPipsBar snap={snap} />
      {board}
      <GuessList
        candidates={snap.candidates}
        topMoves={snap.liveTopMoves ?? []}
        fen={snap.fen}
        isDone={isDone}
      />
      {isDone && (
        <FamilyFeudBoard
          fen={snap.fen}
          topMoves={snap.liveTopMoves ?? []}
          candidates={snap.candidates}
          targetMoves={snap.targetMoves}
          isDone={isDone}
          strikes={snap.strikes}
          maxStrikes={snap.maxStrikes}
          isMobile
        />
      )}
      {isDone && actions}
    </div>
  );
}
