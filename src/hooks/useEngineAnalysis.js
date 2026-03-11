import { useRef, useState } from "react";
import {
  startBackgroundAnalysis,
  evaluateSingleCandidate,
} from "../services/analysisService";
import { getMoveCategory } from "../utils/chess";

export function useEngineAnalysis({ engine }) {
  const topMovesRef = useRef(null);
  const positionEvalRef = useRef(null);
  const lockedFenRef = useRef(null);
  const [liveTopMoves, setLiveTopMoves] = useState([]);
  const [depth, setDepth] = useState(15);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);
  const [topMoveCount, setTopMoveCount] = useState(5);
  const [searchMoveCount, setSearchMoveCount] = useState(20);

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  function startAnalysis(fen) {
    lockedFenRef.current = fen;
    topMovesRef.current = null;
    positionEvalRef.current = null;
    setLiveTopMoves([]);
    startBackgroundAnalysis({
      fen,
      topMovesCount: searchMoveCount,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
      onTopMovesReady: (moves) => setLiveTopMoves(moves.slice(0, topMoveCount)),
    });
  }

  // Load pre-computed results directly into refs — skips engine analysis
  function loadPrecomputed(fen, topMoves, positionEval) {
    lockedFenRef.current = fen;
    topMovesRef.current = topMoves;
    positionEvalRef.current = positionEval;
    setLiveTopMoves(topMoves.slice(0, topMoveCount));
  }

  async function evaluateMove(uci, san) {
    await waitForRefs(topMovesRef, positionEvalRef);
    return evaluateSingleCandidate({
      fen: lockedFenRef.current,
      candidate: { move: uci, san },
      goCommand,
      engine,
      rawTopMoves: topMovesRef.current,
      rawPositionEval: positionEvalRef.current,
    });
  }

  function buildTopMovesResult() {
    const rawTopMoves = topMovesRef.current ?? [];
    const rawBestEval = rawTopMoves[0]?.rawEval ?? 0;
    const rawPosEval = positionEvalRef.current ?? 0;
    const fen = lockedFenRef.current ?? "";
    const isBlack = fen.includes(" b ");
    return {
      fen,
      positionEval: rawPosEval,
      bestEval: rawBestEval,
      topMoves: rawTopMoves.slice(0, topMoveCount).map((m) => ({
        ...m,
        eval: m.rawEval,
        diffBest: m.rawEval - rawBestEval,
        diffPos: m.rawEval - rawPosEval,
        category: getMoveCategory(rawPosEval, m.rawEval, isBlack, rawBestEval),
      })),
      allMoves: rawTopMoves,
    };
  }

  function reset() {
    topMovesRef.current = null;
    positionEvalRef.current = null;
    lockedFenRef.current = null;
    setLiveTopMoves([]);
  }

  return {
    liveTopMoves,
    goCommand,
    depth,
    setDepth,
    topMoveCount,
    setTopMoveCount,
    useMovetime,
    setUseMovetime,
    movetime,
    setMovetime,
    startAnalysis,
    loadPrecomputed,
    evaluateMove,
    buildTopMovesResult,
    reset,
    searchMoveCount,
    setSearchMoveCount,
  };
}

function waitForRefs(topMovesRef, positionEvalRef, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (topMovesRef.current?.length > 0 && positionEvalRef.current !== null) {
        clearInterval(interval);
        resolve();
      }
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error("Engine timed out"));
      }
    }, 100);
  });
}
