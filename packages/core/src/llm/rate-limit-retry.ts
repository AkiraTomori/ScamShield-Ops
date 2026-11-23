import type { LlmClient } from "./types";

export interface RateLimitRetryOptions {
  maxRetries?: number;
  /** Upper bound for a single wait, ms. */
  maxWaitMs?: number;
  fallbackWaitMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRateLimited?: () => void;
}

/**
 * Wraps a client so a 429 is retried after the provider's `retry-after`. For the eval runner only:
 * the real pipeline treats 429 as `llm_unavailable` and never retries (analysis-pipeline §6.8).
 */
export function withRateLimitRetry(client: LlmClient, opts: RateLimitRetryOptions = {}): LlmClient {
  const maxRetries = opts.maxRetries ?? 3;
  const maxWaitMs = opts.maxWaitMs ?? 60_000;
  const fallbackWaitMs = opts.fallbackWaitMs ?? 2_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  return {
    async chatJson(req) {
      let retries = 0;
      for (;;) {
        const result = await client.chatJson(req);
        if (result.ok || result.kind !== "unavailable" || result.status !== 429) return result;
        opts.onRateLimited?.();
        if (retries >= maxRetries || req.signal.aborted) return result;
        retries += 1;
        await sleep(Math.min(result.retryAfterMs ?? fallbackWaitMs, maxWaitMs));
      }
    },
  };
}
