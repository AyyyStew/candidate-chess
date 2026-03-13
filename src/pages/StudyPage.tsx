import React, { useRef, useState } from "react";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import { createStudySession } from "../sessions/StudySession";
import BoardPanel from "../components/BoardPanel";
import FenInput from "../components/FenInput";
import AnalysisSettings from "../components/AnalysisSettings";
import CandidateList from "../components/CandidateList";
import ResultsPanel from "../components/ResultsPanel";
import { Candidate } from "../types";

const MAX_CANDIDATES = 10;

function StudyPageContent() {
  const board = useBoard();
  const engine = useEnginePool();
  const sessionRef = useRef(null);
  const [snap, setSnap] = useState(null);
  const [depth, setDepth] = useState(15);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);
  const [topMoveCount, setTopMoveCount] = useState(5);
  const [minCandidates, setMinCandidates] = useState(3);

  const isIdle = !snap || snap.phase === "idle";
  const isActive = snap?.phase === "active";
  const isComparing = snap?.phase === "comparing";
  const isDone = snap?.phase === "done";

  function handleAnalyze() {
    board.truncateToCurrentPosition();
    const cmd = useMovetime ? `go movetime ${movetime}` : `go depth ${depth}`;
    const analysis = createEngineAnalysis({
      pool: engine,
      goCommand: cmd,
      topMoveCount,
    });
    const session = createStudySession({ analysis, minCandidates });
    session.onChange = setSnap;
    sessionRef.current = session;
    session.start(board.fen);
  }

  function handleDrop(sourceSquare: string, targetSquare: string): boolean {
    if (!sessionRef.current) return false;
    return sessionRef.current.addCandidate(sourceSquare, targetSquare);
  }
  function handleClearBoard() {
    sessionRef.current?.reset();
    board.reset();
    setSnap(null);
  }

  function handleReset() {
    sessionRef.current?.reset();
    board.resetToCheckpoint();
    setSnap(null);
  }

  const boardSnap = snap
    ? {
        phase: snap.phase,
        candidates: snap.candidates.map((c: Candidate) => ({ move: c.move })),
        results: snap.results,
      }
    : null;

  return (
    <main className="flex gap-8 p-8 max-w-6xl mx-auto">
      <BoardPanel
        snap={boardSnap}
        onDrop={handleDrop}
        locked={false}
        onReset={handleClearBoard}
      />
      <div className="flex-1 flex flex-col gap-5">
        {isIdle && (
          <>
            <FenInput
              value={board.fenInput}
              onChange={board.setFenInput}
              onSet={board.handleSetPosition}
              onSetPgn={board.handleSetPgn}
              disabled={false}
            />
            <AnalysisSettings
              depth={depth}
              topMoves={topMoveCount}
              candidateLimit={minCandidates}
              useMovetime={useMovetime}
              movetime={movetime}
              onDepthChange={setDepth}
              onTopMovesChange={setTopMoveCount}
              onCandidateLimitChange={setMinCandidates}
              onUseMovetimeChange={setUseMovetime}
              onMovetimeChange={setMovetime}
            />
            <button
              onClick={handleAnalyze}
              disabled={!engine.ready}
              className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
            >
              {engine.ready ? "Analyze Position" : "Engine loading..."}
            </button>
          </>
        )}

        {(isActive || isComparing) && (
          <>
            <CandidateList
              candidates={snap.candidates}
              results={null}
              candidateLimit={MAX_CANDIDATES}
              onRemove={(uci: string) =>
                sessionRef.current!.removeCandidate(uci)
              }
            />
            {isActive && (
              <button
                onClick={() => sessionRef.current.compare()}
                disabled={!snap.canCompare}
                className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
              >
                {!snap.analysisReady
                  ? "Engine thinking..."
                  : snap.candidates.length < snap.minCandidates
                    ? `Add ${snap.minCandidates - snap.candidates.length} more move${snap.minCandidates - snap.candidates.length > 1 ? "s" : ""} to compare`
                    : `Compare ${snap.candidates.length} move${snap.candidates.length > 1 ? "s" : ""}`}
              </button>
            )}
            {isComparing && (
              <p className="text-gray-400 animate-pulse text-center">
                Evaluating your moves...
              </p>
            )}
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              Start Over
            </button>
          </>
        )}

        {isDone && snap.results && (
          <>
            <CandidateList
              candidates={snap.results.candidates}
              results={snap.results}
              candidateLimit={MAX_CANDIDATES}
              onRemove={null}
            />
            <ResultsPanel results={snap.results} onReset={handleReset} />
          </>
        )}
      </div>
    </main>
  );
}

export default function StudyPage() {
  return (
    <BoardProvider>
      <StudyPageContent />
    </BoardProvider>
  );
}
