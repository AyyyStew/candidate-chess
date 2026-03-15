import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameCoordinator } from "../hooks/useGameCoordinator";
import { createGameSession } from "../sessions/GameSession";
import { getPositionByIndex } from "../services/positionService";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import PositionBanner from "../components/PositionBanner";

function RandomPageContent() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const board = useBoard();
  const { ready, coordinatorRef } = useGameCoordinator();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const hasStartedRef = useRef(false);

  const posParam = searchParams.get("pos");

  useEffect(() => {
    if (!ready) return;
    if (posParam !== null) {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        loadByIndex(parseInt(posParam, 10));
      }
    } else {
      hasStartedRef.current = true;
      startNext();
    }
  }, [ready, posParam]);

  async function loadByIndex(index: number) {
    setSnap(null);
    try {
      const position = await getPositionByIndex(index);
      const { analysis } = await coordinatorRef.current!.advanceWithPosition(position);
      board.resetTo(position.fen, position.orientation);
      const session = createGameSession({ analysis, position });
      sessionRef.current = session;
      session.onChange = setSnap;
      setSnap(session.getSnapshot());
    } catch {
      setSearchParams({}, { replace: true });
      startNext();
    }
  }

  async function startNext() {
    setSnap(null);
    const { position, analysis } = await coordinatorRef.current!.advance();
    board.resetTo(position.fen, position.orientation);
    if (position.sourceIndex !== undefined) {
      setSearchParams({ pos: String(position.sourceIndex) }, { replace: true });
    }

    const session = createGameSession({ analysis, position });
    sessionRef.current = session;
    session.onChange = setSnap;
    setSnap(session.getSnapshot());
  }

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
      <h1 className="font-black text-3xl tracking-tight">Random Position</h1>

      {/* Full-width position banner */}
      <PositionBanner
        label={snap.label}
        event={snap.event}
        moveNumber={snap.moveNumber}
        orientation={snap.orientation}
        pgn={snap.pgn}
      />

      {/* Two-column content */}
      <div className="flex gap-8">
        <BoardPanel
          snap={snap}
          onDrop={(from, to) => sessionRef.current.submitMove(from, to)}
          locked={true}
          onStudyFromPosition={() => navigate("/study", { state: { fen: board.fen } })}
        />
        <div className="flex-1 flex flex-col gap-5">
          <GamePanel snap={snap} onNext={startNext} showHeader={false} />
        </div>
      </div>
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
