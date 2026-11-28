// Shared by `demo:seed` and `demo:reset` (demo-data §3.1). The owner runs these against the deployed
// database (AGENTS.md). Only counts are printed: never a password, a secret or the connection string.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../src/db";
import {
  DemoPasswordsError,
  DemoSeedError,
  parseDemoLookupSecret,
  resetDemoData,
  upsertDemoStaff,
  type DemoSummary,
} from "../src/demo";

export async function runDemoCommand(command: "demo:seed" | "demo:reset"): Promise<void> {
  try {
    process.loadEnvFile(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../.env"),
    );
  } catch {
    // No .env file: the variables may already be in the environment.
  }

  const seeding = command === "demo:seed";
  const url = process.env.DATABASE_URL;
  const passwords = process.env.DEMO_STAFF_PASSWORDS;
  if (!url || (seeding && !passwords)) {
    const needed = seeding ? "DATABASE_URL and DEMO_STAFF_PASSWORDS" : "DATABASE_URL";
    console.error(`${command} needs ${needed} (see .env.example).`);
    process.exitCode = 1;
    return;
  }

  const database = createDatabase(url);
  try {
    // Checked before anything is written, accounts included.
    const lookupSecret = parseDemoLookupSecret(process.env.DEMO_LOOKUP_SECRET);
    if (seeding && passwords) {
      await upsertDemoStaff(
        passwords.split(",").map((password) => password.trim()),
        { db: database.db },
      );
      console.log(`${command}: judge1…judge5 created or updated.`);
    }
    const done = await resetDemoData({ db: database.db, now: () => new Date() }, { lookupSecret });
    console.log(`${command}: deleted ${counts(done.deleted)}.`);
    console.log(`${command}: inserted ${counts(done.inserted)}.`);
    console.log(
      lookupSecret
        ? `${command}: SC-0001 can be looked up with DEMO_LOOKUP_SECRET.`
        : `${command}: DEMO_LOOKUP_SECRET is not set, so no seed case can be looked up.`,
    );
  } catch (error) {
    console.error(
      error instanceof DemoPasswordsError || error instanceof DemoSeedError
        ? `${command}: ${error.message}`
        : // A driver error carries the query's values.
          `${command} failed: check that the database is reachable and migrated.`,
    );
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}

function counts(of: DemoSummary["deleted"] | DemoSummary["inserted"]): string {
  return Object.entries(of)
    .map(([name, n]) => `${name}=${n}`)
    .join(" ");
}
