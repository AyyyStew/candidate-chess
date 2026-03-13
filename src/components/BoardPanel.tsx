import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import MoveHistory from "./MoveHistory";
import { useBoard } from "../contexts/BoardContext";
import StudyFromPositionButton from "./StudyFromPositionButton";
import type { GameSnapshot } from "../types";
import type { Square } from "chess.js";

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
  gameInfo?: React.ReactNode;
  onReset?: () => void;
  onStudyFromPosition?: () => void;
}

export default function BoardPanel({
  snap,
  onDrop,
  locked = false,
  gameInfo,
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

  const candidateArrows: [Square, Square, string][] = showArrows && !isPreviewing
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
    if (isIdle)
      return board.handleIdleDrop(sourceSquare, targetSquare, board.fen);
    if (isActive) {
      onDrop?.(sourceSquare, targetSquare);
      return false;
    }
    return false;
  }

  return (
    <div className="flex flex-col gap-2 w-120 shrink-0">
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setShowArrows((a) => !a)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${showArrows ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"}`}
          >
            ↗ Arrows
          </button>
          <button
            onClick={flipOrientation}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            ⇅ Flip Board
          </button>
        </div>
        {gameInfo}
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
            className="mt-2 w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-red-500 dark:hover:bg-red-700 hover:text-white transition-colors"
          >
            Reset Game
          </button>
        </>
      )}
    </div>
  );
}
