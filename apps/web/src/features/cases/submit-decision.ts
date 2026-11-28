import type { DecisionRequest } from "@scamshield/shared/ops";
import { postJson, type PostOptions } from "../post-json";

export type DecisionOutcome =
  | { kind: "saved" }
  | { kind: "invalid"; fields: { decision?: string; reason?: string } }
  | { kind: "taken" }
  | { kind: "signed_out" }
  | { kind: "not_found" }
  | { kind: "failed" }
  | { kind: "aborted" };

/** POST the decision of one case. A timeout may follow a saved decision; sending again gives `taken`. */
export function submitDecision(
  caseCode: string,
  req: DecisionRequest,
  options: PostOptions = {},
): Promise<DecisionOutcome> {
  const url = `/api/ops/cases/${encodeURIComponent(caseCode)}/decision`;
  return postJson<DecisionOutcome>(url, req, options, async (response) => {
    if (response.status === 200) return { kind: "saved" };
    if (response.status === 409) return { kind: "taken" };
    if (response.status === 401) return { kind: "signed_out" };
    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 400) {
      const body = (await response.json()) as { error?: { fields?: Record<string, string> } };
      return { kind: "invalid", fields: body.error?.fields ?? {} };
    }
    return { kind: "failed" };
  });
}
