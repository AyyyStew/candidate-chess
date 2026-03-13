import { describe, it, expect } from "vitest";
import {
  getMoveCategory,
  formatEval,
  evalToWinPercent,
  isValidFen,
} from "./chess";

describe("formatEval", () => {
  it("formats positive evals with +", () => {
    expect(formatEval(0.5)).toBe("+0.50");
  });
  it("formats negative evals without +", () => {
    expect(formatEval(-1.2)).toBe("-1.20");
  });
  it("formats zero", () => {
    expect(formatEval(0)).toBe("+0.00");
  });
  it("returns - for null", () => {
    expect(formatEval(null)).toBe("-");
  });
  it("returns - for undefined", () => {
    expect(formatEval(undefined)).toBe("-");
  });
});

describe("getMoveCategory", () => {
  it("returns Best when move equals best eval", () => {
    const cat = getMoveCategory(0, 1.0, false, 1.0);
    expect(cat.label).toBe("Best");
  });
  it("returns Excellent for tiny drop", () => {
    const cat = getMoveCategory(0, 0.99, false, 1.0);
    expect(cat.label).toBe("Excellent");
  });
  it("returns Blunder for large drop", () => {
    const cat = getMoveCategory(1.0, -3.0, false, 1.0);
    expect(cat.label).toBe("Blunder");
  });
  it("returns Mistake for medium drop", () => {
    const cat = getMoveCategory(0.5, -1.0, false, 0.5);
    expect(cat.label).toBe("Mistake");
  });
  it("handles black perspective correctly", () => {
    // For black, a high rawMoveEval is bad (white is winning more)
    const cat = getMoveCategory(-0.5, -3.0, true, -0.5);
    expect(cat.label).toBe("Blunder");
  });
  it("returns a color string", () => {
    const cat = getMoveCategory(0, 1.0, false, 1.0);
    expect(cat.color).toMatch(/^#/);
  });
});

describe("isValidFen", () => {
  it("accepts starting position", () => {
    expect(
      isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"),
    ).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidFen("not a fen")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(isValidFen("")).toBe(false);
  });
});
