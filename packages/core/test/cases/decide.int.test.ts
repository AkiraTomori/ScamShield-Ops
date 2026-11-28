import { DecisionRequest, type Verdict } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { StaffSession } from "../../src/auth";
import { decideCase, getCaseDetail, listCases } from "../../src/cases";
import { cases, decisions, staffUsers } from "../../src/db/schema";
import { hashSecret, lookupPublicStatus } from "../../src/reports";
import {
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertStaff,
  PG,
  rejection,
  type TestDatabase,
} from "../db/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const NOW = new Date("2026-11-28T05:00:00.000Z");
const REASON = "Tên miền giả mạo thương hiệu.";
const DETAILS = {
  signals: [],
  indicators: [],
  explanation: null,
  recommendations: ["Không bấm đường dẫn.", "Không đưa mã OTP."],
};

describe.skipIf(!url)("decideCase", () => {
  let t: TestDatabase;
  let first: StaffSession;
  let second: StaffSession;

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    // The session carries the name stored for the account, as `verifySession` gives it.
    const staff = async (displayName: string) => {
      const staffUserId = await insertStaff(t.db);
      await t.db.update(staffUsers).set({ displayName }).where(eq(staffUsers.id, staffUserId));
      return { staffUserId, username: "u", displayName } as StaffSession;
    };
    first = await staff("Giám khảo 1");
    second = await staff("Giám khảo 2");
  });
  afterAll(async () => {
    await t?.drop();
  });

  const decide = (session: StaffSession, code: string, req: DecisionRequest, at = NOW) =>
    decideCase(session, code, req, { db: t.db, now: () => at });

  async function newCase(verdict: Verdict = "high_risk") {
    const analysisId = await insertAnalysis(t.db, { verdict: "suspicious", details: DETAILS });
    return insertCase(t.db, analysisId, {
      engineVerdict: verdict,
      secretHash: await hashSecret("K7QX2M9P"),
    });
  }

  const row = async (id: string) => (await t.db.select().from(cases).where(eq(cases.id, id)))[0]!;
  const decisionsOf = (id: string) => t.db.select().from(decisions).where(eq(decisions.caseId, id));

  it("SO-06-AC03: closes the case and keeps who decided what, and when", async () => {
    const { id, code } = await newCase();
    const result = await decide(first, code.toLowerCase(), {
      decision: "confirmed_scam",
      reason: REASON,
    });
    expect(result).toEqual({
      kind: "decided",
      decision: {
        decision: "confirmed_scam",
        reason: REASON,
        decidedBy: "Giám khảo 1",
        decidedAt: NOW.toISOString(),
        disagreesWithEngine: false,
      },
    });
    expect(await row(id)).toMatchObject({ status: "closed", closedAt: NOW, updatedAt: NOW });
    expect(await decisionsOf(id)).toMatchObject([
      { decidedBy: first.staffUserId, engineVerdict: "high_risk", disagreesWithEngine: false },
    ]);
  });

  it("SO-06-AC04: stores the disagreement with the verdict of the case", async () => {
    const { id, code } = await newCase("high_risk");
    await decide(first, code, { decision: "not_scam", reason: REASON });
    expect(await decisionsOf(id)).toMatchObject([
      { engineVerdict: "high_risk", disagreesWithEngine: true },
    ]);
  });

  it("answers a second decision with the first one and changes nothing", async () => {
    const { id, code } = await newCase();
    const won = await decide(first, code, { decision: "confirmed_scam", reason: REASON });
    const later = new Date(NOW.getTime() + 60_000);
    const lost = await decide(second, code, { decision: "not_scam", reason: REASON }, later);
    expect(lost).toEqual({ kind: "conflict", decision: (won as { decision: unknown }).decision });
    expect(await row(id)).toMatchObject({ updatedAt: NOW });
    expect(await decisionsOf(id)).toHaveLength(1);
  });

  it("lets exactly one of two concurrent decisions through", async () => {
    for (let round = 0; round < 5; round += 1) {
      const { id, code } = await newCase();
      const results = await Promise.all([
        decide(first, code, { decision: "confirmed_scam", reason: REASON }),
        decide(second, code, { decision: "not_scam", reason: REASON }),
      ]);
      expect(results.map((r) => r.kind).sort()).toEqual(["conflict", "decided"]);
      const [a, b] = results as { decision: unknown }[];
      expect(a!.decision).toEqual(b!.decision);
      expect(await decisionsOf(id)).toHaveLength(1);
    }
  });

  it("finds nothing for an unknown or unreadable code", async () => {
    for (const code of ["SC-9999", "abc", "SC-0101' OR '1'='1"]) {
      expect(await decide(first, code, { decision: "not_scam", reason: REASON })).toEqual({
        kind: "not_found",
      });
    }
  });

  it("SO-06-AC03: never leaves a case closed without a decision", async () => {
    const { id, code } = await newCase();
    expect(DecisionRequest.safeParse({ decision: "not_scam", reason: "ngắn quá" }).success).toBe(
      false,
    );
    // Past the schema, the database refuses it too, and the whole transaction rolls back.
    const error = await rejection(() =>
      decide(first, code, { decision: "not_scam", reason: "123456789" }),
    );
    expect(error.code).toBe(PG.check);
    expect(await row(id)).toMatchObject({ status: "pending_review", closedAt: null });
    expect(await decisionsOf(id)).toHaveLength(0);
  });

  it("SO-06-AC05: is still there for later reads, and for the reporter", async () => {
    const { code } = await newCase();
    await decide(first, code, { decision: "insufficient_evidence", reason: REASON });
    const detail = await getCaseDetail(second, code, { db: t.db });
    expect(detail).toMatchObject({
      status: "closed",
      decision: { decision: "insufficient_evidence", decidedBy: "Giám khảo 1" },
    });
    const waiting = await listCases(
      second,
      { status: "pending_review", verdict: null, code: "", page: 1 },
      { db: t.db },
    );
    expect(waiting.items.map((item) => item.caseCode)).not.toContain(code);
    expect(
      await lookupPublicStatus({ caseCode: code, secretCode: "K7QX-2M9P" }, { db: t.db }),
    ).toEqual({ caseCode: code, status: "insufficient_evidence", updatedAt: NOW.toISOString() });
  });
});
