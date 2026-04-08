import type { AppDb } from "./db/types";
import type { users } from "./db/schema";

export type { AppDb };

export type AppBindings = {
  DB: D1Database;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  LICHESS_CLIENT_ID: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
};

export type AppUser = typeof users.$inferSelect;

export type AppVariables = {
  db: AppDb;
  user: AppUser | null;
};
