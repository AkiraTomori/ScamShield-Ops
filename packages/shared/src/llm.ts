import { z } from "zod";
import { SignalType } from "./enums";

/**
 * Signals the LLM is allowed to report (contracts §3, analysis-pipeline §6.9). The deterministic
 * ones (domain checks, blocklist, verified indicators) never come from the model.
 */
export const AiSignalType = SignalType.extract([
  "claims_organization",
  "urgency",
  "threat",
  "credential_request",
  "payment_request",
  "reward_promise",
  "ai_directed_instruction",
]);
export type AiSignalType = z.infer<typeof AiSignalType>;

/**
 * What the model's JSON must look like on the wire. `type` is a plain string on purpose: an
 * unknown type is dropped by `extractSignals`, it does not invalidate the whole output (that would
 * force a retry and, at worst, `llm_invalid_output` over one stray label).
 */
export const LlmSignalRawOutput = z.object({
  signals: z.array(z.object({ type: z.string(), evidence: z.string() })),
  mentionedBrands: z.array(z.string()).default([]),
});
export type LlmSignalRawOutput = z.infer<typeof LlmSignalRawOutput>;

/** Contract shape after code has filtered it (contracts §7): only AI types, evidence verified. */
export const LlmSignalOutput = z.object({
  signals: z.array(z.object({ type: AiSignalType, evidence: z.string().min(1) })),
  mentionedBrands: z.array(z.string()),
});
export type LlmSignalOutput = z.infer<typeof LlmSignalOutput>;

/** Explanation step output (contracts §7). Length and content are enforced by code afterwards. */
export const LlmExplanationOutput = z.object({ explanation: z.string().min(1) });
export type LlmExplanationOutput = z.infer<typeof LlmExplanationOutput>;
