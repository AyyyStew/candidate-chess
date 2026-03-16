import React, { useState, useMemo, useRef, useEffect } from "react";
import { Chessboard } from "react-chessboard";
import MoveHistory from "./MoveHistory";
import { useBoard } from "../contexts/BoardContext";
import StudyFromPositionButton from "./StudyFromPositionButton";
import type { GameSnapshot } from "../types";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import { playMoveSound, playBounceSound } from "../utils/sounds";
interface BoardSnap {
  phase: string;
  candidates: { move: string }[];
  results?: { topMoves: { move: string }[] } | null;
  /** Top engine moves from GameSnapshot — used to draw arrows when done */
  liveTopMoves?: { move: string }[];
}

interface BoardPanelProps {
  snap?: BoardSnap | null;
  onDrop?: (sourceSquare: string, targetSquare: string) => void;
  locked?: boolean;
  onReset?: () => void;
  onStudyFromPosition?: () => void;
  onPlayFromPosition?: () => void;
}

export default function BoardPanel({
  snap,
  onDrop,
  locked = false,
  onReset,
  onStudyFromPosition,
  onPlayFromPosition,
}: BoardPanelProps) {
  const [showArrows, setShowArrows] = useState(true);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const board = useBoard();
  const {
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleNavigate,
    isPreviewing,
  } = board;

  useEffect(() => {
    const el = boardContainerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", prevent, { passive: false });
    return () => el.removeEventListener("touchmove", prevent);
  }, []);

  const isIdle = !snap;
  const isActive = snap?.phase === "active";
  const isDone = snap?.phase === "done";
  const candidates = snap?.candidates ?? [];
  const results = snap?.results ?? null;
  // Game pages expose liveTopMoves instead of results.topMoves
  const topMovesForArrows = results?.topMoves ?? (isDone ? (snap?.liveTopMoves ?? []) : []);

  const TOP_MOVE_COLORS = ["rgba(234, 179, 8, 0.92)", "rgba(148, 163, 184, 0.80)", "rgba(180, 83, 9, 0.82)"];

  const candidateArrows = useMemo<[Square, Square, string][]>(() => {
    if (!showArrows || isPreviewing) return [];
    const from = (m: { move: string }) => m.move.slice(0, 2) as Square;
    const to   = (m: { move: string }) => m.move.slice(2, 4) as Square;
    return [
      ...candidates.map((c): [Square, Square, string] => [from(c), to(c), "rgba(59, 130, 246, 0.75)"]),
      ...(isDone ? topMovesForArrows.slice(0, 3).map((m, i): [Square, Square, string] => [from(m), to(m), TOP_MOVE_COLORS[i]]) : []),
    ];
  }, [showArrows, isPreviewing, candidates, isDone, topMovesForArrows]);

  function handleSquareClick(square: Square) {
    if (!isIdle && !isActive) return;
    const chess = new Chess(board.fen);
    const piece = chess.get(square);
    const turn = chess.turn();

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }
      // Re-select if clicking another movable piece
      const isFriendly = piece && (isIdle || piece.color === turn);
      if (isFriendly) {
        setSelectedSquare(square);
        return;
      }
      handlePieceDrop(selectedSquare, square);
      setSelectedSquare(null);
    } else {
      if (piece && (isIdle || piece.color === turn)) {
        setSelectedSquare(square);
      }
    }
  }

  const customSquareStyles = useMemo<Record<string, Record<string, string | number>>>(() => {
    if (!selectedSquare) return {};
    return {
      [selectedSquare]: { backgroundColor: "rgba(59, 130, 246, 0.45)" },
    };
  }, [selectedSquare]);

  function handlePieceDrop(
    sourceSquare: string,
    targetSquare: string,
  ): boolean {
    if (isIdle) {
      const success = board.handleIdleDrop(
        sourceSquare,
        targetSquare,
        board.fen,
      );
      if (success) playMoveSound();
      else playBounceSound();
      return success;
    }
    if (isActive) {
      try {
        const valid = !!new Chess(board.fen).move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
        if (valid) playMoveSound();
        else playBounceSound();
      } catch {
        playBounceSound();
      }
      onDrop?.(sourceSquare, targetSquare);
      return false;
    }
    return false;
  }

  return (
    <div className="lg:sticky lg:top-8 lg:self-start">
      <div className="flex flex-col gap-2 w-full lg:w-120 lg:shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setShowArrows((a) => !a)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border ${
              showArrows
                ? "bg-accent/15 text-accent border-accent/40 hover:bg-accent/25"
                : "bg-surface-hi text-muted border-edge-hi hover:text-label hover:bg-interactive"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
            Arrows
          </button>
          <button
            onClick={flipOrientation}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-hi text-muted border border-edge-hi hover:text-label hover:bg-interactive transition-all flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            Flip
          </button>
        </div>
        <div ref={boardContainerRef}>
          <Chessboard
            position={board.fen}
            onPieceDrop={handlePieceDrop}
            onSquareClick={handleSquareClick}
            boardOrientation={boardOrientation}
            arePiecesDraggable={isIdle || isActive}
            customArrows={candidateArrows}
            customSquareStyles={customSquareStyles}
          />
        </div>
        {onStudyFromPosition && (
          <StudyFromPositionButton
            onStudy={onStudyFromPosition}
            onPlay={onPlayFromPosition}
          />
        )}
        {!locked && (
          <>
            <MoveHistory
              history={moveHistory}
              currentIndex={historyIndex}
              onNavigate={handleNavigate}
              disabled={!isIdle}
            />
            <button
              onClick={() => {
                onReset ? onReset() : board.reset();
              }}
              className="mt-2 w-full py-2.5 rounded-xl font-semibold bg-interactive hover:bg-red-700 hover:text-white transition-colors"
            >
              Reset Game
            </button>
          </>
        )}
      </div>
    </div>
  );
}
