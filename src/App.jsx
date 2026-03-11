import React, { useState } from "react";
import { useStockfish } from "./hooks/useStockfish";
import { useDarkMode } from "./hooks/useDarkMode";
import { useBoardSetup } from "./hooks/useBoardSetup";
import { useEngineAnalysis } from "./hooks/useEngineAnalysis";
import { useGameLogic } from "./hooks/useGameLogic";
import { useAnalysisMode } from "./hooks/useAnalysisMode";
import Header from "./components/Header";
import BoardPanel from "./components/BoardPanel";
import ControlPanel from "./components/ControlPanel";

export default function App() {
  const { dark, toggleDark } = useDarkMode();
  const engine = useStockfish();
  const board = useBoardSetup();
  const engineAnalysis = useEngineAnalysis({ engine });

  const [mode, setMode] = useState("game"); // "game" | "analysis"

  const gameLogic = useGameLogic({
    engine: engineAnalysis,
    lockedFen: board.fen,
  });
  const analysisMode = useAnalysisMode({
    engineAnalysis,
    lockedFen: board.fen,
  });

  // pick active mode
  const activeMode = mode === "game" ? gameLogic : analysisMode;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Header
        dark={dark}
        onToggle={toggleDark}
        mode={mode}
        onModeChange={setMode}
      />
      <main className="flex gap-8 p-8 max-w-6xl mx-auto">
        <BoardPanel board={board} mode={activeMode} />
        <ControlPanel
          board={board}
          mode={activeMode}
          modeType={mode}
          engine={engine}
          engineAnalysis={engineAnalysis}
        />
      </main>
    </div>
  );
}
