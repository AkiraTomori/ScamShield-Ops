import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Same single root .env as the web app. Variables already set in the environment win; a missing
// file (CI, Vercel) is fine.
try {
  process.loadEnvFile(path.resolve(process.cwd(), "../../.env"));
} catch {
  // no .env file
}

const url = process.env.DATABASE_URL_MIGRATE || process.env.DATABASE_URL;
if (!url) {
  throw new Error("Set DATABASE_URL_MIGRATE (or DATABASE_URL) in .env before running migrations.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url },
});
