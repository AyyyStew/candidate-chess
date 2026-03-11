import { useRef, useState } from "react";
import {
  startBackgroundAnalysis,
  evaluateSingleCandidate,
} from "../services/analysisService";

export function useEngineAnalysis({ engine }) {
  const topMovesRef = useRef(null);
  const positionEvalRef = useRef(null);
  const lockedFenRef = useRef(null);
  const [liveTopMoves, setLiveTopMoves] = useState([]);

  const [depth, setDepth] = useState(15);
  const [topMoveCount, setTopMoveCount] = useState(5);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);

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
      topMovesCount: topMoveCount,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
      onTopMovesReady: (moves) => setLiveTopMoves(moves),
    });
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
    return {
      fen: lockedFenRef.current,
      positionEval: rawPosEval,
      bestEval: rawBestEval,
      topMoves: rawTopMoves.map((m) => ({
        ...m,
        eval: m.rawEval,
        diffBest: m.rawEval - rawBestEval,
        diffPos: m.rawEval - rawPosEval,
      })),
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
    evaluateMove,
    buildTopMovesResult,
    reset,
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
