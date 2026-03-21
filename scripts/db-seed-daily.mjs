import { execSync } from "child_process";
import { readFileSync, writeFileSync, unlinkSync } from "fs";

const schedule = JSON.parse(
  readFileSync("public/positions/daily_schedule.json", "utf8"),
);

const now = Math.floor(Date.now() / 1000);

const lines = Object.entries(schedule).flatMap(([date, zobrist]) => [
  `INSERT OR IGNORE INTO puzzle_stats (zobrist, visitor_count, solve_count, total_moves_found, total_target_moves, total_strikes_used, total_time_ms, created_at) VALUES ('${zobrist}', 0, 0, 0, 0, 0, 0, ${now});`,
  `INSERT OR IGNORE INTO daily_puzzles (date, zobrist) VALUES ('${date}', '${zobrist}');`,
]);

const tmpFile = "scripts/.seed-daily-tmp.sql";
writeFileSync(tmpFile, lines.join("\n"));

const flag = process.argv.includes("--remote") ? "--remote" : "--local";
console.log(`Seeding daily schedule (${Object.keys(schedule).length} entries) ${flag}...`);

try {
  execSync(`npx wrangler d1 execute candidate-chess-db ${flag} --file=${tmpFile}`, {
    stdio: "inherit",
  });
  console.log("Done.");
} finally {
  unlinkSync(tmpFile);
}
