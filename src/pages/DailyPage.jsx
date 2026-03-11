import React, { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { EngineProvider, useEngine } from "../contexts/EngineContext";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameLogic } from "../hooks/useGameLogic";
import BoardPanel from "../components/BoardPanel";
import GamePanel from "../components/GamePanel";
import LoadingPanel from "../components/LoadingPanel";
import { getDailyPosition } from "../services/dailyService";

function DailyPageContent({ daily }) {
  const navigate = useNavigate();
  const { engine, engineAnalysis } = useEngine();
  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: daily.fen,
  });
  const { isIdle } = gameLogic;

  useEffect(() => {
    if (engine.ready && isIdle) {
      gameLogic.start(daily.fen);
    }
  }, [engine.ready, isIdle]);

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">
        Daily Game
      </h1>
      <div className="flex gap-8">
        <BoardPanel
          mode={gameLogic}
          locked={true}
          gameInfo={
            <div className="text-right">
              <div className="font-semibold text-blue-700 dark:text-blue-200">
                {daily.label}
              </div>
              <div className="text-blue-600 dark:text-blue-300">
                {daily.event} - Move {daily.moveNumber}
              </div>
            </div>
          }
        />
        <div className="flex-1 flex flex-col gap-5">
          {isIdle && <LoadingPanel />}
          {!isIdle && (
            <GamePanel
              mode={gameLogic}
              onReset={() => navigate("/game")}
              resetMessage={"Play Another Position"}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function DailyPageInner() {
  const daily = useMemo(() => getDailyPosition(), []);
  return (
    <BoardProvider
      initialFen={daily.fen}
      initialOrientation={daily.orientation}
    >
      <DailyPageContent daily={daily} />
    </BoardProvider>
  );
}

export default function DailyPage() {
  return (
    <EngineProvider>
      <DailyPageInner />
    </EngineProvider>
  );
}
