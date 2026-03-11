import React from "react";
import { EngineProvider, useEngine } from "../contexts/EngineContext";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useGameLogic } from "../hooks/useGameLogic";
import BoardPanel from "../components/BoardPanel";
import SetupPanel from "../components/SetupPanel";
import GamePanel from "../components/GamePanel";

function GamePageContent() {
  const { engineAnalysis } = useEngine();
  const board = useBoard();
  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: board.fen,
  });
  const { isIdle } = gameLogic;

  return (
    <main className="flex gap-8 p-8 max-w-6xl mx-auto">
      <BoardPanel mode={gameLogic} />
      <div className="flex-1 flex flex-col gap-5">
        {isIdle && <SetupPanel mode={gameLogic} modeType="game" />}
        {!isIdle && <GamePanel mode={gameLogic} />}
      </div>
    </main>
  );
}

export default function GamePage() {
  return (
    <EngineProvider>
      <BoardProvider>
        <GamePageContent />
      </BoardProvider>
    </EngineProvider>
  );
}
