import { describe, it, expect } from "vitest";
import {
  makeCandidate,
  makeTopMove,
  makeAnalysisResult,
  makePosition,
} from "./types";

describe("makeCandidate", () => {
  it("creates a candidate with required fields", () => {
    const c = makeCandidate({ move: "e2e4", san: "e4" });
    expect(c.move).toBe("e2e4");
    expect(c.san).toBe("e4");
    expect(c.pending).toBe(false);
  });
  it("throws without move", () => {
    expect(() => makeCandidate({ move: "", san: "e4" })).toThrow();
  });
  it("throws without san", () => {
    expect(() => makeCandidate({ move: "e2e4", san: "" })).toThrow();
  });
  it("preserves optional fields", () => {
    const c = makeCandidate({
      move: "e2e4",
      san: "e4",
      rank: 2,
      eval: 0.5,
      isHit: true,
    });
    expect(c.rank).toBe(2);
    expect(c.eval).toBe(0.5);
    expect(c.isHit).toBe(true);
  });
  it("defaults rank to null", () => {
    const c = makeCandidate({ move: "e2e4", san: "e4" });
    expect(c.rank).toBeNull();
  });
});

describe("makeTopMove", () => {
  it("creates a top move with required fields", () => {
    const m = makeTopMove({ move: "e2e4", san: "e4", rawEval: 0.5 });
    expect(m.move).toBe("e2e4");
    expect(m.eval).toBe(0.5);
  });
  it("sets diffBest correctly when bestEval provided", () => {
    const m = makeTopMove({
      move: "e2e4",
      san: "e4",
      rawEval: 0.3,
      diffBest: -0.2,
    });
    expect(m.diffBest).toBe(-0.2);
  });
  it("defaults line to empty arrays", () => {
    const m = makeTopMove({ move: "e2e4", san: "e4", rawEval: 0 });
    expect(m.line.moves).toEqual([]);
    expect(m.line.sans).toEqual([]);
  });
});

describe("makeAnalysisResult", () => {
  it("requires fen", () => {
    expect(() => makeAnalysisResult({ fen: "" })).toThrow();
  });
  it("defaults topMoves and candidates to empty arrays", () => {
    const r = makeAnalysisResult({
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    });
    expect(r.topMoves).toEqual([]);
    expect(r.candidates).toEqual([]);
  });
});

describe("makePosition", () => {
  it("requires fen and label", () => {
    expect(() => makePosition({ fen: "", label: "Test" })).toThrow();
    expect(() =>
      makePosition({
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        label: "",
      }),
    ).toThrow();
  });
  it("defaults orientation to white", () => {
    const p = makePosition({
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      label: "Test",
    });
    expect(p.orientation).toBe("white");
  });
});
