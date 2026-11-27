import {
  ERROR_HTTP_STATUS,
  ERROR_MESSAGE_VI,
  type ApiError,
  type ErrorCode,
} from "@scamshield/shared";

// Shared by the public routes (api.md §1).

/** One second to count a request (analysis-pipeline §2). */
export const RATE_LIMIT_TIMEOUT_MS = 1_000;
/** 2,000 characters even as `\uXXXX` escapes fit well inside this. */
const MAX_BODY_BYTES = 64_000;

export function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function failure(
  code: ErrorCode,
  message?: string,
  fields?: Record<string, string>,
): Response {
  const body: ApiError = {
    error: { code, message: message ?? ERROR_MESSAGE_VI[code], ...(fields ? { fields } : {}) },
  };
  return json(body, ERROR_HTTP_STATUS[code]);
}

export function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The first hop of `x-forwarded-for`. Which header the platform guarantees is a deploy check
 * (analysis-pipeline §3); without one, as in local development, everyone shares one bucket.
 */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

/** The parsed JSON body; undefined when it is not JSON or larger than `MAX_BODY_BYTES`. */
export async function readJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode());
  } catch {
    return undefined;
  }
}
