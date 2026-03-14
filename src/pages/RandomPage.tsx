import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameCoordinator } from "../hooks/useGameCoordinator";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";

function RandomPageContent() {
  const navigate = useNavigate();
  const board = useBoard();
  const { ready, coordinatorRef } = useGameCoordinator();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!ready || hasStartedRef.current) return;
    hasStartedRef.current = true;
    startNext();
  }, [ready]);

  async function startNext() {
    setSnap(null);
    const { position, analysis } = await coordinatorRef.current!.advance();
    board.resetTo(position.fen, position.orientation);

    const session = createGameSession({ analysis, position });
    sessionRef.current = session;
    session.onChange = setSnap;
    setSnap(session.getSnapshot());
  }

  if (!snap) {
    return (
      <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-center underline mb-6">
          Random Game
        </h1>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 animate-pulse text-lg">
            Loading position...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">
        Random Game
      </h1>
      <div className="flex gap-8">
        <BoardPanel
          snap={snap}
          onDrop={(from, to) => sessionRef.current.submitMove(from, to)}
          locked={true}
          onStudyFromPosition={() => navigate("/study", { state: { fen: board.fen } })}
          gameInfo={
            <div className="text-right">
              <div className="font-semibold text-blue-700 dark:text-blue-200">
                {snap.label}
              </div>
              <div className="text-blue-600 dark:text-blue-300">
                {snap.event} — Move {snap.moveNumber}
              </div>
            </div>
          }
        />
        <div className="flex-1 flex flex-col gap-5">
          <GamePanel
            snap={snap}
            onNext={startNext}
          />
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
