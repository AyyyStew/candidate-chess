import React from "react";
import { useEngine } from "../contexts/EngineContext";
import { useBoard } from "../contexts/BoardContext";
import FenInput from "./FenInput";
import AnalysisSettings from "./AnalysisSettings";

export default function SetupPanel({ mode, modeType }) {
  const { engine, engineAnalysis } = useEngine();
  const board = useBoard();

  function handleAnalyze() {
    board.snapToEnd();
    mode.start(board.fen);
  }

  return (
    <div className="flex flex-col gap-5">
      <FenInput
        value={board.fenInput}
        onChange={board.setFenInput}
        onSet={board.handleSetPosition}
        disabled={!mode.isIdle}
      />
      <AnalysisSettings
        depth={engineAnalysis.depth}
        topMoves={engineAnalysis.topMoveCount}
        candidateLimit={
          modeType === "analysis" ? mode.candidateLimit : mode.targetMoves
        }
        useMovetime={engineAnalysis.useMovetime}
        movetime={engineAnalysis.movetime}
        onDepthChange={engineAnalysis.setDepth}
        onTopMovesChange={engineAnalysis.setTopMoveCount}
        onCandidateLimitChange={
          modeType === "analysis" ? mode.setCandidateLimit : mode.setTargetMoves
        }
        onUseMovetimeChange={engineAnalysis.setUseMovetime}
        onMovetimeChange={engineAnalysis.setMovetime}
      />
      <button
        onClick={handleAnalyze}
        disabled={!engine.ready}
        className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
      >
        {engine.ready ? "Analyze Position" : "Engine loading..."}
      </button>
    </div>
  );
}
