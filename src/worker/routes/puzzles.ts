import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { puzzleStats, puzzleMoveAttempts, dailyPuzzles } from "../db/schema";
import type { AppVariables } from "../context";

type Variables = AppVariables;

export const puzzles = new Hono<{ Variables: Variables }>();

// GET /daily - get today's daily puzzle with its stats
puzzles.get("/daily", async (c) => {
  const db = c.var.db;
  const today = new Date().toISOString().slice(0, 10);

  const result = await db
    .select()
    .from(dailyPuzzles)
    .innerJoin(puzzleStats, eq(dailyPuzzles.zobrist, puzzleStats.zobrist))
    .where(eq(dailyPuzzles.date, today))
    .get();

  if (!result) return c.json({ error: "No daily puzzle set" }, 404);

  const moves = await db
    .select()
    .from(puzzleMoveAttempts)
    .where(eq(puzzleMoveAttempts.zobrist, result.daily_puzzles.zobrist))
    .all();

  return c.json({
    ...result,
    moveCounts: Object.fromEntries(moves.map((m) => [m.move, m.count])),
  });
});

// POST /:zobrist/visit - increment visitor count for a puzzle
puzzles.post("/:zobrist/visit", async (c) => {
  const db = c.var.db;
  const { zobrist } = c.req.param();

  await db
    .insert(puzzleStats)
    .values({
      zobrist,
      visitorCount: 1,
      solveCount: 0,
      totalMovesFound: 0,
      totalTargetMoves: 0,
      totalStrikesUsed: 0,
      totalTimeMs: 0,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: puzzleStats.zobrist,
      set: { visitorCount: sql`${puzzleStats.visitorCount} + 1` },
    });

  return c.json({ ok: true });
});

// GET /:zobrist/stats - get stats for a puzzle
puzzles.get("/:zobrist/stats", async (c) => {
  const db = c.var.db;
  const { zobrist } = c.req.param();

  const result = await db
    .select()
    .from(puzzleStats)
    .where(eq(puzzleStats.zobrist, zobrist))
    .get();

  if (!result) return c.json({ error: "Puzzle not found" }, 404);

  const moves = await db
    .select()
    .from(puzzleMoveAttempts)
    .where(eq(puzzleMoveAttempts.zobrist, zobrist))
    .all();

  return c.json({
    ...result,
    moveCounts: Object.fromEntries(moves.map((m) => [m.move, m.count])),
  });
});

// POST /:zobrist/solve - record a solve attempt
puzzles.post("/:zobrist/solve", async (c) => {
  const db = c.var.db;
  const { zobrist } = c.req.param();
  const body = await c.req.json<{
    strikesUsed: number;
    movesFound: number;
    targetMoves: number;
    guesses: string;
    timeMs: number;
  }>();

  const guesses = body.guesses
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);

  await db
    .insert(puzzleStats)
    .values({
      zobrist,
      visitorCount: 0,
      solveCount: 1,
      totalMovesFound: body.movesFound,
      totalTargetMoves: body.targetMoves,
      totalStrikesUsed: body.strikesUsed,
      totalTimeMs: body.timeMs,
      createdAt: new Date(),
    })
    .onConflictDoUpdate({
      target: puzzleStats.zobrist,
      set: {
        solveCount: sql`${puzzleStats.solveCount} + 1`,
        totalMovesFound: sql`${puzzleStats.totalMovesFound} + ${body.movesFound}`,
        totalTargetMoves: sql`${puzzleStats.totalTargetMoves} + ${body.targetMoves}`,
        totalStrikesUsed: sql`${puzzleStats.totalStrikesUsed} + ${body.strikesUsed}`,
        totalTimeMs: sql`${puzzleStats.totalTimeMs} + ${body.timeMs}`,
      },
    });

  for (const move of guesses) {
    await db
      .insert(puzzleMoveAttempts)
      .values({ zobrist, move, count: 1 })
      .onConflictDoUpdate({
        target: [puzzleMoveAttempts.zobrist, puzzleMoveAttempts.move],
        set: { count: sql`${puzzleMoveAttempts.count} + 1` },
      });
  }

  return c.json({ ok: true });
});
