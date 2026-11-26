import { AiSignalType, EVIDENCE_MAX_CHARS, LlmSignalRawOutput } from "@scamshield/shared";
import { clip } from "../text/clip";
import { normalizeText, parseModelJson } from "./json";
import { buildSignalsPrompt } from "./prompts/signals-v1";
import type { CallOptions, LlmDeps, TokenUsage } from "./types";

/** Minimum time left to afford the single retry (analysis-pipeline §6.8). */
export const RETRY_MIN_REMAINING_MS = 5_000;
/** Reasoning models spend part of this before answering; 600 cut qwen3.8-27b off on 7/60 calls. */
export const SIGNALS_MAX_TOKENS = 1200;
const MAX_BRANDS = 10;

export interface ExtractedSignal {
  type: AiSignalType;
  evidence: string;
}

export type ExtractSignalsResult =
  | {
      ok: true;
      signals: ExtractedSignal[];
      mentionedBrands: string[];
      attempts: 1 | 2;
      /** Signals with a known type whose evidence is not in the message (fabricated). */
      droppedSignals: number;
      /** Signals with a known type the model returned, before dropping and merging. */
      returnedSignals: number;
      latencyMs: number;
      usage: TokenUsage;
    }
  | {
      ok: false;
      reason: "llm_invalid_output" | "llm_unavailable" | "timeout";
      attempts: number;
      latencyMs: number;
      usage: TokenUsage;
    };

/**
 * LLM step 1 (SO-03-AC01, SO-01-AC05). Returns semantic signals only; never a verdict (P4).
 * Callers must pass content that has already been redacted, except for self-written eval data.
 */
export async function extractSignals(
  content: string,
  deps: LlmDeps,
  opts: CallOptions,
): Promise<ExtractSignalsResult> {
  let attempts = 0;
  let latencyMs = 0;
  const usage: TokenUsage = { input: 0, output: 0 };
  const fail = (reason: "llm_invalid_output" | "llm_unavailable" | "timeout") =>
    ({ ok: false, reason, attempts, latencyMs, usage }) as const;

  for (;;) {
    const remaining = opts.deadline - deps.now().getTime();
    if (remaining <= 0) return fail("timeout");

    const budget = Math.min(remaining, opts.attemptTimeoutMs?.[attempts] ?? remaining);
    attempts += 1;
    const prompt = buildSignalsPrompt(content, deps.random(), { retryNote: attempts === 2 });
    const result = await deps.llm.chatJson({
      model: deps.model,
      system: prompt.system,
      user: prompt.user,
      maxTokens: SIGNALS_MAX_TOKENS,
      signal: AbortSignal.timeout(budget),
      jsonMode: deps.jsonMode,
      reasoningFormat: deps.reasoningFormat,
      reasoningEffort: deps.reasoningEffort,
    });
    latencyMs += result.latencyMs;

    if (result.ok) {
      usage.input += result.usage.input;
      usage.output += result.usage.output;
      const parsed = parseModelJson(result.text, LlmSignalRawOutput);
      if (parsed) {
        const checked = verifySignals(parsed, prompt.sentContent);
        return {
          ok: true,
          ...checked,
          attempts: attempts === 1 ? 1 : 2,
          latencyMs,
          usage,
        };
      }
    } else if (result.kind === "timeout") {
      // A provider too slow for its own limit is unavailable; running out of the whole budget is not.
      return fail(budget < remaining ? "llm_unavailable" : "timeout");
    } else if (result.kind === "unavailable") {
      return fail("llm_unavailable");
    }
    // Bad JSON, wrong schema, or the provider rejected the JSON: one retry if time allows.
    if (attempts >= 2) return fail("llm_invalid_output");
    if (opts.deadline - deps.now().getTime() < RETRY_MIN_REMAINING_MS) return fail("timeout");
  }
}

function verifySignals(raw: LlmSignalRawOutput, sentContent: string) {
  const haystack = normalizeText(sentContent);
  const byType = new Map<AiSignalType, ExtractedSignal>();
  let dropped = 0;
  let returned = 0;

  for (const item of raw.signals) {
    const type = AiSignalType.safeParse(item.type);
    if (!type.success) continue; // unknown type: ignored, not counted as fabricated evidence
    returned += 1;
    const needle = normalizeText(item.evidence);
    if (needle === "" || !haystack.includes(needle)) {
      dropped += 1;
      continue;
    }
    if (!byType.has(type.data)) {
      byType.set(type.data, {
        type: type.data,
        evidence: clip(item.evidence.trim(), EVIDENCE_MAX_CHARS),
      });
    }
  }

  const brands = [...new Set(raw.mentionedBrands.map((b) => b.trim()).filter((b) => b !== ""))];
  return {
    signals: [...byType.values()],
    mentionedBrands: brands.slice(0, MAX_BRANDS),
    droppedSignals: dropped,
    returnedSignals: returned,
  };
}
