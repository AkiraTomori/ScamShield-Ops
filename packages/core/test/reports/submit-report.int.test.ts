import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { cases } from "../../src/db/schema";
import {
  CASE_SUMMARY_PROMPT_VERSION,
  type ChatJsonRequest,
  type ChatJsonResult,
} from "../../src/llm";
import {
  normalizeSecretCode,
  submitReport,
  verifySecret,
  type ReportDeps,
} from "../../src/reports";
import { createTestDatabase, insertAnalysis, type TestDatabase } from "../db/helpers";
import { okText } from "../llm/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

const SUMMARY = { summary: "Tin đòi mã OTP và tạo áp lực.", nextSteps: ["Đối chiếu tên miền."] };
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

describe.skipIf(!url)("submitReport", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  const analysis = () =>
    insertAnalysis(t.db, {
      redactedContent: "Gửi mã tại vi-xac-minh.example ngay",
      verdict: "high_risk",
      riskTypes: ["otp_phishing"],
      details: {
        signals: [{ type: "urgency", source: "ai", evidence: "ngay", indicator: null }],
        indicators: [],
        explanation: null,
        recommendations: ["Đừng làm theo.", "Hỏi lại tổ chức."],
      },
    });

  function deps(over: Partial<ReportDeps> = {}) {
    const chatJson = vi.fn<(request: ChatJsonRequest) => Promise<ChatJsonResult>>(async () =>
      okText(JSON.stringify(SUMMARY)),
    );
    const value: ReportDeps = {
      db: t.db,
      llm: { chatJson },
      model: "m",
      now: () => new Date(),
      random: () => "abc",
      log: () => {},
      ...over,
    };
    return { deps: value, chatJson };
  }

  const stored = async (analysisId: string) =>
    t.db.select().from(cases).where(eq(cases.analysisId, analysisId));

  it("SO-04-AC01, SO-05-AC01: creates a pending case with a snapshot of the analysis", async () => {
    const id = await analysis();
    const result = await submitReport(id, { channel: "zalo", note: "Nhận lúc 9h" }, deps().deps);
    if (result.kind !== "created") throw new Error(result.kind);
    expect(result.caseCode).toMatch(/^SC-\d{4}$/);
    expect(result.secretCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);

    const [row] = await stored(id);
    expect(row).toMatchObject({
      code: result.caseCode,
      status: "pending_review",
      channel: "zalo",
      reporterNote: "Nhận lúc 9h",
      engineVerdict: "high_risk",
      riskTypes: ["otp_phishing"],
      aiSummary: SUMMARY,
      summaryPromptVersion: CASE_SUMMARY_PROMPT_VERSION,
      closedAt: null,
    });
    const secret = normalizeSecretCode(result.secretCode) ?? "";
    expect(await verifySecret(secret, row?.secretHash ?? "")).toBe(true);
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it("SO-04-AC03: reporting again makes no model call and no second case", async () => {
    const id = await analysis();
    const first = await submitReport(id, { channel: "sms" }, deps().deps);
    const again = deps();
    const second = await submitReport(id, { channel: "email" }, again.deps);
    expect(second).toEqual({
      kind: "already_reported",
      caseCode: first.kind === "created" ? first.caseCode : "",
    });
    expect(again.chatJson).not.toHaveBeenCalled();
    expect(await stored(id)).toHaveLength(1);
  });

  it("SO-04-AC03: two reports at the same time create exactly one case", async () => {
    const id = await analysis();
    // Both calls must be past the "already reported" check before either may insert.
    let release: () => void = () => {};
    const bothAsked = new Promise<void>((resolve) => (release = resolve));
    let asked = 0;
    const waiting = deps({
      llm: {
        chatJson: async () => {
          if (++asked === 2) release();
          await bothAsked;
          return okText(JSON.stringify(SUMMARY));
        },
      },
    });
    const results = await Promise.all([
      submitReport(id, { channel: "sms" }, waiting.deps),
      submitReport(id, { channel: "sms" }, waiting.deps),
    ]);
    expect(asked).toBe(2);
    expect(results.map((r) => r.kind).sort()).toEqual(["already_reported", "created"]);
    const rows = await stored(id);
    expect(rows).toHaveLength(1);
    for (const result of results) {
      expect(result).toMatchObject({ caseCode: rows[0]?.code });
    }
  });

  it.each([
    ["the model is down", { ok: false, kind: "unavailable", status: 429, latencyMs: 1 } as const],
    ["the model is too slow", { ok: false, kind: "timeout", latencyMs: 8000 } as const],
    ["the summary is filtered", okText('{"summary":"Tin an toàn.","nextSteps":["Ghi nhận."]}')],
  ])("SO-05-AC02: still creates the case when %s", async (_, reply) => {
    const id = await analysis();
    const log = vi.fn();
    const result = await submitReport(
      id,
      { channel: "sms" },
      deps({ llm: { chatJson: async () => reply }, log }).deps,
    );
    expect(result.kind).toBe("created");
    expect((await stored(id))[0]).toMatchObject({ aiSummary: null, summaryPromptVersion: null });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "case_summary_failed" }));
  });

  it("P-03: does not call the model once the daily cap is reached", async () => {
    const id = await analysis();
    const capped = deps({ reserveLlmCall: async () => false });
    expect((await submitReport(id, { channel: "sms" }, capped.deps)).kind).toBe("created");
    expect(capped.chatJson).not.toHaveBeenCalled();
    expect((await stored(id))[0]?.aiSummary).toBeNull();
  });

  it("creates the case without a summary when stored details cannot be read", async () => {
    const id = await insertAnalysis(t.db, { details: { broken: true } });
    const run = deps();
    expect((await submitReport(id, { channel: "sms" }, run.deps)).kind).toBe("created");
    expect(run.chatJson).not.toHaveBeenCalled();
  });

  it("SO-01-AC03: redacts the note before storing it and before the model sees it", async () => {
    const id = await analysis();
    const run = deps();
    await submitReport(id, { channel: "sms", note: "Tôi đã đưa mã OTP 482913" }, run.deps);
    const [row] = await stored(id);
    expect(row?.reporterNote).toBe("Tôi đã đưa mã OTP [OTP ĐÃ CHE]");
    expect(run.chatJson.mock.calls[0]?.[0].user).toContain("[OTP ĐÃ CHE]");
    expect(JSON.stringify(run.chatJson.mock.calls)).not.toContain("482913");
  });

  it("RP-01: a note that redaction lengthens past the column is cut, not rejected", async () => {
    const id = await analysis();
    const note = "mk a1 ".repeat(83);
    expect([...note].length).toBeLessThanOrEqual(500);
    expect((await submitReport(id, { channel: "sms", note }, deps().deps)).kind).toBe("created");
    expect([...((await stored(id))[0]?.reporterNote ?? "")]).toHaveLength(1000);
  });

  it("stores a blank note as no note", async () => {
    const id = await analysis();
    await submitReport(id, { channel: "sms", note: " \n " }, deps().deps);
    expect((await stored(id))[0]?.reporterNote).toBeNull();
  });

  it("answers analysis_not_found for an unknown analysis", async () => {
    const run = deps();
    expect(await submitReport(MISSING_ID, { channel: "sms" }, run.deps)).toEqual({
      kind: "analysis_not_found",
    });
    expect(run.chatJson).not.toHaveBeenCalled();
  });
});
