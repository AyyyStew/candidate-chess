import React, { useMemo, useEffect } from "react";
import { useStockfish } from "../hooks/useStockfish";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";
import { useGameLogic } from "../hooks/useGameLogic";
import { useBoardSetup } from "../hooks/useBoardSetup";
import BoardPanel from "../components/BoardPanel";
import ControlPanel from "../components/ControlPanel";
import { getDailyPosition } from "../services/dailyService";
import { useNavigate } from "react-router-dom";

export default function DailyPage() {
  const navigate = useNavigate();
  const daily = useMemo(() => getDailyPosition(), []);

  const engine = useStockfish();
  const board = useBoardSetup({
    initialFen: daily.fen,
    initialOrientation: daily.orientation,
  });
  const engineAnalysis = useEngineAnalysis({ engine });
  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: daily.fen,
  });

  // Auto-start analysis once engine is ready
  useEffect(() => {
    if (engine.ready && gameLogic.isIdle) {
      gameLogic.start(daily.fen);
    }
  }, [engine.ready, gameLogic.isIdle]);

  return (
    <main className="flex flex-col gap-4 p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-center underline mb-6">
        Daily Game
      </h1>

      <div className="flex gap-8">
        <BoardPanel
          board={board}
          mode={gameLogic}
          onReset={() => navigate("/game")}
          locked={true}
          gameInfo={
            <>
              <div className="text-right">
                <div className="font-semibold text-blue-700 dark:text-blue-200">
                  {daily.label}
                </div>
                <div className="text-blue-600 dark:text-blue-300">
                  {daily.event} - Move {daily.moveNumber}
                </div>
              </div>
            </>
          }
        />
        <ControlPanel
          board={board}
          mode={gameLogic}
          modeType="game"
          engine={engine}
          engineAnalysis={engineAnalysis}
          locked={true}
          onReset={() => navigate("/game")}
        />
      </div>
    </main>
  );
}
