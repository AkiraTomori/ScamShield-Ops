import type { IndicatorRemovalRequest } from "@scamshield/shared/ops";
import { postJson, type PostOptions } from "../post-json";

export type RemovalOutcome =
  | { kind: "removed" }
  /** Someone else removed it first. */
  | { kind: "already" }
  | { kind: "invalid"; message?: string }
  | { kind: "signed_out" }
  | { kind: "not_found" }
  | { kind: "failed" }
  | { kind: "aborted" };

/** POST one removal. A timeout may follow a removal that happened; sending again gives `already`. */
export function submitRemoval(
  id: string,
  req: IndicatorRemovalRequest,
  options: PostOptions = {},
): Promise<RemovalOutcome> {
  const url = `/api/ops/confirmed-indicators/${encodeURIComponent(id)}/removal`;
  return postJson<RemovalOutcome>(url, req, options, async (response) => {
    if (response.status === 200) return { kind: "removed" };
    if (response.status === 409) return { kind: "already" };
    if (response.status === 401) return { kind: "signed_out" };
    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 400) {
      const body = (await response.json()) as { error?: { fields?: { reason?: string } } };
      return { kind: "invalid", message: body.error?.fields?.reason };
    }
    return { kind: "failed" };
  });
}
