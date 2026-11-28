import {
  AnalysisDetails,
  BRANDS,
  DEMO_MESSAGES,
  EXPLANATION_MAX_CHARS,
  LlmCaseSummaryOutput,
  standardizeText,
  Verdict,
  type SignalType,
} from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { disagreesWithEngine } from "../../src/cases/agreement";
import { buildSeedAnalysis, SEED_CASES, type SeedCase } from "../../src/demo/seed-data";
import { extractIndicators } from "../../src/indicators";
import { rejectModelText } from "../../src/llm/output-filters";
import { filterCaseSummary } from "../../src/llm/summarize-case";
import { redact } from "../../src/redaction";
import { decide } from "../../src/verdict";

const S1_DOMAIN = "vi-xac-minh.example";

const matchableOf = (content: string) =>
  extractIndicators(content, BRANDS)
    .indicators.filter((i) => ["domain", "phone", "bank_account"].includes(i.type))
    .map((i) => `${i.type} ${i.normalized}`);

const hasS1Domain = (c: SeedCase) => matchableOf(c.content).includes(`domain ${S1_DOMAIN}`);
const s1 = SEED_CASES.filter(hasS1Domain);
const others = SEED_CASES.filter((c) => !hasS1Domain(c));
const pending = others.filter((c) => c.decision === null);
const closed = others.filter((c) => c.decision !== null);

describe("seed cases", () => {
  it("SO-10-AC03: 24 cases with the codes SC-0001 to SC-0024, in order", () => {
    expect(SEED_CASES.map((c) => c.code)).toEqual(
      Array.from({ length: 24 }, (_, i) => `SC-${String(i + 1).padStart(4, "0")}`),
    );
  });

  it("SO-10-AC03: the mix of demo-data §3.3", () => {
    expect([s1.length, pending.length, closed.length]).toEqual([3, 14, 7]);
    expect(new Set(pending.map((c) => c.expected.verdict))).toEqual(new Set(Verdict.options));
    expect(new Set(closed.map((c) => c.decision?.decision)).size).toBe(3);
    const disagreeing = closed.filter(
      (c) => c.decision && disagreesWithEngine(c.decision.decision, c.expected.verdict),
    );
    expect(disagreeing.length).toBeGreaterThanOrEqual(2);
    const noSummary = SEED_CASES.filter((c) => c.aiSummary === null);
    expect(noSummary).toHaveLength(1);
    expect(pending).toContain(noSummary[0]);
  });

  it("S1: three cases share the domain, none confirmed, one disagreeing with the engine", () => {
    expect(s1.map((c) => c.decision?.decision ?? "pending_review").sort()).toEqual([
      "insufficient_evidence",
      "not_scam",
      "pending_review",
    ]);
    const notScam = s1.find((c) => c.decision?.decision === "not_scam");
    expect(notScam && disagreesWithEngine("not_scam", notScam.expected.verdict)).toBe(true);
  });

  it("SO-07: besides S1, only two pending cases share an indicator, and it is not a domain", () => {
    const owners = new Map<string, string[]>();
    for (const c of others) {
      for (const key of matchableOf(c.content)) {
        owners.set(key, [...(owners.get(key) ?? []), c.code]);
      }
    }
    const shared = [...owners].filter(([, codes]) => codes.length > 1);
    expect(shared).toHaveLength(1);
    const [key, codes] = shared[0]!;
    expect(key.startsWith("domain ")).toBe(false);
    expect(codes).toHaveLength(2);
    expect(pending.filter((c) => codes.includes(c.code))).toHaveLength(2);
    // The S1 cases share the domain and nothing else with the rest.
    const s1Keys = s1.flatMap((c) => matchableOf(c.content));
    expect(s1Keys.filter((k) => owners.has(k))).toEqual([]);
  });

  it("shares no indicator with a demo message, apart from the S1 domain", () => {
    const demo = new Set(DEMO_MESSAGES.flatMap((m) => matchableOf(m.content)));
    demo.delete(`domain ${S1_DOMAIN}`);
    for (const c of SEED_CASES) {
      expect(
        matchableOf(c.content).filter((k) => demo.has(k)),
        c.code,
      ).toEqual([]);
    }
  });

  it("names a real brand in the three S1 cases only, and the same one (DM-04)", () => {
    const brandsOf = (c: SeedCase) =>
      extractIndicators(c.content, BRANDS)
        .indicators.filter((i) => i.type === "brand")
        .map((i) => i.normalized);
    for (const c of SEED_CASES) {
      expect(brandsOf(c), c.code).toEqual(s1.includes(c) ? ["vietcombank"] : []);
    }
  });

  it("copies no demo message", () => {
    const demo = new Set(DEMO_MESSAGES.map((m) => m.content));
    expect(SEED_CASES.filter((c) => demo.has(c.content))).toEqual([]);
  });

  describe.each(SEED_CASES.map((c) => [c.code, c] as const))("%s", (_code, c) => {
    const built = buildSeedAnalysis(c);

    it("SO-10-AC03: records the verdict, rule and risk types that rules-v1 gives", () => {
      const decision = decide(built.decisionInput);
      expect(c.expected).toEqual({
        verdict: decision.verdict,
        rule: decision.rule,
        riskTypes: decision.riskTypes,
      });
      expect(built.inconclusiveReason).toBe(decision.inconclusiveReason);
    });

    it("has details that parse, with evidence taken from the message", () => {
      expect(() => AnalysisDetails.parse(built.details)).not.toThrow();
      for (const { evidence } of c.aiSignals) expect(c.content).toContain(evidence);
      const types: SignalType[] = built.details.signals.map((s) => s.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it("stores content as the pipeline would: standardized and redacted", () => {
      expect(standardizeText(c.content)).toBe(c.content);
      expect(redact(c.content)).toEqual({
        text: c.content,
        counts: { otp: 0, password: 0, card: 0 },
      });
      expect(c.note === null || redact(c.note).text === c.note).toBe(true);
    });

    it("lists every matchable indicator of the message", () => {
      expect(built.matchable.map((i) => `${i.type} ${i.normalized}`).sort()).toEqual(
        matchableOf(c.content).sort(),
      );
    });

    it("uses only reserved domains", () => {
      for (const i of built.details.indicators.filter((i) => i.type === "domain")) {
        expect(i.normalized).toMatch(/\.(example|test)$/);
      }
    });

    it("has texts that would pass the model output filters", () => {
      if (c.explanation !== null) {
        expect(rejectModelText(c.explanation, c.content, EXPLANATION_MAX_CHARS)).toBeUndefined();
      }
      // No model ran, so there is nothing it could have explained.
      if (c.llmFailure) {
        expect(c.explanation).toBeNull();
        expect(c.aiSignals).toEqual([]);
      }
      if (c.aiSummary !== null) {
        expect(LlmCaseSummaryOutput.parse(c.aiSummary)).toEqual(c.aiSummary);
        expect(filterCaseSummary(c.aiSummary, c.content)).toBeUndefined();
      }
      if (c.decision) {
        expect(c.decision.reason.length).toBeGreaterThanOrEqual(10);
        expect(c.decision.reason.length).toBeLessThanOrEqual(500);
      }
    });
  });
});
