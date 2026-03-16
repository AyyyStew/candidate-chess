import React, { useState } from "react";
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
  results?: {
    topMoves: { move: string }[];
  } | null;
}

interface BoardPanelProps {
  snap?: BoardSnap | null;
  onDrop?: (sourceSquare: string, targetSquare: string) => void;
  locked?: boolean;
  onReset?: () => void;
  onStudyFromPosition?: () => void;
}

export default function BoardPanel({
  snap,
  onDrop,
  locked = false,
  onReset,
  onStudyFromPosition,
}: BoardPanelProps) {
  const [showArrows, setShowArrows] = useState(true);
  const board = useBoard();
  const {
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleNavigate,
    isPreviewing,
  } = board;

  const isIdle = !snap;
  const isActive = snap?.phase === "active";
  const isDone = snap?.phase === "done";
  const candidates = snap?.candidates ?? [];
  const results = snap?.results ?? null;

  const candidateArrows: [Square, Square, string][] =
    showArrows && !isPreviewing
      ? [
          ...candidates.map((c): [Square, Square, string] => [
            c.move.slice(0, 2) as Square,
            c.move.slice(2, 4) as Square,
            "rgb(0, 100, 255)",
          ]),
          ...(isDone && results
            ? [
                results.topMoves[0]
                  ? ([
                      results.topMoves[0].move.slice(0, 2) as Square,
                      results.topMoves[0].move.slice(2, 4) as Square,
                      "rgb(255, 180, 0)",
                    ] as [Square, Square, string])
                  : null,
                results.topMoves[1]
                  ? ([
                      results.topMoves[1].move.slice(0, 2) as Square,
                      results.topMoves[1].move.slice(2, 4) as Square,
                      "rgb(180, 180, 180)",
                    ] as [Square, Square, string])
                  : null,
                results.topMoves[2]
                  ? ([
                      results.topMoves[2].move.slice(0, 2) as Square,
                      results.topMoves[2].move.slice(2, 4) as Square,
                      "rgb(180, 100, 0)",
                    ] as [Square, Square, string])
                  : null,
              ].filter((x): x is [Square, Square, string] => x !== null)
            : []),
        ]
      : [];

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
        <Chessboard
          position={board.fen}
          onPieceDrop={handlePieceDrop}
          boardOrientation={boardOrientation}
          arePiecesDraggable={isIdle || isActive}
          customArrows={candidateArrows}
        />
        {onStudyFromPosition && (
          <StudyFromPositionButton onStudy={onStudyFromPosition} />
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
