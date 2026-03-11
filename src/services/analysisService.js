import { normalizeEval, getMoveCategory } from "../utils/chess";

function waitForRef(ref, checkFn = (v) => v !== null && v !== undefined) {
  return new Promise((resolve) => {
    if (checkFn(ref.current)) {
      resolve();
      return;
    }
    const interval = setInterval(() => {
      if (checkFn(ref.current)) {
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

export function startBackgroundAnalysis({
  fen,
  topMovesCount,
  goCommand,
  engine,
  topMovesRef,
  positionEvalRef,
}) {
  topMovesRef.current = null;
  positionEvalRef.current = null;

  engine.getTopMoves(fen, topMovesCount, goCommand).then((moves) => {
    topMovesRef.current = moves;
  });

  engine.getPositionEval(fen, goCommand).then((score) => {
    positionEvalRef.current = score;
  });
}

export async function buildResults({
  fen,
  candidates,
  goCommand,
  engine,
  topMovesRef,
  positionEvalRef,
}) {
  await waitForRef(topMovesRef, (v) => v !== null && v?.length > 0);
  await waitForRef(positionEvalRef, (v) => v !== null);

  const isBlack = fen.includes(" b ");
  const rawTopMoves = topMovesRef.current; // white's perspective, sorted best first by Stockfish
  const rawPositionEval = positionEvalRef.current; // white's perspective
  const rawBestEval = rawTopMoves[0]?.rawEval ?? 0; // white's perspective

  console.log("isBlack:", isBlack);
  console.log("rawBestEval:", rawBestEval);
  rawTopMoves.forEach((m) =>
    console.log(
      m.san,
      "rawEval:",
      m.rawEval,
      "diffBest:",
      m.rawEval - rawBestEval,
    ),
  );

  // build top moves — keep Stockfish order, normalize only for display
  const topMoves = rawTopMoves.map((m) => ({
    ...m,
    eval: m.rawEval, // raw — negative = good for black
    diffBest: m.rawEval - rawBestEval,
    diffPos: m.rawEval - rawPositionEval,
  }));

  const positionEval = rawPositionEval; // raw
  const bestEval = rawBestEval; // raw

  // evaluate candidates
  const evaluatedCandidates = [];
  for (const candidate of candidates) {
    const topMove = rawTopMoves.find((m) => m.move === candidate.move);

    const rawMoveEval = topMove
      ? topMove.rawEval
      : await engine.getRawMoveEval(fen, candidate.move, goCommand);

    // category uses raw white-perspective evals always
    const category = getMoveCategory(
      rawPositionEval,
      rawMoveEval,
      rawBestEval,
      isBlack,
    );

    evaluatedCandidates.push({
      ...candidate,
      eval: rawMoveEval, // display
      category,
      diffBest: rawMoveEval - rawBestEval, // always negative or zero = always "worse or equal to best"
      diffPos: rawMoveEval - rawPositionEval, // negative = worsened position
    });
  }

  return {
    fen,
    topMoves,
    positionEval,
    bestEval: rawBestEval,
    candidates: evaluatedCandidates,
  };
}
