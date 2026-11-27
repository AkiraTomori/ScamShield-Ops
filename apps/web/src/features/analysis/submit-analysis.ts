import { AnalysisResult } from "@scamshield/shared/analysis";
import { ApiError, ERROR_MESSAGE_VI } from "@scamshield/shared/errors";

export type AnalysisOutcome =
  | { kind: "ok"; result: AnalysisResult }
  | { kind: "invalid"; message: string }
  | { kind: "rate_limited" }
  /** Network, 5xx, client timeout or a response the schema rejects: no verdict is shown. */
  | { kind: "failed" }
  /** The caller cancelled; there is nothing to show. */
  | { kind: "aborted" };

/** Above the server's 20 s budget plus network latency (scamshield-ui §3.1). */
const CLIENT_TIMEOUT_MS = 25_000;

export interface SubmitOptions {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function submitAnalysis(
  content: string,
  { signal, fetchImpl = fetch, timeoutMs = CLIENT_TIMEOUT_MS }: SubmitOptions = {},
): Promise<AnalysisOutcome> {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetchImpl("/api/analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: request.signal,
    });
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status === 400) {
      const body = ApiError.safeParse(await response.json().catch(() => null));
      return {
        kind: "invalid",
        message: body.success ? body.data.error.message : ERROR_MESSAGE_VI.validation_failed,
      };
    }
    if (response.status !== 200) return { kind: "failed" };
    const result = AnalysisResult.safeParse(await response.json());
    return result.success ? { kind: "ok", result: result.data } : { kind: "failed" };
  } catch {
    return { kind: signal?.aborted ? "aborted" : "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
