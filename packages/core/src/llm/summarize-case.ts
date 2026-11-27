import {
  CASE_SUMMARY_MAX_CHARS,
  CASE_SUMMARY_STEP_MAX_CHARS,
  LlmCaseSummaryOutput,
} from "@scamshield/shared";
import { parseModelJson } from "./json";
import {
  labelsPerson,
  proposesForbiddenAction,
  rejectModelText,
  type CaseSummaryRejection,
} from "./output-filters";
import {
  buildCaseSummaryPrompt,
  PROMPT_VERSION,
  type CaseSummaryInput,
} from "./prompts/case-summary-v1";
import type { CallOptions, LlmDeps, TokenUsage } from "./types";

/** Reasoning models spend part of this before answering (see SIGNALS_MAX_TOKENS). */
export const CASE_SUMMARY_MAX_TOKENS = 1500;
/** Minimum time left to afford the single retry (report-flow §3.2). */
export const CASE_SUMMARY_RETRY_MIN_REMAINING_MS = 3_000;

export type SummarizeCaseFailure =
  "llm_unavailable" | "timeout" | "llm_invalid_output" | "error" | CaseSummaryRejection;

export type SummarizeCaseResult =
  | ({
      ok: true;
      promptVersion: string;
      latencyMs: number;
      usage: TokenUsage;
    } & LlmCaseSummaryOutput)
  | { ok: false; reason: SummarizeCaseFailure; latencyMs: number; usage: TokenUsage };

/**
 * The AI summary of a case (SO-05-AC02). Never throws: a case is created whether or not this works
 * (contracts A-02). `content` and `note` must already be redacted.
 */
export async function summarizeCase(
  input: CaseSummaryInput,
  deps: LlmDeps,
  opts: CallOptions,
): Promise<SummarizeCaseResult> {
  let latencyMs = 0;
  const usage: TokenUsage = { input: 0, output: 0 };
  const fail = (reason: SummarizeCaseFailure) => ({ ok: false, reason, latencyMs, usage }) as const;

  try {
    for (let attempt = 1; ; attempt++) {
      const remaining = opts.deadline - deps.now().getTime();
      if (remaining <= 0) return fail("timeout");

      const prompt = buildCaseSummaryPrompt(input, deps.random());
      const result = await deps.llm.chatJson({
        model: deps.model,
        system: prompt.system,
        user: prompt.user,
        maxTokens: CASE_SUMMARY_MAX_TOKENS,
        signal: AbortSignal.timeout(remaining),
        jsonMode: deps.jsonMode,
        reasoningFormat: deps.reasoningFormat,
        reasoningEffort: deps.reasoningEffort,
      });
      latencyMs += result.latencyMs;

      if (result.ok) {
        usage.input += result.usage.input;
        usage.output += result.usage.output;
        const parsed = parseModelJson(result.text, LlmCaseSummaryOutput);
        const output = parsed && cleaned(parsed);
        if (output) {
          const rejection = filterCaseSummary(output, prompt.sentData);
          if (rejection) return fail(rejection);
          return { ok: true, ...output, promptVersion: PROMPT_VERSION, latencyMs, usage };
        }
      } else if (result.kind === "timeout") {
        return fail("timeout");
      } else if (result.kind === "unavailable") {
        return fail("llm_unavailable");
      }
      // Bad JSON, wrong schema, or the provider rejected the JSON: one retry if time allows.
      if (attempt >= 2) return fail("llm_invalid_output");
      if (opts.deadline - deps.now().getTime() < CASE_SUMMARY_RETRY_MIN_REMAINING_MS) {
        return fail("timeout");
      }
    }
  } catch {
    return fail("error");
  }
}

/** JSON escapes can smuggle NUL or half a surrogate pair, which the database rejects. */
function cleaned(output: LlmCaseSummaryOutput): LlmCaseSummaryOutput | undefined {
  const clean = (text: string) => text.replace(/[\0\p{Cs}]/gu, "").trim();
  const parsed = LlmCaseSummaryOutput.safeParse({
    summary: clean(output.summary),
    nextSteps: output.nextSteps.map(clean),
  });
  return parsed.success ? parsed.data : undefined;
}

/** Output filter of report-flow §3.2 with RP-04. Returns why the summary must be dropped. */
export function filterCaseSummary(
  output: LlmCaseSummaryOutput,
  sentData: string,
): CaseSummaryRejection | undefined {
  const texts = [
    { text: output.summary, max: CASE_SUMMARY_MAX_CHARS },
    ...output.nextSteps.map((text) => ({ text, max: CASE_SUMMARY_STEP_MAX_CHARS })),
  ];
  for (const { text, max } of texts) {
    const rejection = rejectModelText(text, sentData, max);
    if (rejection) return rejection;
    if (labelsPerson(text)) return "labels_person";
  }
  return output.nextSteps.some(proposesForbiddenAction) ? "forbidden_action" : undefined;
}
