import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGameSession } from "./GameSession";
import { makeAnalysisResult, makeTopMove } from "../types";
import type { EvaluatedMove } from "../types";
import type { EngineAnalysis } from "../engine/engineAnalysis";
import type { Position } from "../types";

const TEST_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const testPosition: Position = {
  id: 1,
  fen: TEST_FEN,
  label: "Test",
  event: "Test Event",
  moveNumber: 1,
  orientation: "white",
};

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
    buildTopMovesResult: vi.fn(() =>
      makeAnalysisResult({
        fen: TEST_FEN,
        positionEval: 0,
        bestEval: 0.5,
        topMoves: [
          makeTopMove({ move: "e2e4", san: "e4", rawEval: 0.5 }),
          makeTopMove({ move: "d2d4", san: "d4", rawEval: 0.4 }),
          makeTopMove({ move: "g1f3", san: "Nf3", rawEval: 0.3 }),
          makeTopMove({ move: "c2c4", san: "c4", rawEval: 0.3 }),
          makeTopMove({ move: "e2e3", san: "e3", rawEval: 0.2 }),
        ],
      }),
    ),
    ...overrides,
  };
}

describe("GameSession", () => {
  it("starts in active phase", () => {
    const session = createGameSession({
      analysis: makeMockAnalysis(),
      position: testPosition,
    });
    expect(session.getSnapshot().phase).toBe("active");
  });

  it("snapshot includes position info", () => {
    const session = createGameSession({
      analysis: makeMockAnalysis(),
      position: testPosition,
    });
    const snap = session.getSnapshot();
    expect(snap.fen).toBe(TEST_FEN);
    expect(snap.label).toBe("Test");
    expect(snap.targetMoves).toBe(5);
  });

  it("rejects invalid moves", async () => {
    const session = createGameSession({
      analysis: makeMockAnalysis(),
      position: testPosition,
    });
    const snapBefore = session.getSnapshot();
    await session.submitMove("e2", "e9"); // invalid square
    expect(session.getSnapshot().candidates).toHaveLength(
      snapBefore.candidates.length,
    );
  });

  it("adds a pending candidate immediately on submit", async () => {
    const analysis = makeMockAnalysis({
      evaluateMove: vi.fn((): Promise<EvaluatedMove> => new Promise(() => {})), // never resolves
    });
    const session = createGameSession({ analysis, position: testPosition });
    session.onChange = vi.fn();
    session.submitMove("e2", "e4");
    // synchronously check — candidate should be pending
    expect(session.getSnapshot().candidates).toHaveLength(1);
    expect(session.getSnapshot().candidates[0].status).toBe("pending");
  });

  it("does not allow duplicate moves", async () => {
    const session = createGameSession({
      analysis: makeMockAnalysis(),
      position: testPosition,
    });
    session.onChange = vi.fn();
    await session.submitMove("e2", "e4");
    await session.submitMove("e2", "e4");
    expect(session.getSnapshot().candidates).toHaveLength(1);
  });

  it("increments strikes on a miss", async () => {
    const analysis = makeMockAnalysis({
      evaluateMove: vi.fn(async (uci: string, san: string): Promise<EvaluatedMove> => ({
        move: uci, san, eval: -2, rank: 99, category: null,
        diffBest: 0, diffPos: 0, line: { moves: [], sans: [] },
      })),
    });
    const session = createGameSession({ analysis, position: testPosition });
    session.onChange = vi.fn();
    await session.submitMove("e2", "e4");
    expect(session.getSnapshot().strikes).toBe(1);
  });

  it("increments hits on a correct move", async () => {
    const analysis = makeMockAnalysis({
      evaluateMove: vi.fn(async (uci: string, san: string): Promise<EvaluatedMove> => ({
        move: uci, san, eval: 0.5, rank: 1, category: null,
        diffBest: 0, diffPos: 0, line: { moves: [], sans: [] },
      })),
    });
    const session = createGameSession({ analysis, position: testPosition });
    session.onChange = vi.fn();
    await session.submitMove("e2", "e4");
    expect(session.getSnapshot().strikes).toBe(0);
  });

  it("ends game after max strikes", async () => {
    const analysis = makeMockAnalysis({
      evaluateMove: vi.fn(async (uci: string, san: string): Promise<EvaluatedMove> => ({
        move: uci, san, eval: 0, rank: 99, category: null,
        diffBest: 0, diffPos: 0, line: { moves: [], sans: [] },
      })),
    });
    const session = createGameSession({
      analysis,
      position: testPosition,
      targetMoves: 5,
    });
    session.onChange = vi.fn();
    await session.submitMove("e2", "e4");
    await session.submitMove("d2", "d4");
    await session.submitMove("g1", "f3");
    expect(session.getSnapshot().phase).toBe("done");
  });

  it("ends game after finding all target moves", async () => {
    let callCount = 0;
    const moves = ["e2e4", "d2d4", "g1f3", "c2c4", "e2e3"];
    const analysis = makeMockAnalysis({
      evaluateMove: vi.fn(async (uci: string, san: string): Promise<EvaluatedMove> => ({
        move: uci, san, eval: 0.5, rank: callCount++ + 1, category: null,
        diffBest: 0, diffPos: 0, line: { moves: [], sans: [] },
      })),
    });
    const session = createGameSession({
      analysis,
      position: testPosition,
      targetMoves: 3,
    });
    session.onChange = vi.fn();
    await session.submitMove("e2", "e4");
    await session.submitMove("d2", "d4");
    await session.submitMove("g1", "f3");
    expect(session.getSnapshot().phase).toBe("done");
  });

  it("calls onChange when state changes", async () => {
    const session = createGameSession({
      analysis: makeMockAnalysis(),
      position: testPosition,
    });
    const onChange = vi.fn();
    session.onChange = onChange;
    await session.submitMove("e2", "e4");
    expect(onChange).toHaveBeenCalled();
  });
});
