import React, { useState } from "react";
import { Helmet } from "react-helmet-async";
import { RefreshCw } from "lucide-react";
import { useSessionSnapshot } from "../hooks/useSessionSnapshot";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import GameSettings from "../components/GameSettings";
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
  const [searchParams] = useSearchParams();
  const board = useBoard();
  const engine = useEnginePool();
  const [session, setSession] = useState<GameSession | null>(null);
  const snap = useSessionSnapshot(session);
  const [lastPgn, setLastPgn] = useState<string>("");
  const [depth, setDepth] = useState(
    () => Number(searchParams.get("depth")) || 15,
  );
  const [useMovetime, setUseMovetime] = useState(
    () => searchParams.get("useMovetime") === "1",
  );
  const [movetime, setMovetime] = useState(
    () => Number(searchParams.get("movetime")) || 2000,
  );
  const [topMovesToFind, setTopMovesToFind] = useState(
    () => Number(searchParams.get("topMoves")) || 5,
  );
  const [maxStrikes, setMaxStrikes] = useState(
    () => Number(searchParams.get("maxStrikes")) || 5,
  );

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
    const params = new URLSearchParams();
    params.set("fen", fen);
    params.set("depth", String(depth));
    if (useMovetime) {
      params.set("useMovetime", "1");
      params.set("movetime", String(movetime));
    }
    params.set("topMoves", String(topMovesToFind));
    params.set("maxStrikes", String(maxStrikes));
    navigate({ search: `?${params.toString()}` }, { replace: true });
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
    const goCommand = useMovetime
      ? `go movetime ${movetime}`
      : `go depth ${depth}`;
    const analysis = createEngineAnalysis({
      pool: engine,
      goCommand,
      topMoveCount: topMovesToFind,
    });
    analysis.startAnalysis(fen);

    setSession(
      createGameSession({
        analysis,
        position,
        targetMoves: topMovesToFind,
        maxStrikes,
      }),
    );
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
          <GameSettings
            depth={depth}
            useMovetime={useMovetime}
            movetime={movetime}
            topMovesToFind={topMovesToFind}
            maxStrikes={maxStrikes}
            onDepthChange={setDepth}
            onUseMovetimeChange={setUseMovetime}
            onMovetimeChange={setMovetime}
            onTopMovesToFindChange={setTopMovesToFind}
            onMaxStrikesChange={setMaxStrikes}
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
              navigate(`/study?fen=${encodeURIComponent(board.fen)}`)
            }
            onPlayFromPosition={() =>
              navigate(`/custom?fen=${encodeURIComponent(board.fen)}`)
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
  const [searchParams] = useSearchParams();
  const initialFen = searchParams.get("fen") ?? undefined;
  return (
    <BoardProvider initialFen={initialFen}>
      <Helmet>
        <title>Custom Position — Candidate Chess</title>
        <meta
          name="description"
          content="Paste any FEN and practice candidate move thinking from your own chess position."
        />
      </Helmet>
      <CustomPageContent />
    </BoardProvider>
  );
}
