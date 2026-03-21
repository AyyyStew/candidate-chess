import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp } from "../test-app";

const ZOBRIST = "test-zobrist-abc123";

describe("POST /api/v1/puzzles/:zobrist/visit", () => {
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("returns ok and creates puzzle stats row", async () => {
    const res = await app.request(`/api/v1/puzzles/${ZOBRIST}/visit`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("increments visitor count on repeated visits", async () => {
    await app.request(`/api/v1/puzzles/${ZOBRIST}/visit`, { method: "POST" });
    await app.request(`/api/v1/puzzles/${ZOBRIST}/visit`, { method: "POST" });

    const statsRes = await app.request(`/api/v1/puzzles/${ZOBRIST}/stats`);
    const stats = (await statsRes.json()) as any;
    expect(stats.visitorCount).toBe(2);
  });
});

describe("POST /api/v1/puzzles/:zobrist/solve", () => {
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("records a solve and updates aggregates", async () => {
    const res = await app.request(`/api/v1/puzzles/${ZOBRIST}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strikesUsed: 2,
        movesFound: 3,
        totalMoves: 5,
        guesses: "Rd1,Be4,Nf3,Qd2",
        timeMs: 30000,
      }),
    });
    expect(res.status).toBe(200);

    const stats = (await (
      await app.request(`/api/v1/puzzles/${ZOBRIST}/stats`)
    ).json()) as any;
    expect(stats.solveCount).toBe(1);
    expect(stats.totalMovesFound).toBe(3);
    expect(stats.totalStrikesUsed).toBe(2);
  });

  it("tracks move attempt counts", async () => {
    await app.request(`/api/v1/puzzles/${ZOBRIST}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strikesUsed: 2,
        movesFound: 3,
        totalMoves: 5,
        guesses: "Rd1,Be4,Nf3",
        timeMs: 30000,
      }),
    });

    const stats = (await (
      await app.request(`/api/v1/puzzles/${ZOBRIST}/stats`)
    ).json()) as any;
    expect(stats.moveCounts["Rd1"]).toBe(1);
    expect(stats.moveCounts["Be4"]).toBe(1);
  });

  it("accumulates move counts across solves", async () => {
    const solve = (guesses: string) =>
      app.request(`/api/v1/puzzles/${ZOBRIST}/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strikesUsed: 1,
          movesFound: 2,
          totalMoves: 5,
          guesses,
          timeMs: 10000,
        }),
      });

    await solve("Rd1,Be4");
    await solve("Rd1,Nf3");

    const stats = (await (
      await app.request(`/api/v1/puzzles/${ZOBRIST}/stats`)
    ).json()) as any;
    expect(stats.moveCounts["Rd1"]).toBe(2);
    expect(stats.moveCounts["Be4"]).toBe(1);
    expect(stats.moveCounts["Nf3"]).toBe(1);
  });
});

describe("GET /api/v1/puzzles/:zobrist/stats", () => {
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("returns 404 for unknown puzzle", async () => {
    const res = await app.request("/api/v1/puzzles/unknown-zobrist/stats");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/v1/puzzles/daily", () => {
  let app: ReturnType<typeof createTestApp>["app"];

  beforeEach(() => {
    ({ app } = createTestApp());
  });

  it("returns 404 when no daily puzzle set", async () => {
    const res = await app.request("/api/v1/puzzles/daily");
    expect(res.status).toBe(404);
  });
});
