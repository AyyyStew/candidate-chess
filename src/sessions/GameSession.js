import { Chess } from "chess.js";

const MAX_STRIKES = 3;

export function createGameSession({ analysis, position, targetMoves = 5 }) {
  let phase = "active";
  let candidates = [];
  let strikes = 0;
  let hits = 0;
  let onChange = null;

  function notify() {
    onChange?.(getSnapshot());
  }

  function getSnapshot() {
    return {
      phase,
      fen: position.fen,
      orientation: position.orientation,
      label: position.label,
      event: position.event,
      moveNumber: position.moveNumber,
      candidates: [...candidates],
      strikes,
      maxStrikes: MAX_STRIKES,
      targetMoves,
      liveTopMoves: analysis.isReady()
        ? analysis.buildTopMovesResult().topMoves
        : [],
    };
  }

  analysis.waitForAnalysis().then(() => {
    notify();
  });

  async function submitMove(sourceSquare, targetSquare) {
    if (strikes >= MAX_STRIKES || hits >= targetMoves) return;

    const game = new Chess(position.fen);
    let move;
    try {
      move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: "q",
      });
    } catch {
      return;
    }
    if (!move) return;

    const uci = `${sourceSquare}${targetSquare}`;
    if (candidates.some((c) => c.move === uci)) return;

    candidates = [...candidates, { move: uci, san: move.san, pending: true }];
    notify();

    const evaluated = await analysis.evaluateMove(uci, move.san);
    const isHit = evaluated.rank !== null && evaluated.rank <= targetMoves;

    if (isHit) hits++;
    else strikes++;

    candidates = candidates.map((c) =>
      c.move === uci
        ? { ...evaluated, pending: false, isHit, isMiss: !isHit }
        : c,
    );

    const gameOver = strikes >= MAX_STRIKES || hits >= targetMoves;
    if (gameOver) phase = "done";
    notify();
  }

  function getResults() {
    return {
      ...analysis.buildTopMovesResult(),
      candidates,
    };
  }

  return {
    getSnapshot,
    getResults,
    submitMove,
    set onChange(cb) {
      onChange = cb;
    },
  };
}
