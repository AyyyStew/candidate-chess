import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { siteVisits } from "../db/schema";
import type { AppBindings, AppVariables } from "../context";

export const telemetry = new Hono<{
  Bindings: AppBindings;
  Variables: AppVariables;
}>();

telemetry.post("/visit", async (c) => {
  // Referer check
  const requestOrigin = new URL(c.req.url).origin;
  const origin = c.req.header("origin") ?? c.req.header("referer") ?? "";
  if (!origin.startsWith(requestOrigin)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Turnstile verification
  const { turnstileToken } = await c.req.json<{ turnstileToken: string }>();
  const form = new FormData();
  form.append("secret", c.env.TURNSTILE_SECRET_KEY);
  form.append("response", turnstileToken);
  const { success } = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  ).then((r) => r.json<{ success: boolean }>());

  if (!success) return c.json({ error: "Bot detected" }, 403);

  const db = c.var.db;
  const today = new Date().toISOString().slice(0, 10);

  await db
    .insert(siteVisits)
    .values({ date: today, count: 1 })
    .onConflictDoUpdate({
      target: siteVisits.date,
      set: { count: sql`${siteVisits.count} + 1` },
    });

  return c.json({ ok: true });
});
