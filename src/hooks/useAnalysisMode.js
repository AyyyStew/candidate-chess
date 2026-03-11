import { useState, useRef } from "react";
import { Chess } from "chess.js";
import { getMoveCategory } from "../utils/chess";

export function useAnalysisMode({ engineAnalysis, lockedFen }) {
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [candidateLimit, setCandidateLimit] = useState(3);

  function start(fen) {
    setPhase("active");
    setCandidates([]);
    setResults(null);
    engineAnalysis.startAnalysis(fen);
  }

  async function handleDrop(sourceSquare, targetSquare) {
    if (candidates.length >= candidateLimit) return false;

    const game = new Chess(lockedFen);
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

    setCandidates((prev) => [
      ...prev,
      { move: uci, san: move.san, pending: true },
    ]);

    const evaluated = await engineAnalysis.evaluateMove(uci, move.san);
    setCandidates((prev) =>
      prev.map((c) => (c.move === uci ? { ...evaluated, pending: false } : c)),
    );

    return false;
  }

  async function handleCompare() {
    setPhase("comparing");
    const base = engineAnalysis.buildTopMovesResult();
    setResults({ ...base, candidates });
    setPhase("done");
  }

  function removeCandidate(uci) {
    if (phase !== "active") return;
    setCandidates((prev) => prev.filter((c) => c.move !== uci));
  }

  function reset() {
    setPhase("idle");
    setCandidates([]);
    setResults(null);
    engineAnalysis.reset();
  }

  return {
    phase,
    candidates,
    results,
    candidateLimit,
    setCandidateLimit,
    handleDrop,
    handleCompare,
    removeCandidate,
    start,
    reset,
    isIdle: phase === "idle",
    isActive: phase === "active",
    isComparing: phase === "comparing",
    isDone: phase === "done",
  };
}
