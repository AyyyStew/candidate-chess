import React from "react";
import { useEngine } from "../contexts/EngineContext";
import FenInput from "./FenInput";
import AnalysisSettings from "./AnalysisSettings";
import FamilyFeudBoard from "./FamilyFeudBoard";
import CandidateList from "./CandidateList";
import ResultsPanel from "./ResultsPanel";
import { useBoard } from "../contexts/BoardContext";

export default function ControlPanel({
  mode,
  modeType,
  locked = false,
  onReset,
}) {
  const { engine, engineAnalysis } = useEngine();
  const board = useBoard();
  const { isIdle, isActive, isComparing, isDone, candidates, results } = mode;
  const boardTopMoves = isDone ? results.topMoves : engineAnalysis.liveTopMoves;

  function handleAnalyze() {
    board.snapToEnd();
    mode.start(board.fen);
  }

  return (
    <div className="flex-1 flex flex-col gap-5">
      {!locked && (
        <FenInput
          value={board.fenInput}
          onChange={board.setFenInput}
          onSet={board.handleSetPosition}
          disabled={!isIdle}
        />
      )}
      {!locked && isIdle && (
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
            modeType === "analysis"
              ? mode.setCandidateLimit
              : mode.setTargetMoves
          }
          onUseMovetimeChange={engineAnalysis.setUseMovetime}
          onMovetimeChange={engineAnalysis.setMovetime}
        />
      )}
      {!locked && isIdle && (
        <button
          onClick={handleAnalyze}
          disabled={!engine.ready}
          className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
        >
          {engine.ready ? "Analyze Position" : "Engine loading..."}
        </button>
      )}
      {locked && isIdle && (
        <p className="text-sm text-gray-400 animate-pulse">
          {engine.ready ? "Starting analysis..." : "Engine loading..."}
        </p>
      )}
      {modeType === "game" && !isIdle && (
        <FamilyFeudBoard
          topMoves={boardTopMoves}
          candidates={candidates}
          targetMoves={mode.targetMoves}
          isDone={isDone}
          strikes={mode.strikes}
          maxStrikes={mode.maxStrikes}
          onReset={
            onReset ??
            (() => {
              mode.reset();
              board.reset();
            })
          }
        />
      )}
      {modeType === "analysis" && !isIdle && (
        <>
          <CandidateList
            candidates={candidates}
            results={results}
            candidateLimit={mode.candidateLimit}
            onRemove={mode.removeCandidate}
          />
          {isActive && candidates.filter((c) => !c.pending).length > 0 && (
            <button
              onClick={mode.handleCompare}
              className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              Compare {candidates.length} move{candidates.length > 1 ? "s" : ""}
            </button>
          )}
          {isComparing && (
            <p className="text-gray-400 animate-pulse">
              Evaluating your moves...
            </p>
          )}
          {isDone && results && (
            <ResultsPanel
              results={results}
              onReset={
                onReset ??
                (() => {
                  mode.reset();
                  board.reset();
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}
