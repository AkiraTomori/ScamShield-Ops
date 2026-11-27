import { CaseStatusResponse, type CaseStatusRequest } from "@scamshield/shared/report";
import { postJson, type PostOptions } from "../post-json";

export type StatusOutcome =
  | { kind: "found"; result: CaseStatusResponse }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "failed" }
  | { kind: "aborted" };

/** Both codes go in the body, never in the URL. */
export function submitStatus(
  req: CaseStatusRequest,
  options: PostOptions = {},
): Promise<StatusOutcome> {
  return postJson<StatusOutcome>("/api/case-status", req, options, async (response) => {
    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status !== 200) return { kind: "failed" };
    const parsed = CaseStatusResponse.safeParse(await response.json());
    return parsed.success ? { kind: "found", result: parsed.data } : { kind: "failed" };
  });
}
