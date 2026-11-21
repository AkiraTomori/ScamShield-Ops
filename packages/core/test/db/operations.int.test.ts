import { and, eq, lt, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  analyses,
  analysisIndicators,
  cases,
  decisions,
  llmDailyUsage,
  rateLimitCounters,
} from "../../src/db/schema";
import {
  analysisRow,
  caseRow,
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertStaff,
  PG,
  rejection,
  uniq,
  type TestDatabase,
} from "./helpers";

// Integration: needs the local Docker Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("data-model §4: transactions and concurrent writes", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("saves an analysis and its indicators in one transaction, and rolls both back on failure", async () => {
    const analysisId = crypto.randomUUID();
    const failing = t.db.transaction(async (tx) => {
      await tx.insert(analyses).values({ ...analysisRow(), id: analysisId });
      await tx.insert(analysisIndicators).values([
        { analysisId, type: "domain", normalized: "ok.example" },
        { analysisId, type: "url", normalized: "not-storable" }, // violates the CHECK
      ]);
    });
    expect((await rejection(() => failing)).code).toBe(PG.check);
    expect(await t.db.select().from(analyses).where(eq(analyses.id, analysisId))).toEqual([]);
    expect(
      await t.db
        .select()
        .from(analysisIndicators)
        .where(eq(analysisIndicators.analysisId, analysisId)),
    ).toEqual([]);

    await t.db.transaction(async (tx) => {
      await tx.insert(analyses).values({ ...analysisRow(), id: analysisId });
      await tx
        .insert(analysisIndicators)
        .values({ analysisId, type: "domain", normalized: "ok.example" });
    });
    expect(
      await t.db
        .select()
        .from(analysisIndicators)
        .where(eq(analysisIndicators.analysisId, analysisId)),
    ).toHaveLength(1);
  });

  it("SO-04-AC03: two simultaneous reports of one analysis yield exactly one case", async () => {
    const analysisId = await insertAnalysis(t.db);
    const results = await Promise.allSettled([
      t.db.insert(cases).values(caseRow(analysisId, { channel: "sms" })),
      t.db.insert(cases).values(caseRow(analysisId, { channel: "zalo" })),
    ]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((await rejection(() => Promise.reject(rejected[0]?.reason))).code).toBe(PG.unique);
    expect(await t.db.select().from(cases).where(eq(cases.analysisId, analysisId))).toHaveLength(1);
  });

  it("closes a case once: of two simultaneous conditional UPDATEs only one matches", async () => {
    const created = await insertCase(t.db, await insertAnalysis(t.db));
    const close = () =>
      t.db
        .update(cases)
        .set({ status: "closed", closedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(cases.code, created.code), eq(cases.status, "pending_review")))
        .returning({ id: cases.id });
    const [first, second] = await Promise.all([close(), close()]);
    expect(first.length + second.length).toBe(1);
    // A later attempt finds nothing to close, which is the 409 path.
    expect(await close()).toEqual([]);
  });

  it("closing a case and inserting its decision is one unit: a failed decision rolls the close back", async () => {
    const staffId = await insertStaff(t.db);
    const created = await insertCase(t.db, await insertAnalysis(t.db));
    const attempt = t.db.transaction(async (tx) => {
      await tx
        .update(cases)
        .set({ status: "closed", closedAt: sql`now()` })
        .where(and(eq(cases.code, created.code), eq(cases.status, "pending_review")));
      await tx.insert(decisions).values({
        caseId: created.id,
        decision: "confirmed_scam",
        reason: "short", // violates decisions_reason_len
        decidedBy: staffId,
        engineVerdict: "suspicious",
        disagreesWithEngine: false,
      });
    });
    expect((await rejection(() => attempt)).code).toBe(PG.check);
    const [row] = await t.db.select().from(cases).where(eq(cases.id, created.id));
    expect(row?.status).toBe("pending_review");
    expect(row?.closedAt).toBeNull();
  });

  it("counts every request in a rate-limit window with one atomic upsert", async () => {
    const key = uniq("pub:");
    const windowStart = new Date("2026-11-21T10:00:00.000Z");
    const hit = () =>
      t.db
        .insert(rateLimitCounters)
        .values({ key, windowStart, count: 1 })
        .onConflictDoUpdate({
          target: [rateLimitCounters.key, rateLimitCounters.windowStart],
          set: { count: sql`${rateLimitCounters.count} + 1` },
        })
        .returning({ count: rateLimitCounters.count });

    const counts = (await Promise.all(Array.from({ length: 8 }, hit))).map((r) => r[0]?.count);
    expect([...counts].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // A different window and a different key start from 1 again.
    const next = await t.db
      .insert(rateLimitCounters)
      .values({ key, windowStart: new Date("2026-11-21T10:01:00.000Z"), count: 1 })
      .returning({ count: rateLimitCounters.count });
    expect(next[0]?.count).toBe(1);
  });

  it("rejects a counter below 1", async () => {
    const error = await rejection(() =>
      t.db
        .insert(rateLimitCounters)
        .values({ key: uniq("pub:"), windowStart: new Date(), count: 0 }),
    );
    expect(error).toMatchObject({
      code: PG.check,
      constraint_name: "rate_limit_counters_count_positive",
    });
  });

  it("deletes only rate-limit rows older than an hour", async () => {
    const key = uniq("login:");
    const now = new Date("2026-11-21T12:00:00.000Z");
    await t.db.insert(rateLimitCounters).values([
      { key, windowStart: new Date("2026-11-21T10:30:00.000Z"), count: 1 },
      { key, windowStart: new Date("2026-11-21T11:30:00.000Z"), count: 1 },
    ]);
    await t.db
      .delete(rateLimitCounters)
      .where(
        and(
          eq(rateLimitCounters.key, key),
          lt(rateLimitCounters.windowStart, new Date(now.getTime() - 3_600_000)),
        ),
      );
    const left = await t.db.select().from(rateLimitCounters).where(eq(rateLimitCounters.key, key));
    expect(left.map((r) => r.windowStart.toISOString())).toEqual(["2026-11-21T11:30:00.000Z"]);
  });

  it("reserves LLM calls up to the daily cap and then returns no row (P-03)", async () => {
    const day = "2031-01-15"; // plain date string chosen by the app (Vietnam-local day)
    const cap = 3;
    const reserve = async () => {
      await t.db.insert(llmDailyUsage).values({ day, calls: 0 }).onConflictDoNothing();
      return t.db
        .update(llmDailyUsage)
        .set({ calls: sql`${llmDailyUsage.calls} + 1` })
        .where(and(eq(llmDailyUsage.day, day), lt(llmDailyUsage.calls, cap)))
        .returning({ calls: llmDailyUsage.calls });
    };
    const results = await Promise.all(Array.from({ length: 6 }, reserve));
    expect(results.filter((r) => r.length === 1)).toHaveLength(cap);
    const [row] = await t.db.select().from(llmDailyUsage).where(eq(llmDailyUsage.day, day));
    expect(row).toEqual({ day, calls: cap });
  });

  it("keeps the day as the exact date string the app passed", async () => {
    await t.db.insert(llmDailyUsage).values({ day: "2026-12-31", calls: 0 });
    const [row] = await t.db
      .select()
      .from(llmDailyUsage)
      .where(eq(llmDailyUsage.day, "2026-12-31"));
    expect(row?.day).toBe("2026-12-31");
    const error = await rejection(() =>
      t.db.insert(llmDailyUsage).values({ day: "2026-12-30", calls: -1 }),
    );
    expect(error).toMatchObject({
      code: PG.check,
      constraint_name: "llm_daily_usage_calls_nonneg",
    });
  });
});
