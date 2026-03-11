import { useState, useRef } from "react";
import { Chess } from "chess.js";
import {
  startBackgroundAnalysis,
  evaluateSingleCandidate,
} from "../services/analysisService";

const MAX_STRIKES = 1; // bump to 3 later

export function useAnalysis({ fen, engine }) {
  const [phase, setPhase] = useState("idle");
  const [candidates, setCandidates] = useState([]); // all attempts — hits and misses
  const [results, setResults] = useState(null);
  const [liveTopMoves, setLiveTopMoves] = useState([]);
  const [strikes, setStrikes] = useState(0);
  const [targetMoves, setTargetMoves] = useState(5); // how many top moves to find
  const [depth, setDepth] = useState(15);
  const [topMoves, setTopMoves] = useState(5); // how many SF moves to show
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);

  const topMovesRef = useRef(null);
  const positionEvalRef = useRef(null);
  const lockedFenRef = useRef(null);
  const strikesRef = useRef(0); // ref so async handlers see current value
  const hitsRef = useRef(0);

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  function handleAnalyze() {
    lockedFenRef.current = fen;
    strikesRef.current = 0;
    hitsRef.current = 0;
    setPhase("active");
    setCandidates([]);
    setResults(null);
    setLiveTopMoves([]);
    setStrikes(0);

    startBackgroundAnalysis({
      fen,
      topMovesCount: topMoves,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
      onTopMovesReady: (moves) => setLiveTopMoves(moves),
    });
  }

  async function handleActiveDrop(sourceSquare, targetSquare) {
    // block if game already over
    if (strikesRef.current >= MAX_STRIKES || hitsRef.current >= targetMoves)
      return false;

    const game = new Chess(lockedFenRef.current);
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

    // block duplicate attempts
    if (candidates.some((c) => c.move === uci)) return false;

    // show as pending immediately
    setCandidates((prev) => [
      ...prev,
      { move: uci, san: move.san, pending: true },
    ]);

    await waitForRefs(topMovesRef, positionEvalRef);

    const evaluated = await evaluateSingleCandidate({
      fen: lockedFenRef.current,
      candidate: { move: uci, san: move.san },
      goCommand,
      engine,
      rawTopMoves: topMovesRef.current,
      rawPositionEval: positionEvalRef.current,
    });

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
      if (gameOver) buildFullResults(updated);

      return updated;
    });

    return false;
  }

  function buildFullResults(evaluatedCandidates) {
    const rawTopMoves = topMovesRef.current;
    const rawBestEval = rawTopMoves[0]?.rawEval ?? 0;
    const rawPosEval = positionEvalRef.current;

    const topMovesFull = rawTopMoves.map((m) => ({
      ...m,
      eval: m.rawEval,
      diffBest: m.rawEval - rawBestEval,
      diffPos: m.rawEval - rawPosEval,
    }));

    setResults({
      fen: lockedFenRef.current,
      topMoves: topMovesFull,
      positionEval: rawPosEval,
      bestEval: rawBestEval,
      candidates: evaluatedCandidates,
    });
    setPhase("done");
  }

  function handleReset() {
    setPhase("idle");
    setCandidates([]);
    setResults(null);
    setLiveTopMoves([]);
    setStrikes(0);
    strikesRef.current = 0;
    hitsRef.current = 0;
    topMovesRef.current = null;
    positionEvalRef.current = null;
    lockedFenRef.current = null;
  }

  return {
    phase,
    candidates,
    results,
    liveTopMoves,
    strikes,
    maxStrikes: MAX_STRIKES,
    targetMoves,
    setTargetMoves,
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
    handleReset,
    isIdle: phase === "idle",
    isActive: phase === "active",
    isDone: phase === "done",
  };
}

function waitForRefs(topMovesRef, positionEvalRef) {
  return new Promise((resolve) => {
    if (topMovesRef.current?.length > 0 && positionEvalRef.current !== null) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (topMovesRef.current?.length > 0 && positionEvalRef.current !== null) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}
