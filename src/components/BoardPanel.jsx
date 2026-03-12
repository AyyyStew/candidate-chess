import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import MoveHistory from "./MoveHistory";
import { useBoard } from "../contexts/BoardContext";

export default function BoardPanel({ snap, onDrop, locked = false, gameInfo }) {
  const [showArrows, setShowArrows] = useState(true);
  const board = useBoard();
  const {
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleNavigate,
  } = board;

  const isIdle = !snap;
  const isActive = snap?.phase === "active";
  const isDone = snap?.phase === "done";
  const candidates = snap?.candidates ?? [];
  const results = snap?.results ?? null;

  const candidateArrows = showArrows
    ? [
        ...candidates.map((c) => [
          c.move.slice(0, 2),
          c.move.slice(2, 4),
          "rgb(0, 100, 255)",
        ]),
        ...(isDone && results
          ? [
              results.topMoves[0]
                ? [
                    results.topMoves[0].move.slice(0, 2),
                    results.topMoves[0].move.slice(2, 4),
                    "rgb(255, 180, 0)",
                  ]
                : null,
              results.topMoves[1]
                ? [
                    results.topMoves[1].move.slice(0, 2),
                    results.topMoves[1].move.slice(2, 4),
                    "rgb(180, 180, 180)",
                  ]
                : null,
              results.topMoves[2]
                ? [
                    results.topMoves[2].move.slice(0, 2),
                    results.topMoves[2].move.slice(2, 4),
                    "rgb(180, 100, 0)",
                  ]
                : null,
            ].filter(Boolean)
          : []),
      ]
    : [];

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (isIdle)
      return board.handleIdleDrop(sourceSquare, targetSquare, board.fen);
    if (isActive) return onDrop?.(sourceSquare, targetSquare);
    return false;
  }

  return (
    <div className="flex flex-col gap-2 w-[480px] shrink-0">
      <div className="flex gap-2 justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setShowArrows((a) => !a)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors
              ${showArrows ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"}`}
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
              board.reset();
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
