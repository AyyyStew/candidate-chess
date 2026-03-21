import { execSync } from "child_process";
import { readdirSync } from "fs";

const files = readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  console.log(`Applying ${file}...`);
  try {
    execSync(
      `npx wrangler d1 execute candidate-chess-db --remote --file=./drizzle/${file}`,
      { stdio: "inherit" }
    );
  } catch {
    console.log(`  (skipped — may already be applied)`);
  }
}
