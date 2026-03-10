import React, { useState, useRef } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useStockfish } from "./hooks/useStockfish";

const CANDIDATE_LIMIT = 3;
const STARTING_FEN = new Chess().fen();

// ── Helpers ──────────────────────────────────────────────────────────────────

function isValidFen(fen) {
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

function evalColor(diffFromBest) {
  if (diffFromBest >= -0.3) return "#4caf50"; // green  — good
  if (diffFromBest >= -1.0) return "#ff9800"; // orange — inaccuracy
  return "#f44336"; // red    — blunder
}

function formatEval(value) {
  return (value > 0 ? "+" : "") + value.toFixed(2);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function App() {
  const { ready, analyze, evaluateMove } = useStockfish();

  // Position state
  const [fen, setFen] = useState(STARTING_FEN);
  const [fenInput, setFenInput] = useState("");

  // App phase: idle → active → comparing → done
  const [phase, setPhase] = useState("idle");

  // Moves
  const [candidates, setCandidates] = useState([]); // user's picks
  const [results, setResults] = useState(null); // final comparison data
  const topMovesRef = useRef([]); // stockfish top moves (background)

  // ── Handlers ───────────────────────────────────────────────────────────────

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

    // Stockfish runs in background while user picks candidates
    analyze(fen).then((moves) => {
      topMovesRef.current = moves;
    });
  }

  function handlePieceDrop(sourceSquare, targetSquare) {
    // ── Idle phase: setting up the position ──
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
      setFenInput(game.fen()); // keep the FEN input in sync
      return true; // true = piece stays on new square
    }

    // ── Active phase: picking candidates ──
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
      return false; // false = board resets to original position
    }

    return false;
  }

  async function handleCompare() {
    setPhase("comparing");

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

    const evaluated = [];
    for (const candidate of candidates) {
      const score = await evaluateMove(fen, candidate.move);
      console.log("evaluated", candidate.san, score); // <-- add this
      evaluated.push({ ...candidate, eval: score });
    }

    console.log("final evaluated array", evaluated); // <-- and this

    setResults({
      topMoves: topMovesRef.current,
      candidates: evaluated,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  const bestEval = results?.topMoves?.[0]?.eval ?? 0;
  const isActive = phase === "active";
  const isDone = phase === "done";

  return (
    <div
      style={{
        display: "flex",
        gap: 32,
        padding: 32,
        fontFamily: "sans-serif",
      }}
    >
      {/* ── Left: board ── */}
      <div style={{ width: 480 }}>
        <Chessboard
          position={fen}
          onPieceDrop={handlePieceDrop}
          arePiecesDraggable={
            phase === "idle" ||
            (isActive && candidates.length < CANDIDATE_LIMIT)
          }
        />
      </div>

      {/* ── Right: controls ── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}
      >
        {/* FEN input */}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={fenInput}
            onChange={(e) => setFenInput(e.target.value)}
            placeholder="Paste a FEN, or leave blank for starting position"
            style={{ flex: 1, padding: 8 }}
            disabled={phase !== "idle"}
          />
          <button onClick={handleSetPosition} disabled={phase !== "idle"}>
            Set Position
          </button>
        </div>

        {/* Analyze button — only shown in idle phase */}
        {phase === "idle" && (
          <button onClick={handleAnalyze} disabled={!ready}>
            {ready ? "Analyze Position" : "Engine loading..."}
          </button>
        )}

        {/* Candidate move list — shown during active, comparing, done */}
        {phase !== "idle" && (
          <div>
            <h3 style={{ margin: "0 0 8px" }}>
              Your Candidates ({candidates.length} / {CANDIDATE_LIMIT})
            </h3>

            {candidates.length === 0 && (
              <p style={{ color: "#888" }}>Drag a piece to try a move</p>
            )}

            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {(results?.candidates ?? candidates).map((c, i) => {
                const diff = (c.eval ?? 0) - bestEval;
                return (
                  <li key={i} style={{ padding: "4px 0" }}>
                    {i + 1}. {c.san}
                    {isDone && c.eval !== undefined && (
                      <span style={{ marginLeft: 12, color: evalColor(diff) }}>
                        {formatEval(c.eval)} ({formatEval(diff)} vs best)
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Compare button — shown when user has at least 1 candidate */}
        {isActive && candidates.length > 0 && (
          <button onClick={handleCompare}>
            Compare {candidates.length} move{candidates.length > 1 ? "s" : ""}
          </button>
        )}

        {/* Loading state */}
        {phase === "comparing" && (
          <p style={{ color: "#888" }}>Evaluating your moves...</p>
        )}

        {/* Results — shown after comparison */}
        {isDone && results && (
          <div>
            <h3 style={{ margin: "0 0 8px" }}>Stockfish Top Moves</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {results.topMoves.map((m, i) => (
                <li key={i} style={{ padding: "4px 0" }}>
                  {i + 1}. {m.san}
                  <span style={{ marginLeft: 12, color: "#4caf50" }}>
                    {formatEval(m.eval)}
                  </span>
                </li>
              ))}
            </ul>

            <button onClick={handleReset} style={{ marginTop: 16 }}>
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
