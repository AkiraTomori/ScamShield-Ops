import { EXPLANATION_MAX_CHARS, LlmExplanationOutput } from "@scamshield/shared";
import { parseModelJson } from "./json";
import { rejectModelText, type TextRejection } from "./output-filters";
import { buildExplanationPrompt, type ExplanationInput } from "./prompts/explain-v3";
import type { CallOptions, LlmDeps, TokenUsage } from "./types";

export { EXPLANATION_MAX_CHARS };
export const EXPLANATION_MAX_TOKENS = 600;

export type ExplanationRejection = TextRejection;

export type WriteExplanationResult =
  | { ok: true; explanation: string; latencyMs: number; usage: TokenUsage }
  | {
      ok: false;
      reason: "llm_unavailable" | "timeout" | "llm_invalid_output" | ExplanationRejection;
      latencyMs: number;
      usage: TokenUsage;
    };

/**
 * LLM step 2 (SO-03-AC05). Receives verdict, rule, signals and checks, never the message itself.
 * A failed output filter yields `ok: false` (the caller stores `explanation = null`); no retry.
 */
export async function writeExplanation(
  input: ExplanationInput,
  deps: LlmDeps,
  opts: CallOptions,
): Promise<WriteExplanationResult> {
  const usage: TokenUsage = { input: 0, output: 0 };
  const remaining = opts.deadline - deps.now().getTime();
  if (remaining <= 0) return { ok: false, reason: "timeout", latencyMs: 0, usage };

  const prompt = buildExplanationPrompt(input, deps.random());
  const result = await deps.llm.chatJson({
    model: deps.model,
    system: prompt.system,
    user: prompt.user,
    maxTokens: EXPLANATION_MAX_TOKENS,
    signal: AbortSignal.timeout(remaining),
    jsonMode: deps.jsonMode,
    reasoningFormat: deps.reasoningFormat,
    reasoningEffort: deps.reasoningEffort,
  });

  if (!result.ok) {
    const reason =
      result.kind === "timeout"
        ? "timeout"
        : result.kind === "unavailable"
          ? "llm_unavailable"
          : "llm_invalid_output";
    return { ok: false, reason, latencyMs: result.latencyMs, usage };
  }
  usage.input = result.usage.input;
  usage.output = result.usage.output;

  const parsed = parseModelJson(result.text, LlmExplanationOutput);
  if (!parsed)
    return { ok: false, reason: "llm_invalid_output", latencyMs: result.latencyMs, usage };

  // JSON escapes can smuggle NUL or half a surrogate pair, which the database rejects.
  const explanation = parsed.explanation.replace(/[\u0000\p{Cs}]/gu, "").trim();
  const rejection = filterExplanation(explanation, prompt.sentData);
  if (rejection) return { ok: false, reason: rejection, latencyMs: result.latencyMs, usage };
  return { ok: true, explanation, latencyMs: result.latencyMs, usage };
}

/** Output filter of analysis-pipeline §9. Returns why the text must be dropped, or undefined. */
export function filterExplanation(
  text: string,
  sentData: string,
): ExplanationRejection | undefined {
  return rejectModelText(text, sentData, EXPLANATION_MAX_CHARS);
}
