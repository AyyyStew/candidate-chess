import { Chess } from "chess.js";

const MAX_STRIKES = 3;

export function createGameSession({ analysis, position, targetMoves = 5 }) {
  let phase = "active";
  let candidates = [];
  let strikes = 0;
  let hits = 0;
  let onChange = null;
  let analysisReady = analysis.isReady();
  let moveQueue = [];
  let processingQueue = false;

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
      liveTopMoves: analysisReady
        ? analysis.buildTopMovesResult().topMoves
        : [],
      analysisReady,
    };
  }

  // When analysis becomes ready, flush any queued moves
  analysis.waitForAnalysis().then(() => {
    analysisReady = true;
    notify();
    flushQueue();
  });

  async function flushQueue() {
    if (processingQueue) return;
    processingQueue = true;
    while (moveQueue.length > 0) {
      const { uci, san } = moveQueue.shift();
      await processMove(uci, san);
    }
    processingQueue = false;
  }

  async function processMove(uci, san) {
    if (strikes >= MAX_STRIKES || hits >= targetMoves) return;

    const evaluated = await analysis.evaluateMove(uci, san);
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

    // Block duplicates including queued moves
    const alreadyQueued = moveQueue.some((m) => m.uci === uci);
    if (candidates.some((c) => c.move === uci) || alreadyQueued) return;

    // Always show as pending immediately
    candidates = [...candidates, { move: uci, san: move.san, pending: true }];
    notify();

    if (!analysisReady) {
      // Queue it — will be processed when engine is ready
      moveQueue.push({ uci, san: move.san });
      return;
    }

    await processMove(uci, move.san);
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
