import { execSync } from "child_process";
import { readdirSync } from "fs";

const files = readdirSync("drizzle")
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  console.log(`Applying ${file}...`);
  execSync(
    `npx wrangler d1 execute candidate-chess-db --local --file=./drizzle/${file}`,
    { stdio: "inherit" }
  );
}
