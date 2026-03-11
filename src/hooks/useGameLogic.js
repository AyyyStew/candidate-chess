import { useState, useRef } from "react";
import { Chess } from "chess.js";

const MAX_STRIKES = 1; // bump to 3 later

export function useGameLogic({ engine: engineAnalysis, lockedFen }) {
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [results, setResults] = useState(null);
  const [strikes, setStrikes] = useState(0);
  const [targetMoves, setTargetMoves] = useState(5);

  const strikesRef = useRef(0);
  const hitsRef = useRef(0);

  function start(fen) {
    strikesRef.current = 0;
    hitsRef.current = 0;
    setPhase("active");
    setCandidates([]);
    setResults(null);
    setStrikes(0);
    engineAnalysis.startAnalysis(fen);
  }

  async function handleDrop(sourceSquare, targetSquare) {
    if (strikesRef.current >= MAX_STRIKES || hitsRef.current >= targetMoves)
      return false;

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

    // add as pending
    setCandidates((prev) => [
      ...prev,
      { move: uci, san: move.san, pending: true },
    ]);

    const evaluated = await engineAnalysis.evaluateMove(uci, move.san);
    const isHit = evaluated.rank !== null && evaluated.rank <= targetMoves;
    const isMiss = !isHit;

    if (isMiss) {
      strikesRef.current += 1;
      setStrikes(strikesRef.current);
    } else {
      hitsRef.current += 1;
    }

    setCandidates((prev) => {
      const updated = prev.map((c) =>
        c.move === uci ? { ...evaluated, pending: false, isHit, isMiss } : c,
      );
      const gameOver =
        strikesRef.current >= MAX_STRIKES || hitsRef.current >= targetMoves;
      if (gameOver) finish(updated);
      return updated;
    });

    return false;
  }

  function finish(evaluatedCandidates) {
    const base = engineAnalysis.buildTopMovesResult();
    setResults({ ...base, candidates: evaluatedCandidates });
    setPhase("done");
  }

  function reset() {
    setPhase("idle");
    setCandidates([]);
    setResults(null);
    setStrikes(0);
    strikesRef.current = 0;
    hitsRef.current = 0;
    engineAnalysis.reset();
  }

  return {
    phase,
    candidates,
    results,
    strikes,
    maxStrikes: MAX_STRIKES,
    targetMoves,
    setTargetMoves,
    handleDrop,
    start,
    reset,
    finish,
    isIdle: phase === "idle",
    isActive: phase === "active",
    isDone: phase === "done",
  };
}
