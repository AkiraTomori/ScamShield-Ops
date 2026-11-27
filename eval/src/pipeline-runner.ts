import { randomBytes, randomUUID } from "node:crypto";
import { analyzeMessage, type AnalysisDeps, type LlmClient } from "@scamshield/core";
import { BRANDS, URL_LISTS } from "@scamshield/shared";
import type { EvalCase } from "./case";
import type { PipelineRunRecord } from "./pipeline-record";

export interface EvalPipelineDepsOptions {
  llm: LlmClient;
  models: { signals: string; explain: string };
  reasoningEffort: string;
  now?: () => Date;
}

/**
 * Dependencies of `analyzeMessage` for eval (eval-suite §3.1): production model settings and data
 * files; no external lookup, no daily cap, nothing stored. No rate-limit retry either: production
 * does not retry a 429, so neither does the measurement.
 */
export function createEvalPipelineDeps(options: EvalPipelineDepsOptions): AnalysisDeps {
  return {
    llm: options.llm,
    models: options.models,
    llmOptions: { reasoningEffort: options.reasoningEffort },
    brands: BRANDS,
    urlLists: URL_LISTS,
    now: options.now ?? (() => new Date()),
    random: () => randomBytes(8).toString("hex"),
    newId: randomUUID,
    log: () => {},
  };
}

/** One case, one run, through the same function the API route calls. */
export async function runPipelineCase(
  c: EvalCase,
  run: number,
  deps: AnalysisDeps,
): Promise<PipelineRunRecord> {
  const providerFailures: string[] = [];
  const at = deps.now().toISOString();
  const { result, trace } = await analyzeMessage(c.content, {
    ...deps,
    log: (fields) => {
      if (fields.event === "llm_call_failed" && fields.code) providerFailures.push(fields.code);
    },
  });
  return {
    caseId: c.id,
    run,
    at,
    verdict: result.verdict,
    inconclusiveReason: result.inconclusiveReason,
    rule: result.rule,
    signals: result.signals.map((s) => s.type),
    explanation: result.explanation,
    explanationFailure: trace.explanationFailure,
    signalsFailure: trace.signalsFailure,
    signalAttempts: trace.signalAttempts,
    droppedSignals: trace.droppedSignals,
    llmCalls: trace.llmCalls,
    latencyMs: trace.steps.totalMs,
    providerFailures,
  };
}

export const runKey = (caseId: string, run: number) => `${caseId}#${run}`;

export interface RunPipelineOptions {
  gapMs: number;
  /** `runKey`s already recorded; used to continue an interrupted run. */
  done?: ReadonlySet<string>;
  sleep?: (ms: number) => Promise<void>;
  onRecord: (record: PipelineRunRecord) => void;
}

/** Sequential on purpose (eval-suite §3.2): every run counts, including the ones that fail. */
export async function runPipeline(
  cases: readonly EvalCase[],
  runs: number,
  deps: AnalysisDeps,
  options: RunPipelineOptions,
): Promise<void> {
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let ran = false;
  for (const c of cases) {
    for (let run = 1; run <= runs; run++) {
      if (options.done?.has(runKey(c.id, run))) continue;
      if (ran) await sleep(options.gapMs);
      options.onRecord(await runPipelineCase(c, run, deps));
      ran = true;
    }
  }
}
