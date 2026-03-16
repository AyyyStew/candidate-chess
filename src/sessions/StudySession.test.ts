import { describe, it, expect, vi } from "vitest";
import { createStudySession } from "./StudySession";
import { makeAnalysisResult, makeTopMove } from "../types";
import type { EvaluatedMove } from "../types";
import type { EngineAnalysis } from "../engine/engineAnalysis";

const TEST_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function makeMockAnalysis(
  overrides: Partial<EngineAnalysis> = {},
): EngineAnalysis {
  return {
    isReady: () => true,
    waitForAnalysis: () => Promise.resolve(),
    startAnalysis: vi.fn(),
    reset: vi.fn(),
    loadPrecomputed: vi.fn(),
    evaluateMove: vi.fn(async (uci: string, san: string): Promise<EvaluatedMove> => ({
      move: uci, san, eval: 0.5, rank: 1, category: null,
      diffBest: 0, diffPos: 0, line: { moves: [], sans: [] },
    })),
    getTopMoves: vi.fn(() => []),
    getPositionEval: vi.fn(() => 0),
    getFen: vi.fn(() => TEST_FEN),
    buildTopMovesResult: vi.fn((candidates = []) =>
      makeAnalysisResult({
        fen: TEST_FEN,
        topMoves: [
          makeTopMove({ move: "e2e4", san: "e4", rawEval: 0.5 }),
          makeTopMove({ move: "d2d4", san: "d4", rawEval: 0.4 }),
          makeTopMove({ move: "g1f3", san: "Nf3", rawEval: 0.3 }),
        ],
        candidates,
      }),
    ),
    ...overrides,
  };
}

describe("StudySession", () => {
  it("starts in idle phase", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    expect(session.getSnapshot().phase).toBe("idle");
  });

  it("moves to active phase on start", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    expect(session.getSnapshot().phase).toBe("active");
  });

  it("adds candidates via addCandidate", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    const result = session.addCandidate("e2", "e4");
    expect(result).toBe(true);
    expect(session.getSnapshot().candidates).toHaveLength(1);
  });

  it("rejects duplicate candidates", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    const result = session.addCandidate("e2", "e4");
    expect(result).toBe(false);
    expect(session.getSnapshot().candidates).toHaveLength(1);
  });

  it("rejects invalid moves", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    const result = session.addCandidate("e2", "e9");
    expect(result).toBe(false);
  });

  it("removes candidates", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    session.removeCandidate("e2e4");
    expect(session.getSnapshot().candidates).toHaveLength(0);
  });

  it("canCompare is false below minCandidates", () => {
    const session = createStudySession({
      analysis: makeMockAnalysis(),
      minCandidates: 3,
    });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    session.addCandidate("d2", "d4");
    expect(session.getSnapshot().canCompare).toBe(false);
  });

  it("canCompare is true at minCandidates", () => {
    const session = createStudySession({
      analysis: makeMockAnalysis(),
      minCandidates: 2,
    });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    session.addCandidate("d2", "d4");
    expect(session.getSnapshot().canCompare).toBe(true);
  });

  it("moves to done after compare", async () => {
    const session = createStudySession({
      analysis: makeMockAnalysis(),
      minCandidates: 1,
    });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    await session.compare();
    expect(session.getSnapshot().phase).toBe("done");
  });

  it("results are populated after compare", async () => {
    const session = createStudySession({
      analysis: makeMockAnalysis(),
      minCandidates: 1,
    });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    await session.compare();
    expect(session.getSnapshot().results).not.toBeNull();
    expect(session.getSnapshot().results?.candidates).toHaveLength(1);
  });

  it("resets back to idle", async () => {
    const session = createStudySession({
      analysis: makeMockAnalysis(),
      minCandidates: 1,
    });
    session.onChange = vi.fn();
    session.start(TEST_FEN);
    session.addCandidate("e2", "e4");
    await session.compare();
    session.reset();
    const snap = session.getSnapshot();
    expect(snap.phase).toBe("idle");
    expect(snap.candidates).toHaveLength(0);
    expect(snap.results).toBeNull();
  });

  it("does not allow adding candidates when not active", () => {
    const session = createStudySession({ analysis: makeMockAnalysis() });
    session.onChange = vi.fn();
    // idle phase — no start called
    const result = session.addCandidate("e2", "e4");
    expect(result).toBe(false);
  });
});
