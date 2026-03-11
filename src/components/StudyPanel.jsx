import React from "react";
import { useBoard } from "../contexts/BoardContext";
import CandidateList from "./CandidateList";
import ResultsPanel from "./ResultsPanel";

export default function StudyPanel({ mode, onReset }) {
  const board = useBoard();
  const { isActive, isComparing, isDone, candidates, results } = mode;

  const handleReset =
    onReset ??
    (() => {
      mode.reset();
      board.reset();
    });

  return (
    <div className="flex flex-col gap-5">
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
        <p className="text-gray-400 animate-pulse">Evaluating your moves...</p>
      )}
      {isDone && results && (
        <ResultsPanel results={results} onReset={handleReset} />
      )}
    </div>
  );
}
