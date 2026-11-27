import { ApiError, ERROR_MESSAGE_VI } from "@scamshield/shared/errors";
import { ReportResponse, type ReportRequest } from "@scamshield/shared/report";
import { postJson, type PostOptions } from "../post-json";

export type ReportOutcome =
  | { kind: "created"; caseCode: string; secretCode: string }
  | { kind: "already_reported"; caseCode: string }
  /** The analysis no longer exists, for example after a demo reset. */
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "invalid"; message: string }
  | { kind: "failed" }
  | { kind: "aborted" };

/** Above the 8 s summary budget plus the database (report-flow §5.1). */
const CLIENT_TIMEOUT_MS = 20_000;

export function submitReport(
  analysisId: string,
  req: ReportRequest,
  options: PostOptions = {},
): Promise<ReportOutcome> {
  return postJson<ReportOutcome>(
    `/api/analyses/${encodeURIComponent(analysisId)}/report`,
    req,
    { ...options, timeoutMs: options.timeoutMs ?? CLIENT_TIMEOUT_MS },
    async (response) => {
      if (response.status === 404) return { kind: "not_found" };
      if (response.status === 429) return { kind: "rate_limited" };
      if (response.status === 400) {
        const body = ApiError.safeParse(await response.json().catch(() => null));
        return {
          kind: "invalid",
          message: body.success ? body.data.error.message : ERROR_MESSAGE_VI.validation_failed,
        };
      }
      if (response.status !== 200 && response.status !== 201) return { kind: "failed" };
      const parsed = ReportResponse.safeParse(await response.json());
      if (!parsed.success) return { kind: "failed" };
      const { caseCode, secretCode, alreadyReported } = parsed.data;
      if (alreadyReported) return { kind: "already_reported", caseCode };
      return secretCode ? { kind: "created", caseCode, secretCode } : { kind: "failed" };
    },
  );
}
