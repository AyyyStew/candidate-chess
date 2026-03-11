import React from "react";
import { useStockfish } from "../hooks/useStockfish";
import { useEngineAnalysis } from "../hooks/useEngineAnalysis";
import { useAnalysisMode } from "../hooks/useAnalysisMode";
import { useBoardSetup } from "../hooks/useBoardSetup";
import BoardPanel from "../components/BoardPanel";
import ControlPanel from "../components/ControlPanel";

export default function StudyPage() {
  const engine = useStockfish();
  const board = useBoardSetup();
  const engineAnalysis = useEngineAnalysis({ engine });
  const analysisMode = useAnalysisMode({
    engineAnalysis,
    lockedFen: board.fen,
  });

  return (
    <main className="flex gap-8 p-8 max-w-6xl mx-auto">
      <BoardPanel board={board} mode={analysisMode} />
      <ControlPanel
        board={board}
        mode={analysisMode}
        modeType="analysis"
        engine={engine}
        engineAnalysis={engineAnalysis}
      />
    </main>
  );
}
