import { describe, expect, it, vi } from "vitest";
import { createHttpClient, HostNotAllowedError, HttpError } from "../../src/http";

function okFetch(body = "{}", init: ResponseInit = {}) {
  return vi.fn(async () => new Response(body, { status: 200, ...init })) as unknown as ReturnType<
    typeof vi.fn
  > &
    typeof fetch;
}
const base = { method: "GET" as const, timeoutMs: 1000 };

describe("http client", () => {
  it("blocks a host outside the allowlist before any request is sent", async () => {
    const fetchImpl = okFetch();
    const client = createHttpClient({ allowedHosts: ["api.groq.com"], fetchImpl });
    await expect(client.request("https://evil.example/x", base)).rejects.toBeInstanceOf(
      HostNotAllowedError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("matches host names exactly (no suffix or subdomain tricks), case-insensitively", async () => {
    const fetchImpl = okFetch();
    const client = createHttpClient({ allowedHosts: ["API.Groq.com"], fetchImpl });
    await expect(client.request("https://api.groq.com.evil.example/", base)).rejects.toThrow(
      HostNotAllowedError,
    );
    await expect(client.request("https://sub.api.groq.com/", base)).rejects.toThrow(
      HostNotAllowedError,
    );
    await expect(client.request("https://API.GROQ.com/ok", base)).resolves.toMatchObject({
      status: 200,
    });
  });

  it("blocks http: and URLs with credentials", async () => {
    const fetchImpl = okFetch();
    const client = createHttpClient({ allowedHosts: ["api.groq.com"], fetchImpl });
    await expect(client.request("http://api.groq.com/", base)).rejects.toMatchObject({
      kind: "insecure_url",
    });
    await expect(client.request("https://user:pw@api.groq.com/", base)).rejects.toMatchObject({
      kind: "invalid_url",
    });
    await expect(client.request("not a url", base)).rejects.toMatchObject({ kind: "invalid_url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never follows redirects", async () => {
    const fetchImpl = okFetch();
    const client = createHttpClient({ allowedHosts: ["api.groq.com"], fetchImpl });
    await client.request("https://api.groq.com/", base);
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });

  it("maps a refused redirect (fetch rejects) to a network error without leaking details", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("redirect mode is set to error: https://leak.example/?token=SECRET");
    });
    const client = createHttpClient({ allowedHosts: ["api.groq.com"], fetchImpl });
    const error = await client.request("https://api.groq.com/", base).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).kind).toBe("network");
    expect(String((error as HttpError).message)).not.toContain("SECRET");
  });

  it("times out", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("x", "AbortError")),
          );
        }),
    );
    const client = createHttpClient({
      allowedHosts: ["api.groq.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(
      client.request("https://api.groq.com/", { ...base, timeoutMs: 20 }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("reports a caller abort as 'aborted'", async () => {
    const fetchImpl = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("x", "AbortError")),
          );
        }),
    );
    const client = createHttpClient({
      allowedHosts: ["api.groq.com"],
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const controller = new AbortController();
    const pending = client.request("https://api.groq.com/", {
      ...base,
      timeoutMs: 5000,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });

  it("enforces maxBytes, by declared length and while streaming", async () => {
    const client = createHttpClient({
      allowedHosts: ["api.groq.com"],
      fetchImpl: okFetch("x".repeat(50)),
    });
    await expect(
      client.request("https://api.groq.com/", { ...base, maxBytes: 10 }),
    ).rejects.toMatchObject({ kind: "too_large" });

    const declared = createHttpClient({
      allowedHosts: ["api.groq.com"],
      fetchImpl: okFetch("x", { headers: { "content-length": "999999" } }),
    });
    await expect(
      declared.request("https://api.groq.com/", { ...base, maxBytes: 10 }),
    ).rejects.toMatchObject({ kind: "too_large" });
  });

  it("returns status, headers and text", async () => {
    const client = createHttpClient({
      allowedHosts: ["api.groq.com"],
      fetchImpl: okFetch('{"a":1}', { headers: { "x-test": "1" } }),
    });
    const res = await client.request("https://api.groq.com/", base);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-test")).toBe("1");
    expect(res.text).toBe('{"a":1}');
  });

  it("errors never contain the Authorization header or the request body", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("boom Bearer sk-secret-123 body=PRIVATE");
    });
    const client = createHttpClient({ allowedHosts: ["api.groq.com"], fetchImpl });
    const error = await client
      .request("https://api.groq.com/", {
        method: "POST",
        headers: { authorization: "Bearer sk-secret-123" },
        body: "PRIVATE",
        timeoutMs: 1000,
      })
      .catch((e: unknown) => e);
    const dump = JSON.stringify(error, Object.getOwnPropertyNames(error as object));
    expect(dump).not.toContain("sk-secret-123");
    expect(dump).not.toContain("PRIVATE");
  });
});
