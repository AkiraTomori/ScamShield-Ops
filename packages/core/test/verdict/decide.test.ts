import { BRANDS, type Indicator, type Signal, type SignalType } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { decide, recommend, RECOMMENDATIONS, type DecisionInput } from "../../src/verdict";

const AI = new Set<SignalType>([
  "claims_organization",
  "urgency",
  "threat",
  "credential_request",
  "payment_request",
  "reward_promise",
]);

const signals = (...types: SignalType[]): Signal[] =>
  types.map((type) => ({
    type,
    source: AI.has(type) ? "ai" : "deterministic",
    evidence: null,
    indicator: null,
  }));

const url = (host: string, unavailable = false): Indicator[] => [
  { type: "url", value: host, normalized: `http://${host}/`, checks: [] },
  {
    type: "domain",
    value: host,
    normalized: host,
    checks: unavailable ? [{ type: "domain_age", status: "unavailable", detail: null }] : [],
  },
];

const input = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  signals: [],
  indicators: [],
  llmFailure: null,
  textLength: 100,
  brands: BRANDS,
  ...over,
});

describe("decide: analysis-pipeline §7.3 (SO-03-AC02, AC03)", () => {
  it("M1: impersonation, unknown domain, OTP, deadline → R3 high_risk", () => {
    const d = decide(
      input({
        signals: signals("brand_domain_mismatch", "credential_request", "urgency", "threat"),
        indicators: url("vi-xac-minh.example"),
      }),
    );
    expect(d).toMatchObject({ verdict: "high_risk", rule: "R3", inconclusiveReason: null });
    expect(d.riskTypes).toEqual(["brand_impersonation", "otp_phishing"]);
  });

  it("M2: a real OTP notice that only names an organisation → R9 no_signal", () => {
    const d = decide(input({ signals: signals("claims_organization") }));
    expect(d).toMatchObject({ verdict: "no_signal", rule: "R9", riskTypes: [] });
  });

  it("an urgent transfer request → R7 suspicious", () => {
    const d = decide(input({ signals: signals("payment_request", "urgency") }));
    expect(d).toMatchObject({ verdict: "suspicious", rule: "R7" });
    expect(d.riskTypes).toEqual(["payment_request"]);
  });

  it("SO-01-AC05: injection plus an OTP request → R2 high_risk", () => {
    const d = decide(input({ signals: signals("ai_directed_instruction", "credential_request") }));
    expect(d).toMatchObject({ verdict: "high_risk", rule: "R2" });
  });

  it("'ok' → R8 inconclusive", () => {
    expect(decide(input({ textLength: 2 }))).toMatchObject({
      verdict: "inconclusive",
      rule: "R8",
      inconclusiveReason: "insufficient_evidence",
    });
  });

  it("SO-03-AC02: same signals always yield the same verdict, in any order", () => {
    const list = signals("urgency", "payment_request", "claims_organization");
    expect(decide(input({ signals: list }))).toEqual(
      decide(input({ signals: [...list].reverse() })),
    );
  });
});

describe("decide: remaining rules", () => {
  it.each([
    ["R4", "high_risk", signals("credential_request", "threat")],
    ["R5", "high_risk", signals("credential_request", "ai_directed_instruction")],
    ["R6", "suspicious", signals("credential_request")],
    ["R6", "suspicious", signals("ai_directed_instruction")],
    ["R7", "suspicious", signals("payment_request", "reward_promise")],
    ["R9", "no_signal", signals("payment_request")],
    ["R9", "no_signal", signals("urgency", "claims_organization", "risky_tld")],
  ])("%s → %s", (rule, verdict, list) => {
    // R5 above is also an R2 match; the first matching rule wins.
    const expected = list.some((s) => s.type === "ai_directed_instruction") && list.length > 1;
    expect(decide(input({ signals: list }))).toMatchObject(
      expected ? { rule: "R2", verdict } : { rule, verdict },
    );
  });

  it("R4 also fires when the message asking for credentials has a link", () => {
    const d = decide(input({ signals: signals("credential_request"), indicators: url("a.test") }));
    expect(d.rule).toBe("R4");
  });

  it("R5: two strong signals", () => {
    const d = decide(input({ signals: signals("brand_domain_mismatch", "lookalike_domain") }));
    expect(d).toMatchObject({ rule: "R5", verdict: "high_risk" });
  });

  it("counts a repeated signal type once", () => {
    const d = decide(input({ signals: signals("shortened_url", "shortened_url") }));
    expect(d.rule).toBe("R9");
  });

  it.each(["timeout", "llm_unavailable", "llm_invalid_output"] as const)(
    "SO-03-AC01: without LLM signals (%s) → R0 inconclusive",
    (llmFailure) => {
      const d = decide(input({ llmFailure, signals: signals("brand_domain_mismatch") }));
      expect(d).toMatchObject({
        verdict: "inconclusive",
        rule: "R0",
        inconclusiveReason: llmFailure,
        riskTypes: [],
      });
    },
  );

  it("P-01: hard evidence wins over an LLM failure and keeps the reason", () => {
    const d = decide(input({ llmFailure: "timeout", signals: signals("blocklisted_url") }));
    expect(d).toMatchObject({ verdict: "high_risk", rule: "R1", inconclusiveReason: "timeout" });
  });

  it("SO-03-AC03: an unverifiable unofficial domain with no signals → R8", () => {
    expect(decide(input({ indicators: url("la.example", true) })).rule).toBe("R8");
    expect(decide(input({ indicators: url("momo.vn", true) })).rule).toBe("R9");
    expect(decide(input({ indicators: url("la.example") })).rule).toBe("R9");
  });

  it("brand impersonation also covers a self-declared brand with an unofficial link", () => {
    const d = decide(
      input({
        signals: signals("claims_organization", "reward_promise", "urgency"),
        indicators: [
          { type: "brand", value: "MoMo", normalized: "momo", checks: [] },
          ...url("nhan.test"),
        ],
      }),
    );
    expect(d.riskTypes).toEqual(["brand_impersonation", "fake_prize"]);
  });

  it("falls back to 'other'", () => {
    expect(decide(input({ signals: signals("ai_directed_instruction") })).riskTypes).toEqual([
      "other",
    ]);
  });
});

describe("recommend (SO-03-AC04, A-01)", () => {
  const advise = (over: Partial<DecisionInput>) => {
    const value = input(over);
    return recommend(value, decide(value));
  };

  it("SO-03-AC04: always returns 2 to 4 lines", () => {
    const cases: Partial<DecisionInput>[] = [
      {},
      { textLength: 2 },
      { llmFailure: "timeout" },
      { signals: signals("payment_request", "reward_promise") },
      {
        signals: signals("credential_request", "payment_request", "reward_promise", "threat"),
        indicators: url("a.test"),
      },
      { signals: signals("shortened_url", "urgency") },
    ];
    for (const over of cases) {
      const lines = advise(over);
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines.length).toBeLessThanOrEqual(4);
      expect(new Set(lines).size).toBe(lines.length);
    }
  });

  it("SO-03-AC03: never says 'an toàn' and no_signal reminds to verify officially", () => {
    const all = Object.values(RECOMMENDATIONS)
      .map((r) => (typeof r === "function" ? r("MoMo") : r))
      .join(" ")
      .toLowerCase();
    expect(all).not.toContain("an toàn");
    expect(advise({})).toContain(RECOMMENDATIONS.noSignalVerify);
  });

  it("names the brand and puts the credential warning first", () => {
    const lines = advise({
      signals: signals("credential_request", "urgency"),
      indicators: [
        { type: "brand", value: "MoMo", normalized: "momo", checks: [] },
        ...url("a.test"),
      ],
    });
    expect(lines).toEqual([
      RECOMMENDATIONS.noSecrets,
      RECOMMENDATIONS.noClick,
      RECOMMENDATIONS.contactBrand("MoMo"),
      RECOMMENDATIONS.report,
    ]);
  });

  it("suggests retrying only for system failures", () => {
    expect(advise({ llmFailure: "llm_unavailable" })).toContain(RECOMMENDATIONS.retry);
    expect(advise({ textLength: 2 })).not.toContain(RECOMMENDATIONS.retry);
  });
});
