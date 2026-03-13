import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import FenInput from "../components/FenInput";
import { makePosition } from "../types";
import type { GameSnapshot } from "../types";
import { isBlackToMove } from "../utils/chess";

function extractPgnMeta(pgn: string): { label: string; event: string } {
  const white = pgn.match(/\[White "([^"]+)"\]/i)?.[1];
  const black = pgn.match(/\[Black "([^"]+)"\]/i)?.[1];
  const event = pgn.match(/\[Event "([^"]+)"\]/i)?.[1] ?? "";
  const label =
    white && black ? `${white} vs ${black}` : "Custom Position";
  return { label, event };
}

function PracticePageContent() {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef<ReturnType<typeof createGameSession> | null>(null);
  const [snap, setSnap] = useState<GameSnapshot | null>(null);
  const [lastPgn, setLastPgn] = useState<string>("");

  const isIdle = !snap;

  function handleSetPgn(pgn: string): boolean {
    const result = board.handleSetPgn(pgn);
    if (result) setLastPgn(pgn);
    return result;
  }

  function handleSetPosition(): void {
    setLastPgn("");
    board.handleSetPosition();
  }

  function handleStart() {
    board.truncateToCurrentPosition();
    const fen = board.fen;
    const orientation = isBlackToMove(fen) ? "black" : "white";
    const { label, event } = lastPgn
      ? extractPgnMeta(lastPgn)
      : { label: "Custom Position", event: "" };
    const moveNumber =
      board.historyIndex >= 0
        ? Math.floor(board.historyIndex / 2) + 1
        : 1;

    const position = makePosition({ fen, label, event, moveNumber, orientation });
    const analysis = createEngineAnalysis({
      pool: engine,
      goCommand: "go depth 15",
      topMoveCount: 20,
    });
    analysis.startAnalysis(fen);

    const session = createGameSession({ analysis, position });
    session.onChange = setSnap;
    sessionRef.current = session;
    setSnap(session.getSnapshot());
  }

  function handleReset() {
    sessionRef.current = null;
    board.resetToCheckpoint();
    setSnap(null);
  }

  if (isIdle) {
    return (
      <main className="flex gap-8 p-8 max-w-6xl mx-auto">
        <BoardPanel snap={null} locked={false} onReset={board.reset} />
        <div className="flex-1 flex flex-col gap-5">
          <FenInput
            value={board.fenInput}
            onChange={board.setFenInput}
            onSet={handleSetPosition}
            onSetPgn={handleSetPgn}
            disabled={false}
            defaultMode={lastPgn ? "pgn" : "fen"}
            defaultPgn={lastPgn}
          />
          <button
            onClick={handleStart}
            disabled={!engine.ready}
            className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
          >
            {engine.ready ? "Start Game" : "Engine loading..."}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <div className="flex gap-8">
        <BoardPanel
          snap={snap}
          onDrop={(from, to) => sessionRef.current!.submitMove(from, to)}
          locked={true}
          onStudyFromPosition={() => navigate("/study", { state: { fen: board.fen } })}
        />
        <div className="flex-1 flex flex-col gap-5">
          <GamePanel
            snap={snap!}
            results={
              snap!.phase === "done"
                ? sessionRef.current!.getResults()
                : null
            }
            onNext={handleReset}
            resetMessage="Play Again"
          />
        </div>
      </div>
    </main>
  );
}

export default function PracticePage() {
  return (
    <BoardProvider>
      <PracticePageContent />
    </BoardProvider>
  );
}
