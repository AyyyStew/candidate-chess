import { useState, useRef } from "react";
import { Chess } from "chess.js";
import {
  startBackgroundAnalysis,
  buildResults,
} from "../services/analysisService";

export function useAnalysis({ fen, engine }) {
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [candidateLimit, setCandidateLimit] = useState(3);
  const [depth, setDepth] = useState(15);
  const [topMoves, setTopMoves] = useState(10);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);

  const lockedFenRef = useRef(null);
  const topMovesRef = useRef(null);
  const positionEvalRef = useRef(null);

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  function handleAnalyze() {
    lockedFenRef.current = fen; // lock the FEN at analysis time
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

  function handleActiveDrop(sourceSquare, targetSquare) {
    if (candidates.length >= candidateLimit) return false;
    const game = new Chess(lockedFenRef.current); // use locked FEN
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

  async function handleCompare() {
    setPhase("comparing");
    const finalResults = await buildResults({
      fen: lockedFenRef.current, // use locked FEN
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
    setCandidates([]);
    setResults(null);
    topMovesRef.current = null;
    positionEvalRef.current = null;
    lockedFenRef.current = null;
  }

  function handleRemoveCandidate(uci) {
    setCandidates((prev) => prev.filter((c) => c.move !== uci));
  }

  return {
    phase,
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
    goCommand,
    handleAnalyze,
    handleActiveDrop,
    handleCompare,
    handleReset,
    isIdle: phase === "idle",
    isActive: phase === "active",
    isComparing: phase === "comparing",
    isDone: phase === "done",
    handleRemoveCandidate,
  };
}
