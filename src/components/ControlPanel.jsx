import React from "react";
import FenInput from "./FenInput";
import AnalysisSettings from "./AnalysisSettings";
import CandidateList from "./CandidateList";
import ResultsPanel from "./ResultsPanel";

export default function ControlPanel({ board, analysis, engine }) {
  const {
    phase,
    isIdle,
    isActive,
    isDone,
    candidates,
    results,
    candidateLimit,
    setCandidateLimit,
    depth,
    setDepth,
    topMoves,
    setTopMoves,
    useMovetime,
    setUseMovetime,
    movetime,
    setMovetime,
    handleAnalyze,
    handleCompare,
    handleReset,
  } = analysis;

  return (
    <div className="flex-1 flex flex-col gap-5">
      <FenInput
        value={board.fenInput}
        onChange={board.setFenInput}
        onSet={board.handleSetPosition}
        disabled={!isIdle}
      />

      {isIdle && (
        <AnalysisSettings
          depth={depth}
          topMoves={topMoves}
          candidateLimit={candidateLimit}
          useMovetime={useMovetime}
          movetime={movetime}
          onDepthChange={setDepth}
          onTopMovesChange={setTopMoves}
          onCandidateLimitChange={setCandidateLimit}
          onUseMovetimeChange={setUseMovetime}
          onMovetimeChange={setMovetime}
        />
      )}

      {isIdle && (
        <button
          onClick={() => {
            board.snapToEnd();
            analysis.handleAnalyze();
          }}
          disabled={!engine.ready}
          className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
        >
          {engine.ready ? "Analyze Position" : "Engine loading..."}
        </button>
      )}

      {!isIdle && (
        <CandidateList
          candidates={candidates}
          results={results}
          candidateLimit={candidateLimit}
          onRemove={analysis.handleRemoveCandidate}
        />
      )}

      {isActive && candidates.length > 0 && (
        <button
          onClick={handleCompare}
          className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          Compare {candidates.length} move{candidates.length > 1 ? "s" : ""}
        </button>
      )}

      {phase === "comparing" && (
        <p className="text-gray-400 animate-pulse">Evaluating your moves...</p>
      )}

      {isDone && results && (
        <ResultsPanel
          results={results}
          onReset={() => {
            handleReset();
            board.reset();
          }}
        />
      )}
    </div>
  );
}
