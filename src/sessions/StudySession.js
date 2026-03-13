import { Chess } from "chess.js";

const MAX_CANDIDATES = 10;

export function createStudySession({ analysis, minCandidates = 3 }) {
  let phase = "idle";
  let candidates = [];
  let results = null;
  let lockedFen = null;
  let onChange = null;

  function notify() {
    onChange?.(getSnapshot());
  }

  function getSnapshot() {
    return {
      phase,
      lockedFen,
      candidates: [...candidates],
      results,
      analysisReady: analysis.isReady(),
      minCandidates,
      canCompare: candidates.length >= minCandidates && analysis.isReady(),
    };
  }

  function start(fen) {
    lockedFen = fen;
    candidates = [];
    results = null;
    phase = "active";
    analysis.startAnalysis(fen);
    analysis.waitForAnalysis().then(() => notify());
    notify();
  }

  function addCandidate(sourceSquare, targetSquare) {
    if (phase !== "active") return false;
    if (candidates.length >= MAX_CANDIDATES) return false;

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

    candidates = [...candidates, { move: uci, san: move.san }];
    notify();
    return true;
  }

  function removeCandidate(uci) {
    if (phase !== "active") return;
    candidates = candidates.filter((c) => c.move !== uci);
    notify();
  }

  async function compare() {
    if (phase !== "active") return;
    if (candidates.length < minCandidates) return;
    phase = "comparing";
    notify();

    const evaluated = await Promise.all(
      candidates.map((c) => analysis.evaluateMove(c.move, c.san)),
    );

    const base = analysis.buildTopMovesResult();
    results = { ...base, candidates: evaluated };
    phase = "done";
    notify();
  }

  function reset() {
    phase = "idle";
    candidates = [];
    results = null;
    lockedFen = null;
    analysis.reset();
    notify();
  }

  return {
    getSnapshot,
    start,
    addCandidate,
    removeCandidate,
    compare,
    reset,
    set onChange(cb) {
      onChange = cb;
    },
  };
}
