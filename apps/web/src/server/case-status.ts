import { consumeRateLimit, logEvent, lookupPublicStatus, rateLimitKey } from "@scamshield/core";
import {
  CASE_NOT_FOUND_MESSAGE_VI,
  CaseStatusRequest,
  CaseStatusResponse,
  parsePublicApiEnv,
  type PublicApiEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { clientIp, failure, json, RATE_LIMIT_TIMEOUT_MS, readJson, within } from "./http";

/** The I/O the route needs, replaceable in tests. */
export interface CaseStatusServices {
  consume: (key: string, now: Date) => Promise<{ allowed: boolean }>;
  lookup: (req: CaseStatusRequest) => Promise<CaseStatusResponse | null>;
}

export interface CaseStatusContext {
  env?: Record<string, string | undefined>;
  services?: CaseStatusServices;
}

function realServices(env: PublicApiEnv): CaseStatusServices {
  const { db } = getDeps(env).database;
  return {
    consume: (key, now) => consumeRateLimit(key, { db }, now),
    lookup: (req) => lookupPublicStatus(req, { db }),
  };
}

/**
 * POST /api/case-status (report-flow §4.2). POST keeps the secret code off URLs, history and logs;
 * neither code ever reaches a log line.
 */
export async function handleCaseStatus(
  request: Request,
  context: CaseStatusContext = {},
): Promise<Response> {
  let step = "config";
  try {
    const env = parsePublicApiEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "case_status_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? realServices(env.data);

    step = "rate_limit";
    const key = rateLimitKey("pub", clientIp(request), env.data.RATE_LIMIT_SALT);
    const { allowed } = await within(services.consume(key, new Date()), RATE_LIMIT_TIMEOUT_MS);
    if (!allowed) return failure("rate_limited");

    step = "input";
    const body = CaseStatusRequest.safeParse(await readJson(request));
    if (!body.success) return failure("validation_failed");

    step = "lookup";
    const found = await services.lookup(body.data);
    if (!found) return failure("not_found", CASE_NOT_FOUND_MESSAGE_VI);
    return json(CaseStatusResponse.parse(found), 200);
  } catch {
    logEvent({ event: "case_status_failed", code: step });
    return failure("internal");
  }
}
