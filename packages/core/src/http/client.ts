/**
 * The ONLY place in packages/core allowed to call `fetch` (P5, conventions/backend §5; enforced by
 * ESLint). Every outbound request is checked against an allowlist of exact hostnames BEFORE it is
 * sent. User-supplied URLs are never passed here.
 *
 * Errors carry a fixed `kind` and the hostname only: never headers (Authorization) or bodies.
 */

export type HttpErrorKind =
  | "host_not_allowed"
  | "insecure_url"
  | "invalid_url"
  | "timeout"
  | "aborted"
  | "network"
  | "too_large";

export class HttpError extends Error {
  readonly kind: HttpErrorKind;
  constructor(kind: HttpErrorKind, message: string) {
    super(message);
    this.name = "HttpError";
    this.kind = kind;
  }
}

export class HostNotAllowedError extends HttpError {
  readonly host: string;
  constructor(host: string) {
    super("host_not_allowed", `Outbound HTTP to host "${host}" is not on the allowlist`);
    this.name = "HostNotAllowedError";
    this.host = host;
  }
}

export interface HttpRequestInit {
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  /** Maximum response size in bytes. Default 1 MB. */
  maxBytes?: number;
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  text: string;
}

export interface HttpClient {
  request(url: string, init: HttpRequestInit): Promise<HttpResponse>;
}

export interface HttpClientOptions {
  allowedHosts: readonly string[];
  /** Injectable for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export const DEFAULT_MAX_BYTES = 1_000_000;

export function createHttpClient(opts: HttpClientOptions): HttpClient {
  const allowed = new Set(opts.allowedHosts.map((host) => host.toLowerCase()));
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async request(url, init) {
      const target = checkTarget(url, allowed);
      const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;

      const timeoutSignal = AbortSignal.timeout(init.timeoutMs);
      const signal = init.signal ? AbortSignal.any([timeoutSignal, init.signal]) : timeoutSignal;

      try {
        const response = await doFetch(target, {
          method: init.method,
          headers: init.headers,
          body: init.body,
          redirect: "error",
          signal,
        });
        const text = await readLimited(response, maxBytes);
        return { status: response.status, headers: response.headers, text };
      } catch (error) {
        throw classify(error, timeoutSignal, init.signal);
      }
    },
  };
}

function checkTarget(url: string, allowed: ReadonlySet<string>): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpError("invalid_url", "Outbound URL is not valid");
  }
  const host = parsed.hostname.toLowerCase();
  if (!allowed.has(host)) throw new HostNotAllowedError(host);
  if (parsed.protocol !== "https:") {
    throw new HttpError("insecure_url", "Outbound HTTP must use https");
  }
  if (parsed.username !== "" || parsed.password !== "") {
    throw new HttpError("invalid_url", "Outbound URL must not carry credentials");
  }
  return parsed;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel();
    throw new HttpError("too_large", "Response exceeds the size limit");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError("too_large", "Response exceeds the size limit");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function classify(
  error: unknown,
  timeoutSignal: AbortSignal,
  callerSignal: AbortSignal | undefined,
): HttpError {
  if (error instanceof HttpError) return error;
  if (timeoutSignal.aborted) return new HttpError("timeout", "Request timed out");
  if (callerSignal?.aborted) return new HttpError("aborted", "Request was aborted by the caller");
  // Deliberately drops the original error: its message/cause could echo request details.
  return new HttpError("network", "Request failed at the network level");
}
