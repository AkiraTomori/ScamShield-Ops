import {
  consumeRateLimit,
  createReportDeps,
  logEvent,
  rateLimitKey,
  submitReport,
  type SubmitReportResult,
} from "@scamshield/core";
import {
  AnalysisId,
  parseAnalysisEnv,
  REPORT_ERROR_MESSAGE_VI,
  ReportRequest,
  ReportResponse,
  type AnalysisEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { clientIp, failure, json, RATE_LIMIT_TIMEOUT_MS, readJson, within } from "./http";

/** The I/O the route needs, replaceable in tests. */
export interface ReportServices {
  consume: (key: string, now: Date) => Promise<{ allowed: boolean }>;
  submit: (analysisId: string, req: ReportRequest) => Promise<SubmitReportResult>;
}

export interface ReportContext {
  env?: Record<string, string | undefined>;
  services?: ReportServices;
}

function realServices(env: AnalysisEnv): ReportServices {
  const base = getDeps(env);
  const deps = createReportDeps(env, base);
  return {
    consume: (key, now) => consumeRateLimit(key, { db: base.database.db }, now),
    submit: (analysisId, req) => submitReport(analysisId, req, deps),
  };
}

type BodyError = NonNullable<ReturnType<typeof ReportRequest.safeParse>["error"]>;

/** Field names with their wording; undefined when the request is malformed in another way. */
function fieldErrors(error: BodyError): Record<string, string> | undefined {
  const fields = Object.fromEntries(
    error.issues.flatMap((issue) => {
      const field = issue.path[0];
      return field === "channel" || field === "note"
        ? [[field, REPORT_ERROR_MESSAGE_VI[field]]]
        : [];
    }),
  );
  return Object.keys(fields).length > 0 ? fields : undefined;
}

/**
 * POST /api/analyses/{analysisId}/report (report-flow §2): rate limit, validate, report, answer.
 * Neither the note nor a caught error reaches a log line or an error body.
 */
export async function handleReport(
  request: Request,
  analysisId: string,
  context: ReportContext = {},
): Promise<Response> {
  let step = "config";
  try {
    const env = parseAnalysisEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "report_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? realServices(env.data);

    step = "rate_limit";
    const key = rateLimitKey("pub", clientIp(request), env.data.RATE_LIMIT_SALT);
    const { allowed } = await within(services.consume(key, new Date()), RATE_LIMIT_TIMEOUT_MS);
    if (!allowed) return failure("rate_limited");

    step = "input";
    const id = AnalysisId.safeParse(analysisId);
    const body = ReportRequest.safeParse(await readJson(request));
    if (!body.success) return failure("validation_failed", undefined, fieldErrors(body.error));
    if (!id.success) return failure("validation_failed");

    step = "report";
    const result = await services.submit(id.data, body.data);
    if (result.kind === "analysis_not_found") return failure("not_found");
    const created = result.kind === "created";
    return json(
      ReportResponse.parse({
        caseCode: result.caseCode,
        secretCode: created ? result.secretCode : null,
        alreadyReported: !created,
      }),
      created ? 201 : 200,
    );
  } catch {
    logEvent({ event: "report_failed", code: step });
    return failure("internal");
  }
}
