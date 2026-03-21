import {
  int,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const counter = sqliteTable("counter", {
  id: int("id").primaryKey(),
  value: int("value").notNull().default(0),
});

export const users = sqliteTable("users", {
  id: int("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).notNull(),
  participationStreak: int("participation_streak").notNull().default(0),
  winStreak: int("win_streak").notNull().default(0),
  lastDailyDate: text("last_daily_date"),
});

export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    userId: int("user_id")
      .notNull()
      .references(() => users.id),
    provider: text("provider", { enum: ["google", "lichess"] }).notNull(),
    providerUserId: text("provider_user_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerUserId] })],
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: int("expires_at", { mode: "timestamp" }).notNull(),
});

export const siteVisits = sqliteTable("site_visits", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  count: int("count").notNull().default(0),
});

export const puzzleStats = sqliteTable("puzzle_stats", {
  zobrist: text("zobrist").primaryKey(),
  visitorCount: int("visitor_count").notNull().default(0),
  solveCount: int("solve_count").notNull().default(0),
  totalMovesFound: int("total_moves_found").notNull().default(0),
  totalTargetMoves: int("total_target_moves").notNull().default(0),
  totalStrikesUsed: int("total_strikes_used").notNull().default(0),
  totalTimeMs: int("total_time_ms").notNull().default(0),
  createdAt: int("created_at", { mode: "timestamp" }).notNull(),
});

export const puzzleMoveAttempts = sqliteTable(
  "puzzle_move_attempts",
  {
    zobrist: text("zobrist")
      .notNull()
      .references(() => puzzleStats.zobrist),
    move: text("move").notNull(),
    count: int("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.zobrist, t.move] })],
);

export const dailyPuzzles = sqliteTable("daily_puzzles", {
  date: text("date").primaryKey(), // YYYY-MM-DD
  zobrist: text("zobrist")
    .notNull()
    .references(() => puzzleStats.zobrist),
});

export const userSolves = sqliteTable("user_solves", {
  id: int("id").primaryKey({ autoIncrement: true }),
  userId: int("user_id")
    .notNull()
    .references(() => users.id),
  zobrist: text("zobrist").references(() => puzzleStats.zobrist),
  strikesAllowed: int("strikes_allowed").notNull(),
  strikesUsed: int("strikes_used").notNull(),
  movesFound: int("moves_found").notNull(),
  targetMoves: int("target_moves").notNull(),
  guesses: text("guesses").notNull(), // comma-separated e.g. "Rd1,Be4,Nf3"
  hiddenGems: text("hidden_gems"), // nullable JSON array of {move, san, eval, diffBest, diffPos, depth}
  timeMs: int("time_ms").notNull(),
  createdAt: int("created_at", { mode: "timestamp" }).notNull(),
});
