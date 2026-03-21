import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "./schema";

export type AppDb =
  | DrizzleD1Database<typeof schema>
  | BetterSQLite3Database<typeof schema>;
