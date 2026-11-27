import {
  analyzeMessage,
  consumeRateLimit,
  createAnalysisDeps,
  logEvent,
  rateLimitKey,
  saveAnalysis,
  type AnalysisOutcome,
} from "@scamshield/core";
import {
  AnalysisResult,
  CreateAnalysisRequest,
  INPUT_ERROR_MESSAGE_VI,
  normalizeInput,
  parseAnalysisEnv,
  type AnalysisEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { clientIp, failure, json, RATE_LIMIT_TIMEOUT_MS, readJson, within } from "./http";

/** The I/O the route needs, replaceable in tests. */
export interface AnalysisServices {
  consume: (key: string, now: Date) => Promise<{ allowed: boolean }>;
  analyze: (content: string, startedAt: number) => Promise<AnalysisOutcome>;
  save: (outcome: AnalysisOutcome) => Promise<void>;
}

export interface AnalysesContext {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  services?: AnalysisServices;
  rateLimitTimeoutMs?: number;
}

/** Budget of analysis-pipeline §2: twenty seconds for the whole request. */
const TOTAL_BUDGET_MS = 20_000;
const MIN_SAVE_MS = 1_000;

function realServices(env: AnalysisEnv): AnalysisServices {
  const base = getDeps(env);
  const deps = createAnalysisDeps(env, base);
  return {
    consume: (key, now) => consumeRateLimit(key, { db: base.database.db }, now),
    analyze: (content, startedAt) => analyzeMessage(content, deps, { startedAt }),
    save: (outcome) => saveAnalysis(outcome, { db: base.database.db }),
  };
}

/**
 * POST /api/analyses (api.md §3): rate limit, validate, analyse, store, answer. Nothing from a
 * caught error, and nothing the user typed, reaches a log line or an error body.
 */
export async function handleCreateAnalysis(
  request: Request,
  context: AnalysesContext = {},
): Promise<Response> {
  const now = context.now ?? (() => new Date());
  const startedAt = now().getTime();
  let step = "config";
  try {
    const env = parseAnalysisEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "analysis_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? realServices(env.data);

    step = "rate_limit";
    const key = rateLimitKey("pub", clientIp(request), env.data.RATE_LIMIT_SALT);
    const { allowed } = await within(
      services.consume(key, now()),
      context.rateLimitTimeoutMs ?? RATE_LIMIT_TIMEOUT_MS,
    );
    if (!allowed) return failure("rate_limited");

    step = "input";
    const parsed = CreateAnalysisRequest.safeParse(await readJson(request));
    if (!parsed.success) return failure("validation_failed");
    const input = normalizeInput(parsed.data.content);
    if (!input.ok) {
      return failure("validation_failed", INPUT_ERROR_MESSAGE_VI[input.code], {
        content: input.code,
      });
    }

    step = "analyze";
    const outcome = await services.analyze(input.text, startedAt);

    step = "save";
    const remaining = TOTAL_BUDGET_MS - (now().getTime() - startedAt);
    await within(services.save(outcome), Math.max(MIN_SAVE_MS, remaining));

    return json(AnalysisResult.parse(outcome.result), 200);
  } catch {
    logEvent({
      event: "analysis_failed",
      code: step,
      durationMs: now().getTime() - startedAt,
    });
    return failure("internal");
  }
}
