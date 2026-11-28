// npm run demo:seed: creates or updates judge1…judge5 on the database named by DATABASE_URL.
// Seed cases arrive with T-090. The owner runs this against the deployed database (AGENTS.md).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../src/db";
import { DemoPasswordsError, upsertDemoStaff } from "../src/demo";

try {
  process.loadEnvFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"));
} catch {
  // No .env file: the variables may already be in the environment.
}

// Neither the connection string nor a password is ever printed.
const url = process.env.DATABASE_URL;
const raw = process.env.DEMO_STAFF_PASSWORDS;
if (!url || !raw) {
  console.error("demo:seed needs DATABASE_URL and DEMO_STAFF_PASSWORDS (see .env.example).");
  process.exit(1);
}

const database = createDatabase(url);
try {
  await upsertDemoStaff(
    raw.split(",").map((password) => password.trim()),
    { db: database.db },
  );
  console.log("demo:seed: judge1…judge5 created or updated. No cases seeded yet (T-090).");
} catch (error) {
  console.error(
    error instanceof DemoPasswordsError
      ? `demo:seed: ${error.message}`
      : "demo:seed failed: check that the database is reachable and migrated.",
  );
  process.exitCode = 1;
} finally {
  await database.close();
}
