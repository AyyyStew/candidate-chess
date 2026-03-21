import { useEffect, useRef, useState } from "react";
import { useSessionSnapshot } from "../hooks/useSessionSnapshot";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameCoordinator } from "../hooks/useGameCoordinator";
import { createGameSession, type GameSession } from "../sessions/GameSession";
import { getPositionById } from "../services/positionService";
import { trackPuzzleVisit, trackPuzzleSolve, saveSolve } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { debug } from "../utils/debug";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import GameLayout from "../components/GameLayout";
import PositionBanner from "../components/PositionBanner";

function RandomPageContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const board = useBoard();
  const { ready, coordinatorRef } = useGameCoordinator();
  const { user } = useAuth();
  const [session, setSession] = useState<GameSession | null>(null);
  const snap = useSessionSnapshot(session);
  const hasStartedRef = useRef(false);

  const posParam = searchParams.get("pos");
  const startTimeRef = useRef(Date.now());
  const currentPosIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (posParam !== null) {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        loadById(posParam);
      }
    } else {
      hasStartedRef.current = true;
      startNext();
    }
  }, [ready, posParam]);

  async function loadById(id: string) {
    setSession(null);
    startTimeRef.current = Date.now();
    try {
      const position = await getPositionById(id);
      debug("RandomPage", position);
      const { analysis } =
        await coordinatorRef.current!.advanceWithPosition(position);
      board.resetTo(position.fen, position.orientation);
      trackPuzzleVisit(position.id);
      currentPosIdRef.current = position.id;
      setSession(createGameSession({ analysis, position }));
    } catch {
      setSearchParams({}, { replace: true });
      startNext();
    }
  }

  async function startNext() {
    setSession(null);
    startTimeRef.current = Date.now();
    const { position, analysis } = await coordinatorRef.current!.advance();
    board.resetTo(position.fen, position.orientation);
    setSearchParams({ pos: position.id }, { replace: true });
    trackPuzzleVisit(position.id);
    currentPosIdRef.current = position.id;
    setSession(createGameSession({ analysis, position }));
  }

  useEffect(() => {
    if (snap?.phase !== "done" || !currentPosIdRef.current) return;
    const resolved = snap.candidates.filter((c) => c.status !== "pending");
    const hits = resolved.filter(
      (c) => c.status === "hit" || c.status === "hidden_gem",
    ).length;
    const solveData = {
      strikesAllowed: snap.maxStrikes,
      strikesUsed: snap.strikes,
      movesFound: hits,
      totalMoves: snap.targetMoves,
      guesses: resolved.map((c) => c.move).join(","),
      timeMs: Date.now() - startTimeRef.current,
    };
    trackPuzzleSolve(currentPosIdRef.current, solveData);
    if (user) {
      saveSolve(currentPosIdRef.current, solveData);
    }
  }, [snap?.phase, user]);

  if (!snap) {
    return (
      <main className="flex items-center justify-center p-8 h-64">
        <p className="text-muted animate-pulse text-lg">Loading position...</p>
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 flex flex-col gap-6">
      {/* Page title */}
      <h1 className="font-black text-xl sm:text-3xl tracking-tight">
        Random Position
      </h1>

      {/* Full-width position banner */}
      <PositionBanner
        label={snap.label}
        event={snap.event}
        moveNumber={snap.moveNumber}
        orientation={snap.orientation}
        pgn={snap.pgn}
      />

      <GameLayout
        snap={snap}
        activeGame
        onReset={startNext}
        resetMessage="Play Another Position?"
        board={
          <BoardPanel
            snap={snap}
            onDrop={(from, to) => session?.submitMove(from, to)}
            locked={true}
            onStudyFromPosition={() =>
              navigate("/study", { state: { fen: board.fen } })
            }
            onPlayFromPosition={() =>
              navigate("/practice", { state: { fen: board.fen } })
            }
          />
        }
        panel={<GamePanel snap={snap} onNext={startNext} showHeader={false} />}
      />
    </main>
  );
}

export default function RandomPage() {
  return (
    <BoardProvider>
      <RandomPageContent />
    </BoardProvider>
  );
}
