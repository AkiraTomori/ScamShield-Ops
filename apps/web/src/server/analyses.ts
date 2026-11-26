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
  ERROR_HTTP_STATUS,
  ERROR_MESSAGE_VI,
  INPUT_ERROR_MESSAGE_VI,
  normalizeInput,
  parseAnalysisEnv,
  type AnalysisEnv,
  type ApiError,
  type ErrorCode,
} from "@scamshield/shared";
import { getDeps } from "./deps";

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

/** Budget of analysis-pipeline §2: one second to count, twenty for the whole request. */
const RATE_LIMIT_TIMEOUT_MS = 1_000;
const TOTAL_BUDGET_MS = 20_000;
const MIN_SAVE_MS = 1_000;
/** 2,000 characters even as `\uXXXX` escapes fit well inside this. */
const MAX_BODY_BYTES = 64_000;

function realServices(env: AnalysisEnv): AnalysisServices {
  const base = getDeps(env);
  const deps = createAnalysisDeps(env, base);
  return {
    consume: (key, now) => consumeRateLimit(key, { db: base.database.db }, now),
    analyze: (content, startedAt) => analyzeMessage(content, deps, { startedAt }),
    save: (outcome) => saveAnalysis(outcome, { db: base.database.db }),
  };
}

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function failure(code: ErrorCode, message?: string, fields?: Record<string, string>): Response {
  const body: ApiError = {
    error: { code, message: message ?? ERROR_MESSAGE_VI[code], ...(fields ? { fields } : {}) },
  };
  return json(body, ERROR_HTTP_STATUS[code]);
}

function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The first hop of `x-forwarded-for`. Which header the platform guarantees is a deploy check
 * (analysis-pipeline §3); without one, as in local development, everyone shares one bucket.
 */
function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

/** Reads at most `MAX_BODY_BYTES`; null when larger. */
async function readBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
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
    const raw = await readBody(request);
    const parsed = raw === null ? null : CreateAnalysisRequest.safeParse(safeJson(raw));
    if (!parsed?.success) return failure("validation_failed");
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

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
