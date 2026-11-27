import { describe, expect, it } from "vitest";
import { AnalysisResult, InconclusiveReason, Verdict } from "@scamshield/shared";
import { FIXTURES } from "../../src/features/analysis/fixtures";

const all = FIXTURES.map((f) => f.result);

// scamshield-ui §4: what the fixtures must cover, in the shape the server would send.
describe("analysis result fixtures", () => {
  it.each(FIXTURES.map((f) => [f.name, f.result] as const))("%s matches the schema", (_, r) => {
    expect(AnalysisResult.parse(r)).toEqual(r);
  });

  it("cover every verdict and every inconclusive reason", () => {
    expect(new Set(all.map((r) => r.verdict))).toEqual(new Set(Verdict.options));
    expect(new Set(all.flatMap((r) => r.inconclusiveReason ?? []))).toEqual(
      new Set(InconclusiveReason.options),
    );
  });

  it("cover the edge cases", () => {
    expect(all.some((r) => r.verdict === "high_risk" && r.inconclusiveReason)).toBe(true);
    expect(all.some((r) => r.signals.length === 0)).toBe(true);
    expect(all.some((r) => r.indicators.length === 0)).toBe(true);
    expect(all.some((r) => r.explanation === null)).toBe(true);
    expect(all.some((r) => Object.values(r.redactions).every((n) => n > 0))).toBe(true);
    expect(all.some((r) => Object.values(r.redactions).every((n) => n === 0))).toBe(true);
    const checks = all.flatMap((r) => r.indicators.flatMap((i) => i.checks));
    expect(checks.some((c) => c.status === "unavailable")).toBe(true);
    expect(checks.some((c) => c.type === "official_domain" && c.status === "pass")).toBe(true);
    expect(checks.some((c) => c.detail?.startsWith("unknown"))).toBe(true);
    expect(checks.some((c) => c.type === "punycode" && c.detail?.startsWith("decoded:"))).toBe(
      true,
    );
    expect(all.some((r) => r.indicators.some((i) => /^\S{100,}$/.test(i.value)))).toBe(true);
  });

  it("use only reserved domains", () => {
    for (const r of all) {
      for (const [host] of JSON.stringify(r).matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi)) {
        expect(host).toMatch(/\.(example|test)$/);
      }
    }
  });
});
