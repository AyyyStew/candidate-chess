import { getMoveCategory, evalToWinPercent } from "../utils/chess";

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
  onTopMovesReady,
  onPositionEvalReady, // new
}) {
  topMovesRef.current = null;
  positionEvalRef.current = null;

  engine.getTopMoves(fen, topMovesCount, goCommand).then((moves) => {
    topMovesRef.current = moves;
    onTopMovesReady?.(moves);
  });

  engine.getPositionEval(fen, goCommand).then((score) => {
    positionEvalRef.current = score;
    onPositionEvalReady?.(); // new
  });
}

export async function evaluateSingleCandidate({
  fen,
  candidate,
  goCommand,
  engine,
  rawTopMoves,
  rawPositionEval,
}) {
  const isBlack = fen.includes(" b ");
  const rawBestEval = rawTopMoves[0]?.rawEval ?? 0;

  const topMove = rawTopMoves.find((m) => m.move === candidate.move);
  const rawMoveEval = topMove
    ? topMove.rawEval
    : await engine.getRawMoveEval(fen, candidate.move, goCommand);

  const category = getMoveCategory(
    rawPositionEval,
    rawMoveEval,
    isBlack,
    rawBestEval,
  );
  const rankIdx = rawTopMoves.findIndex((m) => m.move === candidate.move);

  const before = isBlack
    ? evalToWinPercent(-rawPositionEval)
    : evalToWinPercent(rawPositionEval);
  const after = isBlack
    ? evalToWinPercent(-rawMoveEval)
    : evalToWinPercent(rawMoveEval);
  console.log(candidate.san, {
    rawPositionEval,
    rawMoveEval,
    before,
    after,
    drop: before - after,
  });

  return {
    ...candidate,
    eval: rawMoveEval,
    category,
    diffBest: rawMoveEval - rawBestEval,
    diffPos: rawMoveEval - rawPositionEval,
    rank: rankIdx === -1 ? null : rankIdx + 1,
  };
}
