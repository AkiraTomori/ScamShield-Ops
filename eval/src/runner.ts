import {
  extractSignals,
  withRateLimitRetry,
  writeExplanation,
  type ChatJsonResult,
  type LlmClient,
  type LlmDeps,
} from "@scamshield/core";
import type { EvalCase } from "./case";
import { labelExplanationInput } from "./explanation-input";
import type { RunRecord } from "./record";

/** Per-call budget for the spike; must outlast up to 3 rate-limit waits of 60 s each. */
const CALL_BUDGET_MS = 240_000;

export interface Task {
  model: string;
  case: EvalCase;
  run: number;
}

export interface ModelOptions {
  jsonMode?: boolean;
  reasoningFormat?: "hidden" | "parsed";
  reasoningEffort?: string;
}

export interface RunnerDeps {
  llm: LlmClient;
  now: () => Date;
  random: () => string;
  sleep?: (ms: number) => Promise<void>;
  modelOptions?: Record<string, ModelOptions>;
  /**
   * Earlier record for the same (model, case, run). Its signals result is reused instead of calling
   * the model again; used when only the explanation prompt changed.
   */
  reuse?: (task: Task) => RunRecord | undefined;
}

export const taskKey = (t: { model: string; caseId: string; run: number }) =>
  `${t.model}\u0000${t.caseId}\u0000${t.run}`;

export function buildTasks(
  models: readonly string[],
  cases: readonly EvalCase[],
  runs: number,
  done: ReadonlySet<string> = new Set(),
): Task[] {
  const tasks: Task[] = [];
  for (const model of models) {
    for (const c of cases) {
      for (let run = 1; run <= runs; run++) {
        if (!done.has(taskKey({ model, caseId: c.id, run }))) tasks.push({ model, case: c, run });
      }
    }
  }
  return tasks;
}

/** One (model, case, run): extract signals, then write an explanation from the case labels. */
export async function runTask(task: Task, deps: RunnerDeps): Promise<RunRecord> {
  const raw: RunRecord["raw"] = [];
  let step: "signals" | "explain" = "signals";
  let rateLimited = 0;

  // Records every provider result and waits out 429s; the pipeline functions stay unaware.
  const recording: LlmClient = {
    async chatJson(req) {
      const result: ChatJsonResult = await limited.chatJson(req);
      raw.push({ step, result });
      return result;
    },
  };
  const limited = withRateLimitRetry(deps.llm, {
    sleep: deps.sleep,
    onRateLimited: () => void (rateLimited += 1),
  });

  const llmDeps: LlmDeps = {
    llm: recording,
    model: task.model,
    now: deps.now,
    random: deps.random,
    ...deps.modelOptions?.[task.model],
  };

  const earlier = deps.reuse?.(task);
  let signals: RunRecord["signals"];
  if (earlier) {
    signals = earlier.signals;
    raw.push(...earlier.raw.filter((r) => r.step === "signals"));
    rateLimited = earlier.rateLimited;
  } else {
    signals = await extractSignals(task.case.content, llmDeps, {
      deadline: deps.now().getTime() + CALL_BUDGET_MS,
    });
  }
  step = "explain";
  const explanation = await writeExplanation(labelExplanationInput(task.case), llmDeps, {
    deadline: deps.now().getTime() + CALL_BUDGET_MS,
  });

  return {
    model: task.model,
    caseId: task.case.id,
    run: task.run,
    at: deps.now().toISOString(),
    signals,
    explanation,
    raw,
    rateLimited,
  };
}

/** Runs tasks with bounded concurrency; stops taking new tasks once `shouldStop()` is true. */
export async function runAll(
  tasks: readonly Task[],
  deps: RunnerDeps,
  opts: {
    concurrency: number;
    onRecord: (record: RunRecord) => void;
    shouldStop?: () => boolean;
  },
): Promise<number> {
  let next = 0;
  let completed = 0;
  const worker = async () => {
    for (;;) {
      if (opts.shouldStop?.()) return;
      const task = tasks[next++];
      if (!task) return;
      opts.onRecord(await runTask(task, deps));
      completed += 1;
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency) }, worker));
  return completed;
}
