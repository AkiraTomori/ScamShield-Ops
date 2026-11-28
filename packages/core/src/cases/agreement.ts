import type { Decision, Verdict } from "@scamshield/shared";

/** The agreement table of SO-06-AC04: a decision agrees only with the verdicts listed for it. */
const AGREES_WITH: Record<Decision, readonly Verdict[]> = {
  confirmed_scam: ["high_risk", "suspicious"],
  not_scam: ["no_signal"],
  insufficient_evidence: ["inconclusive"],
};

export function disagreesWithEngine(decision: Decision, verdict: Verdict): boolean {
  return !AGREES_WITH[decision].includes(verdict);
}
