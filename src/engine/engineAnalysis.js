import { getMoveCategory } from "../utils/chess";

export function createEngineAnalysis({ pool, goCommand, topMoveCount = 5 }) {
  let topMoves = null;
  let positionEval = null;
  let lockedFen = null;
  let readyResolve = null;

  function isAnalysisReady() {
    return topMoves?.length > 0 && positionEval !== null;
  }

  function notifyReady() {
    if (isAnalysisReady() && readyResolve) {
      readyResolve();
      readyResolve = null;
    }
  }

  function waitForAnalysis() {
    if (isAnalysisReady()) return Promise.resolve();
    return new Promise((resolve) => {
      readyResolve = resolve;
    });
  }

  function startAnalysis(fen) {
    console.log("[engineAnalysis] startAnalysis", fen);
    lockedFen = fen;
    topMoves = null;
    positionEval = null;
    readyResolve = null;

    pool.getTopMoves(fen, 20, goCommand).then((moves) => {
      console.log("[engineAnalysis] topMoves ready", moves.length);
      topMoves = moves;
      notifyReady();
    });

    pool.getPositionEval(fen, goCommand).then((score) => {
      console.log("[engineAnalysis] positionEval ready", score);
      positionEval = score;
      notifyReady();
    });
  }

  function loadPrecomputed(fen, precomputedTopMoves, precomputedEval) {
    lockedFen = fen;
    topMoves = precomputedTopMoves;
    positionEval = precomputedEval;
    readyResolve = null;
  }

  async function evaluateMove(uci, san) {
    await waitForAnalysis();
    const isBlack = lockedFen.includes(" b ");
    const rawBestEval = topMoves[0]?.rawEval ?? 0;

    const topMove = topMoves.find((m) => m.move === uci);
    const rawMoveEval = topMove
      ? topMove.rawEval
      : await pool.getRawMoveEval(lockedFen, uci, goCommand);

    const category = getMoveCategory(
      positionEval,
      rawMoveEval,
      isBlack,
      rawBestEval,
    );
    const rankIdx = topMoves.findIndex((m) => m.move === uci);

    return {
      move: uci,
      san,
      eval: rawMoveEval,
      category,
      rank: rankIdx === -1 ? null : rankIdx + 1,
      diffBest: rawMoveEval - rawBestEval,
      diffPos: rawMoveEval - positionEval,
    };
  }

  function buildTopMovesResult() {
    const rawBestEval = topMoves?.[0]?.rawEval ?? 0;
    const isBlack = lockedFen?.includes(" b ") ?? false;
    const sliced = (topMoves ?? []).slice(0, topMoveCount);

    return {
      fen: lockedFen,
      positionEval,
      bestEval: rawBestEval,
      topMoves: sliced.map((m) => ({
        ...m,
        eval: m.rawEval,
        diffBest: m.rawEval - rawBestEval,
        diffPos: m.rawEval - positionEval,
        category: getMoveCategory(
          positionEval,
          m.rawEval,
          isBlack,
          rawBestEval,
        ),
      })),
    };
  }

  function reset() {
    topMoves = null;
    positionEval = null;
    lockedFen = null;
    readyResolve = null;
  }

  return {
    startAnalysis,
    loadPrecomputed,
    evaluateMove,
    buildTopMovesResult,
    reset,
    waitForAnalysis,
    isReady: isAnalysisReady,
  };
}
