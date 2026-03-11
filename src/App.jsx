import React, { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "./hooks/useStockfish";
import FenInput from "./components/FenInput";
import CandidateList from "./components/CandidateList";
import ResultsPanel from "./components/ResultsPanel";
import AnalysisSettings from "./components/AnalysisSettings";
import { STARTING_FEN, isValidFen, normalizeEval } from "./utils/chess";

export default function App() {
  const { ready, analyze, evaluateMove, evaluatePosition } = useStockfish();

  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [fen, setFen] = useState(STARTING_FEN);
  const [fenInput, setFenInput] = useState("");
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const topMovesRef = useRef([]);
  const positionEvalRef = useRef(null);
  const [depth, setDepth] = useState(15);
  const [topMoves, setTopMoves] = useState(5);
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);
  const [boardOrientation, setBoardOrientation] = useState("white");

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  function handleSetPosition() {
    if (!fenInput.trim()) {
      setFen(STARTING_FEN);
      return;
    }
    if (!isValidFen(fenInput.trim())) {
      alert("Invalid FEN string");
      return;
    }
    setFen(fenInput.trim());
  }

  function handleAnalyze() {
    setPhase("active");
    setCandidates([]);
    setResults(null);
    topMovesRef.current = [];
    positionEvalRef.current = null;

    analyze(fen, topMoves, goCommand).then((moves) => {
      topMovesRef.current = moves;
    });
    evaluatePosition(fen, goCommand).then((score) => {
      positionEvalRef.current = score;
    });
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (phase === "idle") {
      const game = new Chess(fen);
      let move;
      try {
        move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch {
        return false;
      }
      if (!move) return false;
      setFen(game.fen());
      setFenInput(game.fen());
      return true;
    }
    if (phase === "active") {
      if (candidates.length >= candidateLimit) return false;
      const game = new Chess(fen);
      let move;
      try {
        move = game.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: "q",
        });
      } catch {
        return false;
      }
      if (!move) return false;
      const uci = `${sourceSquare}${targetSquare}`;
      if (candidates.some((c) => c.move === uci)) return false;
      setCandidates((prev) => [...prev, { move: uci, san: move.san }]);
      return false;
    }
    return false;
  }

  async function handleCompare() {
    setPhase("comparing");

    // Wait for top moves and position eval if still running
    await new Promise((resolve) => {
      if (topMovesRef.current.length > 0 && positionEvalRef.current !== null) {
        resolve(); // already done, resolve immediately
        return;
      }
      const interval = setInterval(() => {
        if (
          topMovesRef.current.length > 0 &&
          positionEvalRef.current !== null
        ) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    const evaluated = [];
    for (const candidate of candidates) {
      const topMove = topMovesRef.current.find(
        (m) => m.move === candidate.move,
      );
      if (topMove) {
        evaluated.push({
          ...candidate,
          eval: normalizeEval(topMove.eval, fen),
        });
      } else {
        const score = await evaluateMove(fen, candidate.move, goCommand);
        evaluated.push({ ...candidate, eval: normalizeEval(score, fen) });
      }
    }

    setResults({
      topMoves: topMovesRef.current.map((m) => ({
        ...m,
        eval: normalizeEval(m.eval, fen),
      })),
      candidates: evaluated,
      positionEval: normalizeEval(positionEvalRef.current, fen),
    });
    setPhase("done");
  }

  function handleReset() {
    setPhase("idle");
    setFen(STARTING_FEN);
    setFenInput("");
    setCandidates([]);
    setResults(null);
    topMovesRef.current = [];
  }

  const isIdle = phase === "idle";
  const isActive = phase === "active";
  const isDone = phase === "done";
  const bestEval = results?.topMoves?.[0]?.eval ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold tracking-tight">♟ Candidate Chess</h1>
        <button
          onClick={() => setDark(!dark)}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          {dark ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      {/* Main */}
      <main className="flex gap-8 p-8 max-w-6xl mx-auto">
        {/* Board */}
        <div className="w-120 shrink-0">
          <div style={{ width: 480 }} className="flex flex-col gap-2">
            <button
              onClick={() =>
                setBoardOrientation((o) => (o === "white" ? "black" : "white"))
              }
              className="self-end px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              ⇅ Flip Board
            </button>
            <Chessboard
              position={fen}
              onPieceDrop={handlePieceDrop}
              boardOrientation={boardOrientation}
              arePiecesDraggable={
                isIdle || (isActive && candidates.length < candidateLimit)
              }
            />
          </div>
          <button
            onClick={handleReset}
            className="mt-4 w-full py-2.5 rounded-xl font-semibold bg-gray-200 dark:bg-gray-800 hover:bg-red-500 dark:hover:bg-red-700 transition-colors"
          >
            Start Over
          </button>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col gap-5">
          <FenInput
            value={fenInput}
            onChange={setFenInput}
            onSet={handleSetPosition}
            disabled={!isIdle}
          />

          {isIdle && (
            <>
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
              <button
                onClick={handleAnalyze}
                disabled={!ready}
                className="w-full py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white transition-colors"
              >
                {ready ? "Analyze Position" : "Engine loading..."}
              </button>
            </>
          )}

          {!isIdle && (
            <CandidateList
              candidates={candidates}
              results={results}
              bestEval={bestEval}
              positionEval={results?.positionEval ?? 0}
              candidateLimit={candidateLimit}
            />
          )}

          {isActive && candidates.length > 0 && (
            <button
              onClick={handleCompare}
              className="w-full py-2.5 rounded-xl font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              Compare {candidates.length} move
              {candidates.length > 1 ? "s" : ""}
            </button>
          )}

          {phase === "comparing" && (
            <p className="text-gray-400 animate-pulse">
              Evaluating your moves...
            </p>
          )}

          {isDone && results && (
            <ResultsPanel
              results={results}
              positionEval={results.positionEval}
            />
          )}
        </div>
      </main>
    </div>
  );
}
