import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "../../src/db/schema";

const MIGRATIONS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/db/migrations",
);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface TestDatabase {
  db: PostgresJsDatabase<typeof schema>;
  sql: postgres.Sql;
  /** Closes the pool and drops the throwaway database. */
  drop: () => Promise<void>;
}

/**
 * Creates a throwaway database on the LOCAL Postgres named by DATABASE_URL, applies every
 * migration to it from scratch, and hands it to one test file. The dev database is never touched,
 * and a URL that is not loopback is refused: integration tests must never reach a deployed
 * database (conventions/backend §8).
 */
export async function createTestDatabase(baseUrl: string): Promise<TestDatabase> {
  const url = new URL(baseUrl);
  if (!LOCAL_HOSTS.has(url.hostname)) {
    throw new Error("Integration tests only run against a local Postgres (loopback host).");
  }
  const name = `scamshield_test_${randomBytes(6).toString("hex")}`;

  const admin = postgres(baseUrl, { max: 1, onnotice: () => {} });
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  url.pathname = `/${name}`;
  const sql = postgres(url.toString(), { max: 6, prepare: false, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });

  return {
    db,
    sql,
    drop: async () => {
      await sql.end({ timeout: 5 });
      const cleaner = postgres(baseUrl, { max: 1, onnotice: () => {} });
      try {
        await cleaner.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleaner.end({ timeout: 5 });
      }
    },
  };
}

interface PgErrorFields {
  code?: string;
  constraint_name?: string;
}

/** drizzle wraps driver errors in DrizzleQueryError; the Postgres fields live on `cause`. */
export function pgError(error: unknown): PgErrorFields {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth += 1) {
    const fields = current as Error & PgErrorFields;
    if (typeof fields.code === "string") return fields;
    current = current.cause;
  }
  return {};
}

/** Resolves with the Postgres error fields when `run` is rejected; fails the test if it succeeds. */
export async function rejection(run: () => PromiseLike<unknown>): Promise<PgErrorFields> {
  try {
    await run();
  } catch (error) {
    return pgError(error);
  }
  throw new Error("Expected the statement to be rejected by the database, but it succeeded.");
}

let counter = 0;
/** Unique-per-call suffix so fixtures never collide inside one file. */
export function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}${counter}`;
}

export const PG = {
  unique: "23505",
  foreignKey: "23503",
  check: "23514",
} as const;

type AnalysisInsert = typeof schema.analyses.$inferInsert;
type CaseInsert = typeof schema.cases.$inferInsert;

export function analysisRow(overrides: Partial<AnalysisInsert> = {}): AnalysisInsert {
  return {
    redactedContent: "Tin nhắn mẫu, liên hệ https://vi-xac-minh.example/otp",
    redactionCounts: { otp: 0, password: 0, card: 0 },
    verdict: "suspicious",
    rule: "R5",
    riskTypes: ["otp_phishing"],
    details: { signals: [], indicators: [] },
    promptVersion: "test-prompt",
    rulesVersion: "test-rules",
    trace: { steps: [] },
    latencyMs: 120,
    ...overrides,
  };
}

export function caseRow(analysisId: string, overrides: Partial<CaseInsert> = {}): CaseInsert {
  return {
    analysisId,
    channel: "sms",
    secretHash: "scrypt$test$hash",
    engineVerdict: "suspicious",
    riskTypes: ["otp_phishing"],
    ...overrides,
  };
}

export async function insertAnalysis(
  db: TestDatabase["db"],
  overrides: Partial<AnalysisInsert> = {},
): Promise<string> {
  const [row] = await db.insert(schema.analyses).values(analysisRow(overrides)).returning({
    id: schema.analyses.id,
  });
  if (!row) throw new Error("insert returned no row");
  return row.id;
}

export async function insertCase(
  db: TestDatabase["db"],
  analysisId: string,
  overrides: Partial<CaseInsert> = {},
): Promise<{ id: string; code: string }> {
  const [row] = await db
    .insert(schema.cases)
    .values(caseRow(analysisId, overrides))
    .returning({ id: schema.cases.id, code: schema.cases.code });
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function insertStaff(
  db: TestDatabase["db"],
  username = uniq("staff_"),
): Promise<string> {
  const [row] = await db
    .insert(schema.staffUsers)
    .values({
      username,
      displayName: "Nhân viên thử",
      passwordHash: "scrypt$test$hash",
      isDemo: false,
    })
    .returning({ id: schema.staffUsers.id });
  if (!row) throw new Error("insert returned no row");
  return row.id;
}
