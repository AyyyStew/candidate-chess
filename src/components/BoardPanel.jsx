import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import MoveHistory from "./MoveHistory";

export default function BoardPanel({ board, analysis }) {
  const [showArrows, setShowArrows] = useState(true);

  const {
    fen,
    boardOrientation,
    flipOrientation,
    moveHistory,
    historyIndex,
    handleNavigate,
  } = board;
  const {
    isIdle,
    isActive,
    isDone,
    candidates,
    results,
    candidateLimit,
    handleReset,
  } = analysis;

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
    if (isIdle) return board.handleIdleDrop(sourceSquare, targetSquare, fen);
    if (isActive) return analysis.handleActiveDrop(sourceSquare, targetSquare);
    return false;
  }

  return (
    <div className="flex flex-col gap-2 w-120 shrink-0">
      {/* Board controls */}
      <div className="flex gap-2 self-end">
        <button
          onClick={() => setShowArrows((a) => !a)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors
            ${
              showArrows
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
            }`}
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

      {/* Board */}
      <Chessboard
        position={fen}
        onPieceDrop={handlePieceDrop}
        boardOrientation={boardOrientation}
        arePiecesDraggable={
          isIdle || (isActive && candidates.length < candidateLimit)
        }
        customArrows={candidateArrows}
      />

      {/* Move history */}
      <MoveHistory
        history={moveHistory}
        currentIndex={historyIndex}
        onNavigate={handleNavigate}
        disabled={!isIdle}
      />

      {/* Reset button */}
      <button
        onClick={() => {
          analysis.handleReset();
          board.reset();
        }}
        className="mt-2 w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-red-500 dark:hover:bg-red-700 hover:text-white transition-colors"
      >
        Start Over
      </button>
    </div>
  );
}
