import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "./helpers";

// Integration: needs the local Docker Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

/** The eight P0 tables plus `confirmed_indicators` (migration 0001, SO-08). */
const TABLES = [
  "analyses",
  "analysis_indicators",
  "cases",
  "confirmed_indicators",
  "decisions",
  "llm_daily_usage",
  "rate_limit_counters",
  "staff_sessions",
  "staff_users",
];

describe.skipIf(!url)("migration on an empty database (data-model §6, §10)", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("creates exactly the P0 tables and confirmed_indicators", async () => {
    const rows = await t.sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
    expect(rows.map((r) => r.table_name)).toEqual(TABLES);
  });

  it("enables row level security on every table and defines no policy", async () => {
    const tables = await t.sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`;
    expect(tables.map((r) => r.relname)).toEqual(TABLES);
    expect(tables.filter((r) => !r.relrowsecurity)).toEqual([]);

    const policies = await t.sql`SELECT 1 FROM pg_policies WHERE schemaname = 'public'`;
    expect(policies).toHaveLength(0);
  });

  it("uses the foreign-key actions the design specifies", async () => {
    const rows = await t.sql<{ conname: string; confdeltype: string }[]>`
      SELECT conname, confdeltype FROM pg_constraint WHERE contype = 'f' ORDER BY conname`;
    const action = Object.fromEntries(rows.map((r) => [r.conname, r.confdeltype]));
    // c = CASCADE, r = RESTRICT
    expect(action).toEqual({
      analysis_indicators_analysis_id_analyses_id_fk: "c",
      cases_analysis_id_analyses_id_fk: "r",
      confirmed_indicators_confirmed_by_staff_users_id_fk: "r",
      confirmed_indicators_removed_by_staff_users_id_fk: "r",
      confirmed_indicators_source_case_id_cases_id_fk: "r",
      decisions_case_id_cases_id_fk: "c",
      decisions_decided_by_staff_users_id_fk: "r",
      staff_sessions_staff_user_id_staff_users_id_fk: "c",
    });
  });

  it("is a no-op when applied a second time", async () => {
    await expect(
      migrate(t.db, {
        migrationsFolder: new URL("../../src/db/migrations", import.meta.url).pathname,
      }),
    ).resolves.toBeUndefined();
  });
});
