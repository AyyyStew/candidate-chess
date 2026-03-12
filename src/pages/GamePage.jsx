// FILE: src/pages/GamePage.jsx
import React, { useEffect, useRef, useState } from "react";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameCoordinator } from "../hooks/useGameCoordinator";
import { createGameSession } from "../sessions/GameSession";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";

function GamePageContent() {
  const board = useBoard();
  const { ready, coordinatorRef } = useGameCoordinator();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState("Engine loading...");
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!ready || hasStartedRef.current) return;
    hasStartedRef.current = true;
    setLoadingMessage("Starting analysis...");
    startNext();
  }, [ready]);

  async function startNext() {
    setSnap(null);
    setLoadingMessage("Loading position...");

    const coordinator = coordinatorRef.current;
    if (!coordinator) return;

    const { position, analysis, preloaded } = await coordinator.advance();
    board.resetTo(position.fen, position.orientation);

    if (!preloaded) {
      setLoadingMessage("Engine thinking...");
      await analysis.waitForAnalysis(); // now safe — resolves immediately if already done
    }

    const session = createGameSession({ analysis, position });
    session.onChange = setSnap;
    sessionRef.current = session;
    setSnap(session.getSnapshot());
  }

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">Game</h1>

      {!snap ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-400 animate-pulse text-lg">
            {loadingMessage}
          </p>
        </div>
      ) : (
        <div className="flex gap-8">
          <BoardPanel
            snap={snap}
            onDrop={(from, to) => sessionRef.current.submitMove(from, to)}
            locked={true}
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
              results={
                snap.phase === "done" ? sessionRef.current.getResults() : null
              }
              onNext={startNext}
            />
          </div>
        </div>
      )}
    </main>
  );
}

export default function GamePage() {
  return (
    <BoardProvider>
      <GamePageContent />
    </BoardProvider>
  );
}
