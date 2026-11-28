import type { LoginRequest } from "@scamshield/shared/ops";
import { postJson, type PostOptions } from "../post-json";

export type LoginOutcome =
  | { kind: "signed_in" }
  | { kind: "invalid_credentials" }
  | { kind: "rate_limited" }
  | { kind: "failed" }
  | { kind: "aborted" };

/** POST /api/ops/session. The session itself arrives as an HttpOnly cookie. */
export function submitLogin(req: LoginRequest, options: PostOptions = {}): Promise<LoginOutcome> {
  return postJson<LoginOutcome>("/api/ops/session", req, options, async (response) => {
    if (response.status === 204) return { kind: "signed_in" };
    if (response.status === 401) return { kind: "invalid_credentials" };
    if (response.status === 429) return { kind: "rate_limited" };
    return { kind: "failed" };
  });
}

/** DELETE /api/ops/session. A 401 means the session is already gone, which is what was asked. */
export async function submitLogout(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetchImpl("/api/ops/session", {
      method: "DELETE",
      signal: AbortSignal.timeout(20_000),
    });
    return response.status === 204 || response.status === 401;
  } catch {
    return false;
  }
}
