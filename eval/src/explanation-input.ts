import { AiSignalType } from "@scamshield/shared";
import type { ExplanationInput } from "@scamshield/core";
import type { EvalCase } from "./case";

const AI_TYPES = new Set<string>(AiSignalType.options);

/**
 * In S2 there is no verdict engine yet, so the explanation step is fed from the case LABELS
 * (rule code "label"). This measures how well the model writes Vietnamese, independent of S3.
 * Labels carry no evidence text, so `evidence` is null.
 */
export function labelExplanationInput(c: EvalCase): ExplanationInput {
  return {
    verdict: c.expectedVerdicts[0] ?? "inconclusive",
    rule: "label",
    signals: c.expectedSignals.map((type) => ({
      type,
      source: AI_TYPES.has(type) ? "ai" : "deterministic",
      evidence: null,
    })),
    checks: [],
  };
}
