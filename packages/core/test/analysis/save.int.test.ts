import { AnalysisDetails, BRANDS, URL_LISTS } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeMessage, saveAnalysis } from "../../src/analysis";
import {
  analyses,
  analysisIndicators,
  llmDailyUsage,
  rateLimitCounters,
} from "../../src/db/schema";
import { consumeRateLimit, rateLimitKey, reserveLlmCall } from "../../src/rate-limit";
import { createTestDatabase, type TestDatabase } from "../db/helpers";
import { okText } from "../llm/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("storing analyses and counting requests", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("SO-01-AC03: stores redacted content, details and matchable indicators only", async () => {
    const outcome = await analyzeMessage(
      "MoMo: gọi 0901234567, vào momo-uudai.example, STK 000123456789, mã OTP 482913 😀",
      {
        llm: { chatJson: async () => okText('{"signals":[],"mentionedBrands":[]}') },
        models: { signals: "m", explain: "m" },
        brands: BRANDS,
        urlLists: URL_LISTS,
        verifiedIndicators: async () => [],
        now: () => new Date(),
        random: () => "abc",
        newId: () => crypto.randomUUID(),
      },
    );
    await saveAnalysis(outcome, { db: t.db });

    const [row] = await t.db
      .select()
      .from(analyses)
      .where(eq(analyses.id, outcome.result.analysisId));
    expect(row?.redactedContent).toContain("[OTP ĐÃ CHE]");
    expect(JSON.stringify(row)).not.toContain("482913");
    // DB-02: what was written reads back through the same schema.
    expect(AnalysisDetails.parse(row?.details).recommendations.length).toBeGreaterThanOrEqual(2);
    expect(row?.createdAt.toISOString()).toBe(outcome.result.createdAt);

    const stored = await t.db
      .select({ type: analysisIndicators.type, normalized: analysisIndicators.normalized })
      .from(analysisIndicators)
      .where(eq(analysisIndicators.analysisId, outcome.result.analysisId));
    expect(stored.map((s) => `${s.type}:${s.normalized}`).sort()).toEqual([
      "bank_account:000123456789",
      "domain:momo-uudai.example",
      "phone:+84901234567",
    ]);
  });

  it("SO-01-AC04: the 11th request of a minute is refused, the next minute starts over", async () => {
    const key = rateLimitKey("pub", "203.0.113.9", "salt".repeat(8));
    expect(key).not.toContain("203.0.113.9");
    const now = new Date("2026-11-26T10:00:30.000Z");
    const deps = { db: t.db, random: () => 1 };
    for (let i = 0; i < 10; i++) {
      expect((await consumeRateLimit(key, deps, now)).allowed).toBe(true);
    }
    expect((await consumeRateLimit(key, deps, now)).allowed).toBe(false);
    const later = new Date("2026-11-26T10:01:00.000Z");
    expect((await consumeRateLimit(key, deps, later)).allowed).toBe(true);
  });

  it("removes counters older than an hour when the cleanup runs", async () => {
    await t.db
      .insert(rateLimitCounters)
      .values({ key: "pub:old", windowStart: new Date("2026-11-26T08:00:00.000Z"), count: 1 });
    await consumeRateLimit("pub:new", { db: t.db, random: () => 0 }, new Date("2026-11-26T10:00Z"));
    const old = await t.db
      .select()
      .from(rateLimitCounters)
      .where(eq(rateLimitCounters.key, "pub:old"));
    expect(old).toEqual([]);
  });

  it("P-03: counts model calls per Vietnam day up to the cap", async () => {
    // 17:30 UTC is already the next day in Vietnam.
    const now = new Date("2026-11-26T17:30:00.000Z");
    expect(await reserveLlmCall(t.db, now, 2)).toBe(true);
    expect(await reserveLlmCall(t.db, now, 2)).toBe(true);
    expect(await reserveLlmCall(t.db, now, 2)).toBe(false);
    const [row] = await t.db
      .select()
      .from(llmDailyUsage)
      .where(eq(llmDailyUsage.day, "2026-11-27"));
    expect(row?.calls).toBe(2);
  });
});
