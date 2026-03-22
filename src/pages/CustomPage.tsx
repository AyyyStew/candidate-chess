import React, { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useSessionSnapshot } from "../hooks/useSessionSnapshot";
import { useNavigate, useLocation } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { createGameSession, type GameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import GameLayout from "../components/GameLayout";
import GameResultsPanel from "../components/GameResultsPanel";
import PositionBanner from "../components/PositionBanner";
import FenInput from "../components/FenInput";
import { makePosition } from "../types";
import { isBlackToMove } from "../utils/chess";

function extractPgnMeta(pgn: string): { label: string; event: string } {
  const white = pgn.match(/\[White "([^"]+)"\]/i)?.[1];
  const black = pgn.match(/\[Black "([^"]+)"\]/i)?.[1];
  const event = pgn.match(/\[Event "([^"]+)"\]/i)?.[1] ?? "";
  const label = white && black ? `${white} vs ${black}` : "Custom Position";
  return { label, event };
}

function CustomPageContent() {
  const navigate = useNavigate();
  const board = useBoard();
  const engine = useEnginePool();
  const [session, setSession] = useState<GameSession | null>(null);
  const snap = useSessionSnapshot(session);
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
    board.setBoardOrientation(orientation);
    const { label, event } = lastPgn
      ? extractPgnMeta(lastPgn)
      : { label: "Custom Position", event: "" };
    const moveNumber =
      board.historyIndex >= 0 ? Math.floor(board.historyIndex / 2) + 1 : 1;

    const position = makePosition({
      fen,
      label,
      event,
      moveNumber,
      orientation,
    });
    const analysis = createEngineAnalysis({
      pool: engine,
      goCommand: "go depth 15",
      topMoveCount: 20,
    });
    analysis.startAnalysis(fen);

    setSession(createGameSession({ analysis, position }));
  }

  function handleReset() {
    setSession(null);
    board.resetToCheckpoint();
  }

  if (isIdle) {
    return (
      <main className="flex flex-col lg:flex-row gap-8 p-8 max-w-6xl mx-auto">
        <BoardPanel
          snap={null}
          locked={false}
          onReset={board.reset}
          onResetBoard={board.resetToStartingPosition}
        />
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
            className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-interactive-hi text-white transition-colors"
          >
            {engine.ready ? "Start Game" : "Engine loading..."}
          </button>
        </div>
      </main>
    );
  }

  const isDone = snap?.phase === "done";

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <PositionBanner
        label={snap.label}
        event={snap.event}
        moveNumber={snap.moveNumber}
        orientation={snap.orientation}
        pgn={snap.pgn}
      />
      <GameLayout
        snap={snap}
        activeGame={!isDone}
        board={
          <BoardPanel
            snap={snap}
            onDrop={(from, to) => session?.submitMove(from, to)}
            locked={true}
            onStudyFromPosition={() =>
              navigate("/study", { state: { fen: board.fen } })
            }
            onPlayFromPosition={() =>
              navigate("/custom", { state: { fen: board.fen } })
            }
          />
        }
        panel={
          isDone ? (
            <GameResultsPanel
              snap={snap}
              shareTitle="Custom Position"
              primaryAction={{
                label: "Play Again",
                icon: RefreshCw,
                onClick: handleReset,
              }}
            />
          ) : (
            <GamePanel snap={snap} />
          )
        }
      />
    </main>
  );
}

export default function CustomPage() {
  const location = useLocation();
  const initialFen = (location.state as { fen?: string } | null)?.fen;
  return (
    <BoardProvider initialFen={initialFen}>
      <CustomPageContent />
    </BoardProvider>
  );
}
