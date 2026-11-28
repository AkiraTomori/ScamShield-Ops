import { Decision, Verdict } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import { disagreesWithEngine } from "../../src/cases/agreement";

// SO-06-AC04, word for word: every pair not listed as agreeing is a disagreement.
const TABLE: [Decision, Verdict, boolean][] = [
  ["confirmed_scam", "high_risk", false],
  ["confirmed_scam", "suspicious", false],
  ["confirmed_scam", "no_signal", true],
  ["confirmed_scam", "inconclusive", true],
  ["not_scam", "high_risk", true],
  ["not_scam", "suspicious", true],
  ["not_scam", "no_signal", false],
  ["not_scam", "inconclusive", true],
  ["insufficient_evidence", "high_risk", true],
  ["insufficient_evidence", "suspicious", true],
  ["insufficient_evidence", "no_signal", true],
  ["insufficient_evidence", "inconclusive", false],
];

describe("disagreesWithEngine", () => {
  it("covers every decision against every verdict", () => {
    expect(new Set(TABLE.map(([d, v]) => `${d} ${v}`)).size).toBe(
      Decision.options.length * Verdict.options.length,
    );
  });

  it.each(TABLE)("SO-06-AC04: %s on %s → disagrees %s", (decision, verdict, disagrees) => {
    expect(disagreesWithEngine(decision, verdict)).toBe(disagrees);
  });
});
