import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  analyses,
  analysisIndicators,
  cases,
  decisions,
  staffSessions,
  staffUsers,
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

describe.skipIf(!url)("data-model §3: invariants enforced by the database", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  describe("analyses", () => {
    it("stores a redacted analysis and round-trips jsonb and text[]", async () => {
      const id = await insertAnalysis(t.db, {
        riskTypes: ["otp_phishing", "payment_request"],
        details: { explanation: null, signals: [{ type: "urgency" }] },
      });
      const [row] = await t.db.select().from(analyses).where(eq(analyses.id, id));
      expect(row?.riskTypes).toEqual(["otp_phishing", "payment_request"]);
      expect(row?.details).toEqual({ explanation: null, signals: [{ type: "urgency" }] });
      expect(row?.isSeed).toBe(false);
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    it("has no column for original content, IP, user agent or headers", async () => {
      const columns = await t.sql<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'analyses'`;
      const names = columns.map((c) => c.column_name);
      for (const forbidden of ["content", "original_content", "ip", "user_agent", "headers"]) {
        expect(names).not.toContain(forbidden);
      }
      expect(names).toContain("redacted_content");
    });

    it("rejects an unknown verdict", async () => {
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ verdict: "safe" })),
      );
      expect(error).toMatchObject({ code: PG.check, constraint_name: "analyses_verdict_valid" });
    });

    it("rejects an unknown inconclusive reason but accepts one next to a high_risk verdict (P-01)", async () => {
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ inconclusiveReason: "because" })),
      );
      expect(error).toMatchObject({
        code: PG.check,
        constraint_name: "analyses_inconclusive_reason_valid",
      });
      await expect(
        insertAnalysis(t.db, { verdict: "high_risk", inconclusiveReason: "llm_unavailable" }),
      ).resolves.toEqual(expect.any(String));
    });

    it("requires a reason whenever the verdict is inconclusive, and accepts it with one", async () => {
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ verdict: "inconclusive", rule: "R8" })),
      );
      expect(error).toMatchObject({
        code: PG.check,
        constraint_name: "analyses_inconclusive_has_reason",
      });
      await expect(
        insertAnalysis(t.db, {
          verdict: "inconclusive",
          rule: "R8",
          inconclusiveReason: "insufficient_evidence",
        }),
      ).resolves.toEqual(expect.any(String));
    });

    it("rejects an unknown risk type", async () => {
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ riskTypes: ["otp_phishing", "made_up"] })),
      );
      expect(error).toMatchObject({ code: PG.check, constraint_name: "analyses_risk_types_valid" });
    });

    it("limits redacted content to 4,000 characters", async () => {
      await expect(insertAnalysis(t.db, { redactedContent: "a".repeat(4000) })).resolves.toEqual(
        expect.any(String),
      );
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ redactedContent: "a".repeat(4001) })),
      );
      expect(error).toMatchObject({
        code: PG.check,
        constraint_name: "analyses_redacted_content_len",
      });
    });

    it("rejects negative latency", async () => {
      const error = await rejection(() =>
        t.db.insert(analyses).values(analysisRow({ latencyMs: -1 })),
      );
      expect(error).toMatchObject({
        code: PG.check,
        constraint_name: "analyses_latency_ms_nonneg",
      });
    });
  });

  describe("analysis_indicators", () => {
    it("accepts domain, phone and bank_account and rejects url and brand", async () => {
      const analysisId = await insertAnalysis(t.db);
      await t.db.insert(analysisIndicators).values([
        { analysisId, type: "domain", normalized: "vi-xac-minh.example" },
        { analysisId, type: "phone", normalized: "+84900000000" },
        { analysisId, type: "bank_account", normalized: "0123456789" },
      ]);
      for (const type of ["url", "brand"]) {
        const error = await rejection(() =>
          t.db.insert(analysisIndicators).values({ analysisId, type, normalized: "x" }),
        );
        expect(error).toMatchObject({
          code: PG.check,
          constraint_name: "analysis_indicators_type_valid",
        });
      }
    });

    it("rejects the same indicator twice for one analysis", async () => {
      const analysisId = await insertAnalysis(t.db);
      const row = { analysisId, type: "domain", normalized: "dup.example" };
      await t.db.insert(analysisIndicators).values(row);
      const error = await rejection(() => t.db.insert(analysisIndicators).values(row));
      expect(error.code).toBe(PG.unique);
    });

    it("rejects an indicator for an analysis that does not exist", async () => {
      const error = await rejection(() =>
        t.db.insert(analysisIndicators).values({
          analysisId: "00000000-0000-4000-8000-000000000000",
          type: "domain",
          normalized: "orphan.example",
        }),
      );
      expect(error.code).toBe(PG.foreignKey);
    });

    it("deletes indicators together with an analysis that has no case", async () => {
      const analysisId = await insertAnalysis(t.db);
      await t.db
        .insert(analysisIndicators)
        .values({ analysisId, type: "domain", normalized: "cascade.example" });
      await t.db.delete(analyses).where(eq(analyses.id, analysisId));
      const left = await t.db
        .select()
        .from(analysisIndicators)
        .where(eq(analysisIndicators.analysisId, analysisId));
      expect(left).toEqual([]);
    });
  });

  describe("cases", () => {
    it("SO-04-AC03: an analysis has at most one case", async () => {
      const analysisId = await insertAnalysis(t.db);
      await insertCase(t.db, analysisId);
      const error = await rejection(() => t.db.insert(cases).values(caseRow(analysisId)));
      expect(error).toMatchObject({ code: PG.unique, constraint_name: "cases_analysis_id_unique" });
    });

    it("refuses to delete an analysis that already has a case", async () => {
      const analysisId = await insertAnalysis(t.db);
      await insertCase(t.db, analysisId);
      const error = await rejection(() => t.db.delete(analyses).where(eq(analyses.id, analysisId)));
      expect(error.code).toBe(PG.foreignKey);
    });

    it("rejects a case for an analysis that does not exist", async () => {
      const error = await rejection(() =>
        t.db.insert(cases).values(caseRow("00000000-0000-4000-8000-000000000000")),
      );
      expect(error.code).toBe(PG.foreignKey);
    });

    it("defaults to pending_review with no closing time", async () => {
      const created = await insertCase(t.db, await insertAnalysis(t.db));
      const [row] = await t.db.select().from(cases).where(eq(cases.id, created.id));
      expect(row?.status).toBe("pending_review");
      expect(row?.closedAt).toBeNull();
      expect(row?.aiSummary).toBeNull();
      expect(row?.isSeed).toBe(false);
    });

    it("keeps status and closed_at in step in both directions", async () => {
      const analysisId = await insertAnalysis(t.db);
      const early = await rejection(() =>
        t.db.insert(cases).values(caseRow(analysisId, { status: "closed" })),
      );
      expect(early).toMatchObject({
        code: PG.check,
        constraint_name: "cases_closed_at_matches_status",
      });

      const created = await insertCase(t.db, analysisId);
      const stray = await rejection(() =>
        t.db.update(cases).set({ closedAt: new Date() }).where(eq(cases.id, created.id)),
      );
      expect(stray).toMatchObject({
        code: PG.check,
        constraint_name: "cases_closed_at_matches_status",
      });

      await t.db
        .update(cases)
        .set({ status: "closed", closedAt: new Date() })
        .where(eq(cases.id, created.id));
    });

    it("rejects an unknown status, channel and engine verdict", async () => {
      const bad: [Partial<typeof cases.$inferInsert>, string][] = [
        [{ status: "reopened" }, "cases_status_valid"],
        [{ channel: "fax" }, "cases_channel_valid"],
        [{ engineVerdict: "safe" }, "cases_engine_verdict_valid"],
        [{ riskTypes: ["nope"] }, "cases_risk_types_valid"],
      ];
      for (const [override, constraint] of bad) {
        const analysisId = await insertAnalysis(t.db);
        const error = await rejection(() =>
          t.db.insert(cases).values(caseRow(analysisId, override)),
        );
        expect(error).toMatchObject({ code: PG.check, constraint_name: constraint });
      }
    });

    it("RP-01: limits the stored reporter note to 1000 characters", async () => {
      await insertCase(t.db, await insertAnalysis(t.db), { reporterNote: "n".repeat(1000) });
      const analysisId = await insertAnalysis(t.db);
      const error = await rejection(() =>
        t.db.insert(cases).values(caseRow(analysisId, { reporterNote: "n".repeat(1001) })),
      );
      expect(error).toMatchObject({ code: PG.check, constraint_name: "cases_reporter_note_len" });
    });

    it("accepts the seed code format and rejects others; codes are unique", async () => {
      const first = await insertCase(t.db, await insertAnalysis(t.db), {
        code: "SC-0040",
        isSeed: true,
      });
      expect(first.code).toBe("SC-0040");
      for (const code of ["SC-1", "sc-0100", "SC-00A1", "SC-0101 "]) {
        const analysisId = await insertAnalysis(t.db);
        const error = await rejection(() =>
          t.db.insert(cases).values(caseRow(analysisId, { code })),
        );
        expect(error).toMatchObject({ code: PG.check, constraint_name: "cases_code_valid" });
      }
      const dup = await rejection(async () =>
        t.db.insert(cases).values(caseRow(await insertAnalysis(t.db), { code: "SC-0040" })),
      );
      expect(dup).toMatchObject({ code: PG.unique, constraint_name: "cases_code_unique" });
    });
  });

  describe("decisions", () => {
    async function closedCase() {
      const staffId = await insertStaff(t.db);
      const created = await insertCase(t.db, await insertAnalysis(t.db));
      return { staffId, caseId: created.id };
    }
    const decision = (
      caseId: string,
      staffId: string,
      over: Partial<typeof decisions.$inferInsert> = {},
    ) => ({
      caseId,
      decision: "confirmed_scam",
      reason: "Tên miền giả mạo, đã đối chiếu.",
      decidedBy: staffId,
      engineVerdict: "suspicious",
      disagreesWithEngine: false,
      ...over,
    });

    it("allows exactly one decision per case", async () => {
      const { staffId, caseId } = await closedCase();
      await t.db.insert(decisions).values(decision(caseId, staffId));
      const error = await rejection(() =>
        t.db.insert(decisions).values(decision(caseId, staffId, { decision: "not_scam" })),
      );
      expect(error.code).toBe(PG.unique);
    });

    it("rejects an unknown decision and a reason outside 10–500 characters", async () => {
      const { staffId, caseId } = await closedCase();
      const bad = [
        [{ decision: "maybe" }, "decisions_decision_valid"],
        [{ reason: "x".repeat(9) }, "decisions_reason_len"],
        [{ reason: "x".repeat(501) }, "decisions_reason_len"],
        [{ engineVerdict: "safe" }, "decisions_engine_verdict_valid"],
      ] as const;
      for (const [override, constraint] of bad) {
        const error = await rejection(() =>
          t.db.insert(decisions).values(decision(caseId, staffId, override)),
        );
        expect(error).toMatchObject({ code: PG.check, constraint_name: constraint });
      }
      await t.db.insert(decisions).values(decision(caseId, staffId, { reason: "x".repeat(10) }));
    });

    it("rejects a decision by a staff user that does not exist", async () => {
      const { caseId } = await closedCase();
      const error = await rejection(() =>
        t.db.insert(decisions).values(decision(caseId, "00000000-0000-4000-8000-000000000000")),
      );
      expect(error.code).toBe(PG.foreignKey);
    });

    it("refuses to delete a staff user who has made a decision", async () => {
      const { staffId, caseId } = await closedCase();
      await t.db.insert(decisions).values(decision(caseId, staffId));
      const error = await rejection(() =>
        t.db.delete(staffUsers).where(eq(staffUsers.id, staffId)),
      );
      expect(error.code).toBe(PG.foreignKey);
    });

    it("deletes the decision together with its case", async () => {
      const { staffId, caseId } = await closedCase();
      await t.db.insert(decisions).values(decision(caseId, staffId));
      await t.db.delete(cases).where(eq(cases.id, caseId));
      expect(await t.db.select().from(decisions).where(eq(decisions.caseId, caseId))).toEqual([]);
    });
  });

  describe("staff_users and staff_sessions", () => {
    it("accepts lower-case usernames of 3–32 characters from [a-z0-9_]", async () => {
      await insertStaff(t.db, "judge1");
      await insertStaff(t.db, "abc");
      await insertStaff(t.db, "a".repeat(32));
    });

    it("rejects upper-case, too short, too long and punctuated usernames", async () => {
      for (const username of ["Judge1", "ab", "a".repeat(33), "bad-name", "has space"]) {
        const error = await rejection(() => insertStaff(t.db, username));
        expect(error).toMatchObject({
          code: PG.check,
          constraint_name: "staff_users_username_valid",
        });
      }
    });

    it("rejects a duplicate username", async () => {
      const username = uniq("dup_user_");
      await insertStaff(t.db, username);
      const error = await rejection(() => insertStaff(t.db, username));
      expect(error).toMatchObject({
        code: PG.unique,
        constraint_name: "staff_users_username_unique",
      });
    });

    it("deletes sessions together with their user and refuses an orphan session", async () => {
      const staffId = await insertStaff(t.db);
      const tokenHash = uniq("hash_");
      await t.db
        .insert(staffSessions)
        .values({ tokenHash, staffUserId: staffId, expiresAt: new Date(Date.now() + 3_600_000) });
      await t.db.delete(staffUsers).where(eq(staffUsers.id, staffId));
      expect(
        await t.db.select().from(staffSessions).where(eq(staffSessions.tokenHash, tokenHash)),
      ).toEqual([]);

      const error = await rejection(() =>
        t.db.insert(staffSessions).values({
          tokenHash: uniq("orphan_"),
          staffUserId: staffId,
          expiresAt: new Date(),
        }),
      );
      expect(error.code).toBe(PG.foreignKey);
    });
  });
});
