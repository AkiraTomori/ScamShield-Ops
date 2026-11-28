// Prepares the database of `npm run test:e2e` (T-092): writes `.env.e2e` once, then creates,
// migrates and seeds the database it names. It reads the database address from that file only and
// refuses anything that is not on this machine, so a `.env` pointing at a deployed database is never
// touched. Nothing secret is printed.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import postgres from "postgres";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const target = path.join(root, ".env.e2e");
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];

function readEnvFile(file: string): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function fail(message: string): never {
  console.error(`e2e:setup: ${message}`);
  process.exit(1);
}

const secret = (bytes: number) => randomBytes(bytes).toString("hex");

/** A first `.env.e2e`: the Docker Postgres of `.env`, its own database, random secrets. */
function writeEnvFile(): void {
  const main = readEnvFile(path.join(root, ".env"));
  if (!main.POSTGRES_PASSWORD) {
    fail("POSTGRES_PASSWORD is missing in .env (see .env.example).");
  }
  const url = new URL("postgresql://127.0.0.1/scamshield_e2e");
  url.username = main.POSTGRES_USER || "scamshield";
  url.password = main.POSTGRES_PASSWORD;
  url.port = main.POSTGRES_PORT || "5432";
  const passwords = Array.from({ length: 5 }, () => secret(12));
  writeFileSync(
    target,
    [
      "# Only for `npm run test:e2e`. Written by `npm run e2e:setup`; gitignored.",
      "# The database must be on this machine. Model settings still come from .env.",
      `DATABASE_URL=${url.href}`,
      `RATE_LIMIT_SALT=${secret(32)}`,
      `DEMO_STAFF_PASSWORDS=${passwords.join(",")}`,
      `E2E_JUDGE_PASSWORD=${passwords[0]}`,
      "DEMO_LOOKUP_SECRET=",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
  console.log("e2e:setup: wrote .env.e2e");
}

async function createDatabaseIfMissing(url: URL): Promise<void> {
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) fail("the database name in .env.e2e must be a-z, 0-9 or _.");
  const server = new URL(url.href);
  server.pathname = "/postgres";
  const sql = postgres(server.href, { max: 1, onnotice: () => {} });
  try {
    const found = await sql`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (found.length === 0) await sql.unsafe(`CREATE DATABASE "${name}"`);
  } catch {
    // Not the driver's error: it can carry the connection details.
    fail("cannot reach the local Postgres (docker compose up -d --wait), or its password changed.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main(): Promise<void> {
  if (!existsSync(target)) writeEnvFile();
  const env = readEnvFile(target);
  const url = env.DATABASE_URL && URL.canParse(env.DATABASE_URL) ? new URL(env.DATABASE_URL) : null;
  if (!url || !LOCAL_HOSTS.includes(url.hostname)) {
    fail("DATABASE_URL in .env.e2e must point at a Postgres on this machine.");
  }
  if (!env.DEMO_STAFF_PASSWORDS) fail("DEMO_STAFF_PASSWORDS is missing in .env.e2e.");

  await createDatabaseIfMissing(url);

  // Set explicitly, empty ones included: the commands load .env but never override these.
  const childEnv = {
    ...process.env,
    DATABASE_URL: url.href,
    DATABASE_URL_MIGRATE: url.href,
    DEMO_STAFF_PASSWORDS: env.DEMO_STAFF_PASSWORDS,
    DEMO_LOOKUP_SECRET: env.DEMO_LOOKUP_SECRET ?? "",
  };
  for (const script of ["db:migrate", "demo:seed"]) {
    const run = spawnSync("npm", ["run", script], { cwd: root, env: childEnv, stdio: "inherit" });
    if (run.status !== 0) fail(`${script} failed.`);
  }
  console.log("e2e:setup: ready. Run `npm run test:e2e`.");
}

await main();
