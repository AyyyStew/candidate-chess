import { useState } from "react";
import { useSessionSnapshot } from "../hooks/useSessionSnapshot";
import { useLocation } from "react-router-dom";
import { BoardProvider, useBoard } from "../contexts/BoardContext";
import { useEnginePool } from "../hooks/useEnginePool";
import { useIsMobile } from "../hooks/useIsMobile";
import { createEngineAnalysis } from "../engine/engineAnalysis";
import {
  createStudySession,
  type StudySession,
} from "../sessions/StudySession";
import BoardPanel from "../components/BoardPanel";
import FenInput from "../components/FenInput";
import AnalysisSettings from "../components/AnalysisSettings";
import CandidateList from "../components/CandidateList";
import ResultsPanel from "../components/ResultsPanel";
import { Candidate } from "../types";

function StudyPageContent() {
  const isMobile = useIsMobile();
  const board = useBoard();
  const engine = useEnginePool();
  const [session, setSession] = useState<StudySession | null>(null);
  const snap = useSessionSnapshot(session);
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
    const newSession = createStudySession({ analysis, minCandidates });
    newSession.start(board.fen);
    setSession(newSession);
  }

  function handleDrop(sourceSquare: string, targetSquare: string): boolean {
    if (!session) return false;
    return session.addCandidate(sourceSquare, targetSquare);
  }

  function handleClearBoard() {
    session?.reset();
    board.reset();
    setSession(null);
  }

  function handleReset() {
    session?.reset();
    board.resetToCheckpoint();
    setSession(null);
  }

  function handleStudyFromPreview() {
    const positionFen = board.fen;
    session?.reset();
    setSession(null);
    board.startFromFen(positionFen);
  }

  const boardSnap = snap
    ? {
        phase: snap.phase,
        candidates: snap.candidates.map((c: Candidate) => ({ move: c.move })),
        results: snap.results,
      }
    : null;

  const boardPanel = (
    <BoardPanel
      snap={boardSnap}
      onDrop={handleDrop}
      locked={false}
      onReset={handleClearBoard}
      onStudyFromPosition={handleStudyFromPreview}
    />
  );

  // ── Shared control blocks ──────────────────────────────────────────────────

  const idleControls = (
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
        className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 disabled:bg-interactive-hi disabled:shadow-none text-white transition-all shadow-lg shadow-blue-900/50 ring-1 ring-blue-500/30 disabled:ring-0"
      >
        {engine.ready ? "Analyze Position" : "Engine loading..."}
      </button>
    </>
  );

  // ── Mobile layout ──────────────────────────────────────────────────────────
  // Idle: controls above board. Active/done: board above controls.
  if (isMobile) {
    return (
      <main className="w-full px-4 py-6 flex flex-col gap-6">
        {isIdle && <div className="flex flex-col gap-5">{idleControls}</div>}
        {boardPanel}
        {(isActive || isComparing) && snap && (
          <div className="flex flex-col gap-5">
            <CandidateList
              candidates={snap.candidates}
              results={null}
              onRemove={(uci) => session?.removeCandidate(uci)}
            />
            {isActive && (
              <button
                onClick={() => session?.compare()}
                disabled={!snap.canCompare}
                className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 disabled:bg-interactive-hi disabled:cursor-not-allowed text-white transition-colors"
              >
                {!snap.analysisReady
                  ? "Engine thinking..."
                  : snap.candidates.length < snap.minCandidates
                    ? `Add ${snap.minCandidates - snap.candidates.length} more move${snap.minCandidates - snap.candidates.length > 1 ? "s" : ""} to compare`
                    : `Compare ${snap.candidates.length} move${snap.candidates.length > 1 ? "s" : ""}`}
              </button>
            )}
            {isComparing && (
              <p className="text-muted animate-pulse text-center">
                Evaluating your moves...
              </p>
            )}
            <button
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl font-semibold bg-interactive hover:bg-interactive-hi transition-colors"
            >
              Start Over
            </button>
          </div>
        )}
        {isDone && snap?.results && (
          <div className="flex flex-col gap-5">
            <CandidateList
              candidates={snap.results.candidates}
              results={snap.results}
              onRemove={null}
            />
            <ResultsPanel results={snap.results} onReset={handleReset} />
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="w-full max-w-6xl mx-auto px-8 py-8">
      <div className="flex gap-8">
        {boardPanel}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {isIdle && idleControls}
          {(isActive || isComparing) && snap && (
            <>
              <CandidateList
                candidates={snap.candidates}
                results={null}
                onRemove={(uci) => session?.removeCandidate(uci)}
              />
              {isActive && (
                <button
                  onClick={() => session?.compare()}
                  disabled={!snap.canCompare}
                  className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 disabled:bg-interactive-hi disabled:cursor-not-allowed text-white transition-colors"
                >
                  {!snap.analysisReady
                    ? "Engine thinking..."
                    : snap.candidates.length < snap.minCandidates
                      ? `Add ${snap.minCandidates - snap.candidates.length} more move${snap.minCandidates - snap.candidates.length > 1 ? "s" : ""} to compare`
                      : `Compare ${snap.candidates.length} move${snap.candidates.length > 1 ? "s" : ""}`}
                </button>
              )}
              {isComparing && (
                <p className="text-muted animate-pulse text-center">
                  Evaluating your moves...
                </p>
              )}
              <button
                onClick={handleReset}
                className="w-full py-2.5 rounded-xl font-semibold bg-interactive hover:bg-interactive-hi transition-colors"
              >
                Start Over
              </button>
            </>
          )}
          {isDone && snap?.results && (
            <>
              <CandidateList
                candidates={snap.results.candidates}
                results={snap.results}
                onRemove={null}
              />
              <ResultsPanel results={snap.results} onReset={handleReset} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function StudyPage() {
  const location = useLocation();
  const initialFen = (location.state as { fen?: string } | null)?.fen;
  return (
    <BoardProvider initialFen={initialFen}>
      <StudyPageContent />
    </BoardProvider>
  );
}
