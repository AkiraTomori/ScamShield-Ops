export interface PostOptions {
  /** Cancels the request: the outcome is then `aborted`. */
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * One POST to our own API with a client timeout, which also covers reading the body. `failed` is a
 * network error, the timeout, or a body `read` cannot make sense of.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  { signal, fetchImpl = fetch, timeoutMs = 20_000 }: PostOptions,
  read: (response: Response) => Promise<T>,
): Promise<T | { kind: "failed" } | { kind: "aborted" }> {
  const request = new AbortController();
  const cancel = () => request.abort();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    return await read(response);
  } catch {
    return { kind: signal?.aborted ? "aborted" : "failed" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
