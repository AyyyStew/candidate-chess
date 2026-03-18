import { Hono } from "hono";

type Bindings = { DB: D1Database };

export const counter = new Hono<{ Bindings: Bindings }>();

counter.post("/increment", async (c) => {
  const db = c.env.DB;
  const result = await db
    .prepare(
      "UPDATE counter SET value = value + 1 WHERE id = 1 RETURNING value",
    )
    .first<{ value: number }>();
  return c.json({ value: result?.value });
});
