import React from "react";
import { EngineProvider, useEngine } from "../contexts/EngineContext";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useAnalysisMode } from "../hooks/useAnalysisMode";
import BoardPanel from "../components/BoardPanel";
import SetupPanel from "../components/SetupPanel";
import StudyPanel from "../components/StudyPanel";

function StudyPageContent() {
  const { engineAnalysis } = useEngine();
  const board = useBoard();
  const analysisMode = useAnalysisMode({
    engineAnalysis,
    lockedFen: board.fen,
  });
  const { isIdle } = analysisMode;

  return (
    <main className="flex gap-8 p-8 max-w-6xl mx-auto">
      <BoardPanel mode={analysisMode} />
      <div className="flex-1 flex flex-col gap-5">
        {isIdle && <SetupPanel mode={analysisMode} modeType="analysis" />}
        {!isIdle && <StudyPanel mode={analysisMode} />}
      </div>
    </main>
  );
}

function StudyPageInner() {
  return (
    <BoardProvider>
      <StudyPageContent />
    </BoardProvider>
  );
}

export default function StudyPage() {
  return (
    <EngineProvider>
      <StudyPageInner />
    </EngineProvider>
  );
}
