import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { BRANDS, URL_LISTS } from "@scamshield/shared";
import { analyzeMessage, saveAnalysis } from "../../src/analysis";
import type { StaffSession } from "../../src/auth";
import { getCaseDetail } from "../../src/cases";
import { analyses, cases, decisions } from "../../src/db/schema";
import {
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertStaff,
  type TestDatabase,
} from "../db/helpers";
import { okText } from "../llm/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const SESSION = {
  staffUserId: "u",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;

const DETAILS = {
  signals: [
    {
      type: "brand_domain_mismatch",
      source: "deterministic",
      evidence: "vi-xac-minh.example",
      indicator: "vi-xac-minh.example",
    },
    { type: "credential_request", source: "ai", evidence: "nhập mã OTP", indicator: null },
  ],
  indicators: [
    {
      type: "domain",
      value: "vi-xac-minh.example",
      normalized: "vi-xac-minh.example",
      checks: [{ type: "domain_age", status: "unavailable", detail: null }],
    },
  ],
  explanation: "Tên miền không thuộc thương hiệu được nhắc tới.",
  recommendations: ["Không bấm đường dẫn.", "Không đưa mã OTP."],
};
const SUMMARY = {
  summary: "Tin nhắn yêu cầu nhập mã OTP.",
  nextSteps: ["Đối chiếu tên miền."],
};

describe.skipIf(!url)("getCaseDetail", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  const read = (code: string) => getCaseDetail(SESSION, code, { db: t.db });

  async function newCase(overrides: { details?: unknown; aiSummary?: unknown } = {}) {
    const analysisId = await insertAnalysis(t.db, {
      details: overrides.details ?? DETAILS,
      verdict: "high_risk",
      rule: "R3",
    });
    const created = await insertCase(t.db, analysisId, {
      engineVerdict: "high_risk",
      reporterNote: "Nhận lúc 9h",
      aiSummary: overrides.aiSummary === undefined ? SUMMARY : overrides.aiSummary,
    });
    return { ...created, analysisId };
  }

  it("SO-05-AC01: returns content, indicators, checks, signals, verdict, risks, source and time", async () => {
    const { id, code, analysisId } = await newCase();
    expect(await read(code)).toEqual({
      caseId: id,
      caseCode: code,
      status: "pending_review",
      createdAt: expect.any(String),
      isSeed: false,
      source: "user_report",
      channel: "sms",
      reporterNote: "Nhận lúc 9h",
      redactedContent: "Tin nhắn mẫu, liên hệ https://vi-xac-minh.example/otp",
      analysis: {
        ...DETAILS,
        analysisId,
        verdict: "high_risk",
        inconclusiveReason: null,
        riskTypes: ["otp_phishing"],
        redactions: { otp: 0, password: 0, card: 0 },
        rule: "R3",
        promptVersion: "test-prompt",
        rulesVersion: "test-rules",
        createdAt: expect.any(String),
      },
      aiSummary: SUMMARY,
      decision: null,
      relatedCases: { total: 0, items: [] },
    });
  });

  it("reads what the pipeline really writes", async () => {
    const outcome = await analyzeMessage("Xác minh tại momo-uudai.example, mã OTP 482913", {
      llm: { chatJson: async () => okText('{"signals":[],"mentionedBrands":[]}') },
      models: { signals: "m", explain: "m" },
      brands: BRANDS,
      urlLists: URL_LISTS,
      verifiedIndicators: async () => [],
      now: () => new Date("2026-11-28T03:00:00.000Z"),
      random: () => "0123456789abcdef",
      newId: () => "5b0f3c1e-9a52-4c64-9d0e-7b1f2a3c4d5e",
    });
    await saveAnalysis(outcome, { db: t.db });
    const { code } = await insertCase(t.db, outcome.result.analysisId, {
      engineVerdict: outcome.result.verdict,
      riskTypes: outcome.result.riskTypes,
    });
    expect((await read(code))?.analysis).toEqual(outcome.result);
  });

  it("returns the decision with the staff member's name", async () => {
    const { id, code } = await newCase();
    const at = new Date("2026-11-28T04:00:00.000Z");
    await t.db.update(cases).set({ status: "closed", closedAt: at }).where(eq(cases.id, id));
    await t.db.insert(decisions).values({
      caseId: id,
      decision: "not_scam",
      reason: "Đã xác minh với người gửi.",
      decidedBy: await insertStaff(t.db),
      decidedAt: at,
      engineVerdict: "high_risk",
      disagreesWithEngine: true,
    });
    expect(await read(code)).toMatchObject({
      status: "closed",
      decision: {
        decision: "not_scam",
        reason: "Đã xác minh với người gửi.",
        decidedBy: "Nhân viên thử",
        decidedAt: at.toISOString(),
        disagreesWithEngine: true,
      },
    });
  });

  it("keeps a case without an AI summary readable (A-02)", async () => {
    const { code } = await newCase({ aiSummary: null });
    expect((await read(code))?.aiSummary).toBeNull();
  });

  it("finds the case however its code is typed, and nothing else", async () => {
    const { code } = await newCase();
    for (const typed of [code.toLowerCase(), String(Number(code.slice(3)))]) {
      expect((await read(typed))?.caseCode).toBe(code);
    }
    for (const typed of ["SC-9999", "SC-1", "abc", "SC-0101' OR '1'='1"]) {
      expect(await read(typed)).toBeNull();
    }
  });

  it.each([
    ["details", { details: { signals: [], indicators: [] } }],
    ["AI summary", { aiSummary: { summary: "" } }],
  ])("DB-02: refuses stored %s that does not parse, naming only the case", async (_name, bad) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { code, analysisId } = await newCase(bad);
    await expect(read(code)).rejects.toThrow(/^case_detail_invalid$/);
    const written = JSON.stringify(log.mock.calls);
    expect(written).toContain(code);
    const [row] = await t.db.select().from(analyses).where(eq(analyses.id, analysisId));
    expect(written).not.toContain(row!.redactedContent);
    log.mockRestore();
  });
});
