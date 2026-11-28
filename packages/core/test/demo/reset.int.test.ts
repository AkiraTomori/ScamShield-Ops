import { and, count, eq, isNotNull, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { StaffSession } from "../../src/auth/session";
import { decideCase } from "../../src/cases/decide";
import { getCaseDetail } from "../../src/cases/detail";
import { listCases } from "../../src/cases/list";
import { findRelatedCases } from "../../src/cases/related";
import { findVerifiedMatches } from "../../src/confirmed-indicators";
import {
  analyses,
  analysisIndicators,
  cases,
  confirmedIndicators,
  decisions,
  staffUsers,
} from "../../src/db/schema";
import { DemoSeedError, parseDemoLookupSecret, resetDemoData } from "../../src/demo";
import { SEED_CASES } from "../../src/demo/seed-data";
import { lookupPublicStatus } from "../../src/reports/lookup";
import { createTestDatabase, insertCaseWith, insertStaff, type TestDatabase } from "../db/helpers";

const S1_DOMAIN = "vi-xac-minh.example";
const NOW = new Date("2026-11-28T10:00:00.000Z");
const DAY_MS = 86_400_000;
const SECRET = "7K3M-Q9ZT";

describe("parseDemoLookupSecret", () => {
  it("accepts the form a reporter is shown, and treats an empty value as unset", () => {
    expect(parseDemoLookupSecret("7k3m-q9zt")).toBe("7K3MQ9ZT");
    expect(parseDemoLookupSecret(undefined)).toBeUndefined();
    expect(parseDemoLookupSecret("  ")).toBeUndefined();
  });

  it("refuses a value that cannot be a code, without echoing it", () => {
    for (const bad of ["short", "7K3M-Q9ZT-EXTRA", "UUUU-UUUU"]) {
      expect(() => parseDemoLookupSecret(bad)).toThrow(DemoSeedError);
      try {
        parseDemoLookupSecret(bad);
      } catch (error) {
        expect((error as Error).message).not.toContain(bad);
      }
    }
  });
});

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("resetDemoData", () => {
  let t: TestDatabase;
  let judge: StaffSession;

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });
  beforeEach(async () => {
    await t.sql`TRUNCATE confirmed_indicators, decisions, cases, analysis_indicators, analyses,
      staff_sessions, staff_users CASCADE`;
    const staffUserId = await insertStaff(t.db, "judge1");
    judge = { staffUserId, displayName: "Nhân viên thử" } as StaffSession;
  });

  const reset = (opts: { lookupSecret?: string } = {}) =>
    resetDemoData({ db: t.db, now: () => NOW }, opts);

  const total = async (table: Parameters<ReturnType<typeof t.db.select>["from"]>[0]) =>
    (await t.db.select({ n: count() }).from(table))[0]?.n;

  const seedRows = () =>
    t.db.select().from(cases).where(eq(cases.isSeed, true)).orderBy(cases.code);

  const decide = (code: string, decision: "confirmed_scam" | "not_scam") =>
    decideCase(
      judge,
      code,
      { decision, reason: "Kết luận thử của giám khảo." },
      { db: t.db, now: () => NOW },
    );

  const activeIndicators = () =>
    t.db.select().from(confirmedIndicators).where(isNull(confirmedIndicators.removedAt));

  it("SO-10-AC03: inserts 24 seed cases that every FraudOps read accepts", async () => {
    const summary = await reset();
    expect(summary.inserted).toMatchObject({ analyses: 24, cases: 24, decisions: 9 });
    expect(summary.deleted).toEqual({
      confirmedIndicators: 0,
      decisions: 0,
      cases: 0,
      analyses: 0,
    });

    const rows = await seedRows();
    expect(rows.map((r) => r.code)).toEqual(SEED_CASES.map((c) => c.code));
    for (const row of rows) {
      const detail = await getCaseDetail(judge, row.code, { db: t.db });
      expect(detail?.isSeed, row.code).toBe(true);
      expect(detail?.status === "closed", row.code).toBe(detail?.decision !== null);
    }

    const list = await listCases(
      judge,
      { status: "all", verdict: null, code: "", page: 1 },
      { db: t.db },
    );
    expect(list.items).toHaveLength(24);
    expect(list.items.every((i) => i.isSeed)).toBe(true);
  });

  it("spreads the cases over the last seven days, in code order", async () => {
    await reset();
    const times = (await seedRows()).map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(new Set(times).size).toBe(24);
    expect(times[0]).toBeGreaterThan(NOW.getTime() - 7 * DAY_MS);
    for (const row of await seedRows()) {
      expect(row.updatedAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(row.createdAt.getTime());
    }
  });

  it("SO-07: another case with the S1 domain finds exactly the three S1 cases", async () => {
    await reset();
    const real = await insertCaseWith(t.db, [{ type: "domain", normalized: S1_DOMAIN }]);
    const related = await findRelatedCases(judge, real.id, { db: t.db });
    expect(related.total).toBe(3);
    expect(related.items.every((i) => i.isSeed)).toBe(true);
  });

  it("S2: confirms seed indicators but never the S1 domain", async () => {
    const summary = await reset();
    expect(summary.inserted.confirmedIndicators).toBeGreaterThan(0);
    expect(await activeIndicators()).toHaveLength(summary.inserted.confirmedIndicators);
    expect(
      await findVerifiedMatches([{ type: "domain", normalized: S1_DOMAIN }], { db: t.db }),
    ).toEqual([]);
  });

  it("gives the same 24 cases when run twice", async () => {
    const first = await reset();
    const before = (await seedRows()).map((r) => [r.code, r.status, r.engineVerdict]);
    const second = await reset();
    expect((await seedRows()).map((r) => [r.code, r.status, r.engineVerdict])).toEqual(before);
    expect(second.deleted).toEqual({
      confirmedIndicators: first.inserted.confirmedIndicators,
      decisions: first.inserted.decisions,
      cases: 24,
      analyses: 24,
    });
    expect(second.inserted).toEqual(first.inserted);
    expect(await total(analyses)).toBe(24);
    expect(await total(analysisIndicators)).toBe(second.inserted.indicators);
  });

  it("SO-10-AC04: keeps a real case, its decision and its confirmed indicator", async () => {
    await reset();
    const real = await insertCaseWith(t.db, [{ type: "domain", normalized: "that.example" }]);
    expect((await decide(real.code, "confirmed_scam")).kind).toBe("decided");

    await reset();

    expect(await t.db.select().from(cases).where(eq(cases.isSeed, false))).toHaveLength(1);
    expect(await t.db.select().from(decisions).where(eq(decisions.caseId, real.id))).toHaveLength(
      1,
    );
    expect(
      await t.db
        .select()
        .from(confirmedIndicators)
        .where(eq(confirmedIndicators.sourceCaseId, real.id)),
    ).toHaveLength(1);
    expect(await total(cases)).toBe(25);
    expect(await total(staffUsers)).toBe(1);
  });

  it("undoes a judge's conclusion on a seed case, removed indicators included", async () => {
    await reset();
    const s1Pending = SEED_CASES[0]!;
    expect(s1Pending.decision).toBeNull();
    expect((await decide(s1Pending.code, "confirmed_scam")).kind).toBe("decided");
    const s1Match = () =>
      findVerifiedMatches([{ type: "domain", normalized: S1_DOMAIN }], { db: t.db });
    expect(await s1Match()).toHaveLength(1);
    // Removed by hand: the row stays, and still points at the seed case.
    await t.db
      .update(confirmedIndicators)
      .set({ removedAt: NOW, removedBy: judge.staffUserId, removalReason: "Gỡ trong lúc thử." })
      .where(
        and(eq(confirmedIndicators.normalized, S1_DOMAIN), isNull(confirmedIndicators.removedAt)),
      );

    await reset();

    expect(await s1Match()).toEqual([]);
    expect(
      await t.db.select().from(confirmedIndicators).where(isNotNull(confirmedIndicators.removedAt)),
    ).toEqual([]);
    expect((await seedRows())[0]?.status).toBe("pending_review");
  });

  it("DM-01: SC-0001 opens with the given secret, and no other case does", async () => {
    await reset({ lookupSecret: SECRET });
    const status = (caseCode: string) =>
      lookupPublicStatus({ caseCode, secretCode: SECRET }, { db: t.db });
    expect(await status("SC-0001")).toMatchObject({ status: "pending_review" });
    expect(await status("SC-0002")).toBeNull();

    await reset();
    expect(await status("SC-0001")).toBeNull();
  });

  it("writes nothing when judge1 does not exist", async () => {
    await t.sql`TRUNCATE staff_users CASCADE`;
    await expect(reset()).rejects.toBeInstanceOf(DemoSeedError);
    expect(await total(analyses)).toBe(0);
    expect(await total(staffUsers)).toBe(0);
  });

  it("writes nothing when the secret cannot be a code", async () => {
    await expect(reset({ lookupSecret: "short" })).rejects.toBeInstanceOf(DemoSeedError);
    expect(await total(analyses)).toBe(0);
  });

  it("rolls back as a whole when a seed code is taken by another case", async () => {
    await insertCaseWith(t.db, [], { code: "SC-0024" });
    await expect(reset()).rejects.toThrow();
    expect(await total(cases)).toBe(1);
    expect(await total(analyses)).toBe(1);
  });
});
