import React, { useState, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "./hooks/useStockfish";
import {
  startBackgroundAnalysis,
  buildResults,
} from "./services/analysisService";
import FenInput from "./components/FenInput";
import CandidateList from "./components/CandidateList";
import ResultsPanel from "./components/ResultsPanel";
import AnalysisSettings from "./components/AnalysisSettings";
import MoveHistory from "./components/MoveHistory";
import { STARTING_FEN, isValidFen } from "./utils/chess";

export default function App() {
  const engine = useStockfish();

  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  const [fen, setFen] = useState(STARTING_FEN);
  const [fenInput, setFenInput] = useState("");
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [depth, setDepth] = useState(15);
  const [topMoves, setTopMoves] = useState(10);
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);
  const [moveHistory, setMoveHistory] = useState([]); // array of {san, fen after move}
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 = starting position
  const [showArrows, setShowArrows] = useState(true);

  const topMovesRef = useRef(null);
  const positionEvalRef = useRef(null);

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function handleNavigate(index) {
    const clamped = Math.max(-1, Math.min(index, moveHistory.length - 1));
    setHistoryIndex(clamped);
    setFen(clamped === -1 ? STARTING_FEN : moveHistory[clamped].fenAfter);
    setFenInput(clamped === -1 ? "" : moveHistory[clamped].fenAfter);
  }

  function handleSetPosition() {
    if (!fenInput.trim()) {
      setFen(STARTING_FEN);
      setMoveHistory([]);
      setHistoryIndex(-1);
      return;
    }
    if (!isValidFen(fenInput.trim())) {
      alert("Invalid FEN string");

      return;
    }
    setFen(fenInput.trim());
    setMoveHistory([]);
    setHistoryIndex(-1);
  }

  function handleAnalyze() {
    setPhase("active");
    setCandidates([]);
    setResults(null);
    startBackgroundAnalysis({
      fen,
      topMovesCount: topMoves,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
    });
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    if (phase === "idle") {
      if (phase === "idle") {
        const baseHistory = moveHistory.slice(0, historyIndex + 1);
        const baseFen =
          historyIndex >= 0 ? baseHistory[historyIndex].fenAfter : fen; // use fen not STARTING_FEN

        const game = new Chess(baseFen);
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

        const newHistory = [
          ...baseHistory,
          { san: move.san, fenAfter: game.fen() },
        ];
        setMoveHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setFen(game.fen());
        setFenInput(game.fen());
        return true;
      }
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
    const finalResults = await buildResults({
      fen,
      candidates,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
    });
    setResults(finalResults);
    setPhase("done");
  }

  function handleReset() {
    setPhase("idle");
    setFen(STARTING_FEN);
    setFenInput("");
    setCandidates([]);
    setResults(null);
    topMovesRef.current = null;
    positionEvalRef.current = null;
  }

  const isIdle = phase === "idle";
  const isActive = phase === "active";
  const isDone = phase === "done";

  const candidateArrows = showArrows
    ? [
        // candidate arrows — render first (lower priority)
        ...candidates.map((c) => [
          c.move.slice(0, 2),
          c.move.slice(2, 4),
          "rgb(0, 100, 255)",
        ]),

        // top 3 stockfish arrows — render last (higher priority, drawn on top)
        ...(isDone && results
          ? [
              results.topMoves[0]
                ? [
                    results.topMoves[0].move.slice(0, 2),
                    results.topMoves[0].move.slice(2, 4),
                    "rgb(255, 180, 0)",
                  ]
                : null,
              results.topMoves[1]
                ? [
                    results.topMoves[1].move.slice(0, 2),
                    results.topMoves[1].move.slice(2, 4),
                    "rgb(180, 180, 180)",
                  ]
                : null,
              results.topMoves[2]
                ? [
                    results.topMoves[2].move.slice(0, 2),
                    results.topMoves[2].move.slice(2, 4),
                    "rgb(180, 100, 0)",
                  ]
                : null,
            ].filter(Boolean)
          : []),
      ]
    : [];
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-200">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold tracking-tight">♟ Chess Analyzer</h1>
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
        <div className="flex flex-col gap-2 w-120 shrink-0">
          <div className="flex gap-2 self-end">
            <button
              onClick={() => setShowArrows((a) => !a)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors
      ${
        showArrows
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700"
      }`}
            >
              ↗ Arrows
            </button>
            <button
              onClick={() =>
                setBoardOrientation((o) => (o === "white" ? "black" : "white"))
              }
              className="px-3 py-1.5 rounded-lg text-sm bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              ⇅ Flip Board
            </button>
          </div>
          <Chessboard
            position={fen}
            onPieceDrop={handlePieceDrop}
            boardOrientation={boardOrientation}
            arePiecesDraggable={
              isIdle || (isActive && candidates.length < candidateLimit)
            }
            customArrows={candidateArrows}
          />
          <MoveHistory
            history={moveHistory}
            currentIndex={historyIndex}
            onNavigate={handleNavigate}
          />

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
              onClick={handleAnalyze}
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
            <p className="text-gray-400 animate-pulse">
              Evaluating your moves...
            </p>
          )}

          {isDone && results && (
            <ResultsPanel results={results} onReset={handleReset} />
          )}
        </div>
      </main>
    </div>
  );
}
