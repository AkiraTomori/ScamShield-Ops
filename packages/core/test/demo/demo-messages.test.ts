import { BRANDS, DEMO_MESSAGES, URL_LISTS, type Signal, type SignalType } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { runChecks } from "../../src/analysis/analyze";
import { S1_BRAND } from "../../src/demo/seed-data";
import { extractIndicators } from "../../src/indicators";
import { redact } from "../../src/redaction";
import { detectInjection } from "../../src/url-checks";
import { decide } from "../../src/verdict";

/**
 * What the model is expected to find in each message. The real model is measured by running it;
 * this only keeps each `expectedVerdict` reachable under rules-v1 (demo-data §2).
 */
const AI_SIGNALS: Record<string, SignalType[]> = {
  M1: ["credential_request"],
  M2: [],
  M3: ["credential_request"],
  prize: ["reward_promise", "payment_request"],
  urgent: ["payment_request", "urgency"],
};

function deterministic(content: string) {
  const extracted = extractIndicators(redact(content).text, BRANDS);
  const { indicators, signals } = runChecks(extracted, { brands: BRANDS, urlLists: URL_LISTS });
  return { indicators, signals: [...signals, ...detectInjection(content)] };
}

const message = (id: string) => {
  const found = DEMO_MESSAGES.find((m) => m.id === id);
  if (!found) throw new Error(`no demo message ${id}`);
  return found;
};

describe("demo messages against the pipeline's deterministic steps", () => {
  it.each(["M1", "M3"])("R-01: %s names the brand of the S1 seed cases", (id) => {
    const brands = extractIndicators(message(id).content, BRANDS)
      .indicators.filter((i) => i.type === "brand")
      .map((i) => i.normalized);
    expect(brands).toEqual([S1_BRAND.toLowerCase()]);
  });

  it.each(["M1", "M3"])("SO-07: %s offers only the shared domain for matching", (id) => {
    const matchable = deterministic(message(id).content).indicators.filter((i) =>
      ["domain", "phone", "bank_account"].includes(i.type),
    );
    expect(matchable.map((i) => i.normalized)).toEqual(["vi-xac-minh.example"]);
  });

  it.each(["M1", "M3"])("SO-02-AC02: code alone sees the unofficial domain in %s", (id) => {
    const types = deterministic(message(id).content).signals.map((s) => s.type);
    expect(types).toContain("brand_domain_mismatch");
  });

  it("M2 raises nothing in code, and its code is redacted", () => {
    expect(deterministic(message("M2").content).signals).toEqual([]);
    expect(redact(message("M2").content).counts.otp).toBe(1);
  });

  it.each(DEMO_MESSAGES.map((m) => [m.id, m] as const))(
    "%s reaches its expected verdict with the expected AI signals",
    (id, { content, expectedVerdict }) => {
      const { indicators, signals } = deterministic(content);
      const fromModel = (AI_SIGNALS[id] ?? []).map((type): Signal => ({
        type,
        source: "ai",
        evidence: content.slice(0, 10),
        indicator: null,
      }));
      const decision = decide({
        signals: [...signals, ...fromModel],
        indicators,
        llmFailure: null,
        textLength: [...content].length,
        brands: BRANDS,
      });
      expect(decision.verdict).toBe(expectedVerdict);
    },
  );
});
