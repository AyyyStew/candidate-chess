import { Hono } from "hono";
import { telemetry } from "./routes/telemetry";
import { puzzles } from "./routes/puzzles";
import { solves } from "./routes/solves";
import { createTestDb } from "./db/test-client";
import { sessionMiddleware } from "./middleware/session";
import type { AppBindings, AppVariables } from "./context";

export function createTestApp() {
  const db = createTestDb();
  const app = new Hono<{ Bindings: AppBindings; Variables: AppVariables }>();

  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("user", null);
    await next();
  });

  app.use("*", sessionMiddleware);

  app.route("/api/v1/telemetry", telemetry);
  app.route("/api/v1/puzzles", puzzles);
  app.route("/api/v1/solves", solves);

  return { app, db };
}
