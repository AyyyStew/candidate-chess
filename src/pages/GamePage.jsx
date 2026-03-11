import React, { useEffect, useRef } from "react";
import { EngineProvider, useEngine } from "../contexts/EngineContext";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameLogic } from "../hooks/useGameLogic";
import { usePositionQueue } from "../hooks/usePositionQueue";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import LoadingPanel from "../components/LoadingPanel";

export default function GamePage() {
  return (
    <EngineProvider>
      <GamePageInner />
    </EngineProvider>
  );
}

function GamePageInner() {
  const { engine, engineAnalysis } = useEngine();
  const queue = usePositionQueue({
    engine,
    goCommand: engineAnalysis.goCommand,
    searchMoveCount: engineAnalysis.searchMoveCount,
  });

  return (
    <BoardProvider
      key={queue.current.fen}
      initialFen={queue.current.fen}
      initialOrientation={queue.current.orientation}
    >
      <GamePageContent queue={queue} />
    </BoardProvider>
  );
}
function GamePageContent({ queue }) {
  const { engine, engineAnalysis } = useEngine();
  const board = useBoard();
  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: queue.current.fen,
  });
  const { isIdle } = gameLogic;
  const skipAutoStartRef = useRef(false);

  useEffect(() => {
    if (engine.ready && isIdle) {
      if (skipAutoStartRef.current) {
        skipAutoStartRef.current = false;
        return;
      }
      gameLogic.start(queue.current.fen);
    }
  }, [engine.ready, isIdle]);

  function handleReset() {
    const next = queue.advance();
    if (next.preloaded) {
      skipAutoStartRef.current = true;
      engineAnalysis.loadPrecomputed(
        next.position.fen,
        next.topMoves,
        next.positionEval,
      );
      gameLogic.reset();
      gameLogic.startWithPreloaded(next.position.fen);
    } else {
      gameLogic.reset();
      // useEffect fires naturally when engine.ready && isIdle
    }
  }

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">Game</h1>
      <div className="flex gap-8">
        <BoardPanel
          mode={gameLogic}
          locked={true}
          gameInfo={
            <div className="text-right">
              <div className="font-semibold text-blue-700 dark:text-blue-200">
                {queue.current.label}
              </div>
              <div className="text-blue-600 dark:text-blue-300">
                {queue.current.event} — Move {queue.current.moveNumber}
              </div>
            </div>
          }
        />
        <div className="flex-1 flex flex-col gap-5">
          {isIdle && <LoadingPanel />}
          {!isIdle && <GamePanel mode={gameLogic} onReset={handleReset} />}
        </div>
      </div>
    </main>
  );
}
