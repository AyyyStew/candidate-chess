import React from "react";
import { useStockfish } from "../hooks/useStockfish";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";
import { useGameLogic } from "../hooks/useGameLogic";
import { useBoardSetup } from "../hooks/useBoardSetup";
import BoardPanel from "../components/BoardPanel";
import ControlPanel from "../components/ControlPanel";

export default function GamePage() {
  const engine = useStockfish();
  const board = useBoardSetup();
  const engineAnalysis = useEngineAnalysis({ engine });
  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: board.fen,
  });

  return (
    <main className="flex gap-8 p-8 max-w-6xl mx-auto">
      <BoardPanel board={board} mode={gameLogic} />
      <ControlPanel
        board={board}
        mode={gameLogic}
        modeType="game"
        engine={engine}
        engineAnalysis={engineAnalysis}
      />
    </main>
  );
}
