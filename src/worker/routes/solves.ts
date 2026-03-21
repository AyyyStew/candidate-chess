import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { userSolves } from "../db/schema";
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
    totalMoves: number;
    guesses: string;
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
      totalMoves: body.totalMoves,
      guesses: body.guesses,
      timeMs: body.timeMs,
      createdAt: new Date(),
    })
    .returning({ id: userSolves.id })
    .get();

  return c.json({ id: result!.id });
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
