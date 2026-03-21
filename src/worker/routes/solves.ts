import { Hono } from "hono";
import { eq, desc, and, sql } from "drizzle-orm";
import { userSolves, dailyPuzzles, users } from "../db/schema";
import type { AppVariables } from "../context";

export const solves = new Hono<{ Variables: AppVariables }>();

// POST /solves - record a solve for the logged-in user
solves.post("/", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.var.db;
  const body = await c.req.json<{
    zobrist?: string;
    strikesAllowed: number;
    strikesUsed: number;
    movesFound: number;
    targetMoves: number;
    guesses: string;
    hiddenGems?: string | null;
    timeMs: number;
  }>();

  const result = await db
    .insert(userSolves)
    .values({
      userId: user.id,
      zobrist: body.zobrist ?? null,
      strikesAllowed: body.strikesAllowed,
      strikesUsed: body.strikesUsed,
      movesFound: body.movesFound,
      targetMoves: body.targetMoves,
      guesses: body.guesses,
      hiddenGems: body.hiddenGems ?? null,
      timeMs: body.timeMs,
      createdAt: new Date(),
    })
    .returning({ id: userSolves.id })
    .get();

  // Update streak if this zobrist matches today's daily puzzle
  if (body.zobrist) {
    const today = new Date().toISOString().slice(0, 10);
    const dailyMatch = await db
      .select({ date: dailyPuzzles.date })
      .from(dailyPuzzles)
      .where(
        and(
          eq(dailyPuzzles.zobrist, body.zobrist),
          eq(dailyPuzzles.date, today),
        ),
      )
      .get();

    if (dailyMatch) {
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);
      const wasYesterday = user.lastDailyDate === yesterday;
      const won = body.movesFound >= body.targetMoves;

      const newParticipation = wasYesterday ? user.participationStreak + 1 : 1;
      const newWin = wasYesterday && won ? user.winStreak + 1 : won ? 1 : 0;

      await db
        .update(users)
        .set({
          lastDailyDate: today,
          participationStreak: newParticipation,
          winStreak: newWin,
        })
        .where(eq(users.id, user.id));

      return c.json({
        id: result!.id,
        participationStreak: newParticipation,
        winStreak: newWin,
      });
    }
  }

  return c.json({ id: result!.id });
});

// GET /solves/daily/:date - check if logged-in user has solved a specific daily
solves.get("/daily/:date", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { date } = c.req.param();
  const db = c.var.db;

  const result = await db
    .select({
      movesFound: userSolves.movesFound,
      targetMoves: userSolves.targetMoves,
      guesses: userSolves.guesses,
      hiddenGems: userSolves.hiddenGems,
    })
    .from(userSolves)
    .innerJoin(dailyPuzzles, eq(userSolves.zobrist, dailyPuzzles.zobrist))
    .where(and(eq(userSolves.userId, user.id), eq(dailyPuzzles.date, date)))
    .get();

  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// GET /solves - get solve history for the logged-in user
solves.get("/", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const db = c.var.db;

  const results = await db
    .select()
    .from(userSolves)
    .where(eq(userSolves.userId, user.id))
    .orderBy(desc(userSolves.createdAt))
    .limit(50)
    .all();

  return c.json(results);
});
