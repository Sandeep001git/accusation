import { migrate } from "drizzle-orm/neon-http/migrator";
import { db, sql } from "../src/config/database.js";

const maxAttempts = 30;
const retryDelayMs = 2000;
let ready = false;

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    await sql`SELECT 1`;
    ready = true;
    break;
  } catch (error) {
    if (attempt === maxAttempts) {
      console.error(
        "Neon Local did not become ready; migrations were not started.",
      );
      throw error;
    }

    if (attempt === 1 || attempt % 5 === 0) {
      console.log(
        `Waiting for Neon Local (${attempt}/${maxAttempts}); retrying in ${retryDelayMs / 1000}s.`,
      );
    }
    // eslint-disable-next-line no-undef
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
}

if (!ready) {
  throw new Error(
    "Neon Local did not become ready within the startup timeout.",
  );
}

console.log("Neon Local is ready; applying development migrations.");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Development migrations completed.");
