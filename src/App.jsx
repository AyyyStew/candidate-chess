import React, { useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "./hooks/useStockfish";
import FenInput from "./components/FenInput";
import CandidateList from "./components/CandidateList";
import ResultsPanel from "./components/ResultsPanel";
import { STARTING_FEN, isValidFen } from "./utils/chess";

const CANDIDATE_LIMIT = 3;

export default function App() {
  const { ready, analyze, evaluateMove } = useStockfish();

  // Position
  const [fen, setFen] = useState(STARTING_FEN);
  const [fenInput, setFenInput] = useState("");

  // Phase: idle → active → comparing → done
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const topMovesRef = useRef([]);

  // ── Handlers ───────────────────────────────────────────────

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

    analyze(fen).then((moves) => {
      topMovesRef.current = moves;
    });
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    // Idle: setting up the position
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

    // Active: picking candidate moves
    if (phase === "active") {
      if (candidates.length >= CANDIDATE_LIMIT) return false;
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
      return false; // reset board back to analysis position
    }

    return false;
  }

  async function handleCompare() {
    setPhase("comparing");

    // Wait for top moves if still running
    if (topMovesRef.current.length === 0) {
      await new Promise((resolve) => {
        const interval = setInterval(() => {
          if (topMovesRef.current.length > 0) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      });
    }

    // Evaluate each candidate sequentially
    const evaluated = [];
    for (const candidate of candidates) {
      const score = await evaluateMove(fen, candidate.move);
      evaluated.push({ ...candidate, eval: score });
    }

    setResults({ topMoves: topMovesRef.current, candidates: evaluated });
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

  // ── Derived state ──────────────────────────────────────────

  const isIdle = phase === "idle";
  const isActive = phase === "active";
  const isDone = phase === "done";
  const bestEval = results?.topMoves?.[0]?.eval ?? 0;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        gap: 32,
        padding: 32,
        fontFamily: "sans-serif",
      }}
    >
      {/* Board */}
      <div style={{ width: 480 }}>
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          arePiecesDraggable={
            isIdle || (isActive && candidates.length < CANDIDATE_LIMIT)
          }
        />
      </div>

      {/* Controls */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}
      >
        <FenInput
          value={fenInput}
          onChange={setFenInput}
          onSet={handleSetPosition}
          disabled={!isIdle}
        />

        {isIdle && (
          <button onClick={handleAnalyze} disabled={!ready}>
            {ready ? "Analyze Position" : "Engine loading..."}
          </button>
        )}

        {!isIdle && (
          <CandidateList
            candidates={candidates}
            results={results}
            bestEval={bestEval}
          />
        )}

        {isActive && candidates.length > 0 && (
          <button onClick={handleCompare}>
            Compare {candidates.length} move{candidates.length > 1 ? "s" : ""}
          </button>
        )}

        {phase === "comparing" && (
          <p style={{ color: "#888" }}>Evaluating your moves...</p>
        )}

        {isDone && results && (
          <ResultsPanel results={results} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
