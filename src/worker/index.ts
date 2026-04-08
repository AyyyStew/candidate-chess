import { Hono } from "hono";
import { lt } from "drizzle-orm";
import { telemetry } from "./routes/telemetry";
import { puzzles } from "./routes/puzzles";
import { auth } from "./routes/auth";
import { solves } from "./routes/solves";
import { createDb } from "./db/client";
import { sessions } from "./db/schema";
import { sessionMiddleware } from "./middleware/session";
import type { AppBindings, AppVariables } from "./context";

const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

app.get("/api/v1/config", (c) =>
  c.json({ turnstileSiteKey: c.env.TURNSTILE_SITE_KEY }),
);

app.use("*", sessionMiddleware);
app.route("/api/v1/telemetry", telemetry);
app.route("/api/v1/puzzles", puzzles);
app.route("/api/v1/auth", auth);
app.route("/api/v1/solves", solves);

export default {
  fetch: app.fetch.bind(app),
  async scheduled(
    _event: ScheduledEvent,
    env: AppBindings,
    _ctx: ExecutionContext,
  ) {
    const db = createDb(env.DB);
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  },
};
