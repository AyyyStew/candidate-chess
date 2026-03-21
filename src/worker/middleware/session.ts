import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { eq, and, gt } from "drizzle-orm";
import { sessions, users } from "../db/schema";
import type { AppVariables } from "../context";

export const sessionMiddleware = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    const token = getCookie(c, "session");

    if (!token) {
      c.set("user", null);
      return next();
    }

    const result = await c.var.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date())))
      .get();

    c.set("user", result?.user ?? null);
    await next();
  },
);
