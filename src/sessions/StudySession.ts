import { Chess } from "chess.js";
import { makeCandidate } from "../types";
import type { Candidate, AnalysisResult, StudySnapshot } from "../types";
import type { EngineAnalysis } from "../engine/engineAnalysis";

const MAX_CANDIDATES = 10;

interface StudySessionOptions {
  analysis: EngineAnalysis;
  minCandidates?: number;
}

export interface StudySession {
  getSnapshot: () => StudySnapshot;
  start: (fen: string) => void;
  addCandidate: (sourceSquare: string, targetSquare: string) => boolean;
  removeCandidate: (uci: string) => void;
  compare: () => Promise<void>;
  reset: () => void;
  onChange: ((snap: StudySnapshot) => void) | null;
}

export function createStudySession({
  analysis,
  minCandidates = 3,
}: StudySessionOptions): StudySession {
  let phase: "idle" | "active" | "comparing" | "done" = "idle";
  let candidates: Candidate[] = [];
  let results: AnalysisResult | null = null;
  let lockedFen: string | null = null;
  let onChange: ((snap: StudySnapshot) => void) | null = null;

  function notify(): void {
    onChange?.(getSnapshot());
  }

  function getSnapshot(): StudySnapshot {
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

  function start(fen: string): void {
    const game = new Chess(fen);
    const legalMoveCount = game.moves().length;
    // Cap minCandidates to legal move count so compare is always reachable
    minCandidates = Math.min(minCandidates, legalMoveCount);

    lockedFen = fen;
    candidates = [];
    results = null;
    phase = "active";
    analysis.startAnalysis(fen);
    analysis.waitForAnalysis().then(() => notify());
    notify();
  }

  function addCandidate(sourceSquare: string, targetSquare: string): boolean {
    if (phase !== "active") return false;
    if (candidates.length >= MAX_CANDIDATES) return false;

    const game = new Chess(lockedFen!);
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

    candidates = [
      ...candidates,
      makeCandidate({ move: uci, san: move.san }),
    ];
    notify();
    return true;
  }

  function removeCandidate(uci: string): void {
    if (phase !== "active") return;
    candidates = candidates.filter((c) => c.move !== uci);
    notify();
  }

  async function compare(): Promise<void> {
    if (phase !== "active") return;
    if (candidates.length < minCandidates) return;
    phase = "comparing";
    notify();

    const evaluated = await Promise.all(
      candidates.map((c) => analysis.evaluateMove(c.move, c.san)),
    );

    const evaluatedCandidates: Candidate[] = evaluated.map((e) => ({
      move: e.move,
      san: e.san,
      status: "hit" as const,
      eval: e.eval,
      diffBest: e.diffBest,
      diffPos: e.diffPos,
      category: e.category,
      line: e.line,
    }));
    results = analysis.buildTopMovesResult(evaluatedCandidates);
    phase = "done";
    notify();
  }

  function reset(): void {
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
    set onChange(cb: ((snap: StudySnapshot) => void) | null) {
      onChange = cb;
    },
  };
}
