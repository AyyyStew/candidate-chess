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
  const refsReadyRef = useRef(null); // holds { resolve } for current waiter
  const [liveTopMoves, setLiveTopMoves] = useState([]);
  const [depth, setDepth] = useState(15);
  const [useMovetime, setUseMovetime] = useState(false);
  const [movetime, setMovetime] = useState(2000);
  const [topMoveCount, setTopMoveCount] = useState(5);
  const [searchMoveCount, setSearchMoveCount] = useState(20);

  const goCommand = useMovetime
    ? `go movetime ${movetime}`
    : `go depth ${depth}`;

  // Call this whenever both refs become populated
  function notifyRefsReady() {
    if (
      topMovesRef.current?.length > 0 &&
      positionEvalRef.current !== null &&
      refsReadyRef.current
    ) {
      refsReadyRef.current.resolve();
      refsReadyRef.current = null;
    }
  }

  function waitForRefs() {
    // Already populated — resolve immediately, no polling
    if (topMovesRef.current?.length > 0 && positionEvalRef.current !== null) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      refsReadyRef.current = { resolve };
    });
  }

  function startAnalysis(fen) {
    console.log("[engineAnalysis] startAnalysis called — engine will think");
    lockedFenRef.current = fen;
    topMovesRef.current = null;
    positionEvalRef.current = null;
    refsReadyRef.current = null;
    setLiveTopMoves([]);

    startBackgroundAnalysis({
      fen,
      topMovesCount: searchMoveCount,
      goCommand,
      engine,
      topMovesRef,
      positionEvalRef,
      onTopMovesReady: (moves) => {
        setLiveTopMoves(moves.slice(0, topMoveCount));
        notifyRefsReady();
      },
      onPositionEvalReady: () => {
        notifyRefsReady();
      },
    });
  }

  function loadPrecomputed(fen, topMoves, positionEval) {
    console.log("[engineAnalysis] loadPrecomputed called — should be instant");
    lockedFenRef.current = fen;
    topMovesRef.current = topMoves;
    positionEvalRef.current = positionEval;
    refsReadyRef.current = null; // clear any stale waiter
    setLiveTopMoves(topMoves.slice(0, topMoveCount));
    // No need to notify — refs are set synchronously, waitForRefs()
    // will see them immediately when called
  }

  async function evaluateMove(uci, san) {
    await waitForRefs();
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
    refsReadyRef.current = null; // cancel any pending waiter
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
