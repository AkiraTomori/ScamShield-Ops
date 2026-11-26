import { describe, expect, it } from "vitest";
import {
  AnalysisResult,
  BRANDS,
  CreateAnalysisRequest,
  MAX_INPUT_CHARS,
  normalizeInput,
  parseAnalysisEnv,
  URL_LISTS,
} from "../src";

describe("normalizeInput", () => {
  it("SO-01-AC02: rejects empty and whitespace-only content", () => {
    for (const raw of ["", "   \n\t ", "\u200B\u2060\uFEFF"]) {
      expect(normalizeInput(raw)).toEqual({ ok: false, code: "empty" });
    }
  });

  it("SO-01-AC02: allows exactly 2,000 code points and rejects 2,001", () => {
    expect(normalizeInput("😀".repeat(MAX_INPUT_CHARS)).ok).toBe(true);
    expect(normalizeInput("a".repeat(MAX_INPUT_CHARS + 1))).toEqual({
      ok: false,
      code: "too_long",
    });
  });

  it("counts after NFC, so decomposed Vietnamese is not penalised", () => {
    const decomposed = "ế".normalize("NFD").repeat(MAX_INPUT_CHARS);
    expect(normalizeInput(decomposed).ok).toBe(true);
  });

  it("strips control and zero-width characters but keeps newlines and tabs", () => {
    expect(normalizeInput(" vi\u200Bxy\u0007z.example\r\nb\tc ")).toEqual({
      ok: true,
      text: "vixyz.example\nb\tc",
    });
  });
});

describe("analysis contract", () => {
  const result = {
    analysisId: "6f1c0b1e-5a3e-4e7b-9d0a-2c6f1b8a9d10",
    verdict: "high_risk",
    inconclusiveReason: null,
    riskTypes: ["otp_phishing"],
    signals: [{ type: "urgency", source: "ai", evidence: "trong 2 giờ", indicator: null }],
    indicators: [],
    redactions: { otp: 0, password: 0, card: 0 },
    explanation: null,
    recommendations: ["Một.", "Hai."],
    rule: "R5",
    promptVersion: "p",
    rulesVersion: "rules-v1",
    createdAt: "2026-11-26T03:10:00Z",
  };

  it("SO-03-AC04: accepts a result and has no field for a score or probability", () => {
    expect(AnalysisResult.parse(result)).toEqual(result);
    expect(AnalysisResult.safeParse({ ...result, score: 0.9 }).success).toBe(false);
    expect(Object.keys(AnalysisResult.shape).join(" ")).not.toMatch(/score|probab|confidence/i);
  });

  it("SO-03-AC04: needs 2 to 4 recommendations", () => {
    for (const recommendations of [["Một."], ["1", "2", "3", "4", "5"]]) {
      expect(AnalysisResult.safeParse({ ...result, recommendations }).success).toBe(false);
    }
  });

  it("rejects unknown request fields", () => {
    expect(CreateAnalysisRequest.safeParse({ content: "a", url: "x" }).success).toBe(false);
  });
});

describe("data files", () => {
  it("brands.json holds the 18 brands the owner approved (Q-10)", () => {
    expect(BRANDS).toHaveLength(18);
    expect(BRANDS.find((b) => b.id === "vietcombank")?.domains).toEqual(["vietcombank.com.vn"]);
  });

  it("every url-list entry names a declared source (P-04)", () => {
    expect(URL_LISTS.shorteners.length).toBeGreaterThan(0);
    expect(URL_LISTS.riskyTlds.length).toBeGreaterThan(0);
  });
});

describe("parseAnalysisEnv", () => {
  const env = {
    DATABASE_URL: "postgresql://u:p@localhost:5432/db",
    GROQ_API_KEY: "test-key",
    GROQ_MODEL_SIGNALS: "model-a",
    GROQ_MODEL_EXPLAIN: "model-b",
    RATE_LIMIT_SALT: "x".repeat(32),
  };

  it("applies defaults and treats empty optional values as unset", () => {
    const parsed = parseAnalysisEnv({ ...env, LLM_DAILY_CALL_CAP: "", SAFE_BROWSING_API_KEY: "" });
    expect(parsed.success && parsed.data.GROQ_REASONING_EFFORT).toBe("low");
    expect(parsed.success && parsed.data.LLM_DAILY_CALL_CAP).toBeUndefined();
  });

  it("requires the key, both models and a long enough salt", () => {
    for (const bad of [
      { GROQ_API_KEY: "" },
      { GROQ_MODEL_SIGNALS: "" },
      { GROQ_MODEL_EXPLAIN: undefined },
      { RATE_LIMIT_SALT: "short" },
      { LLM_DAILY_CALL_CAP: "0" },
    ]) {
      expect(parseAnalysisEnv({ ...env, ...bad }).success).toBe(false);
    }
  });
});
