// Pure checks of the FraudOps entry points (fraudops §2, §3).

export const OPS_HOME = "/ops";
export const OPS_LOGIN_PATH = "/ops/dang-nhap";

const BASE = "http://app.invalid";

/** Where to go after signing in: a path under /ops, never another site (open redirect). */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.includes("\\") || !/^\/ops(?=$|[/?])/.test(value)) {
    return OPS_HOME;
  }
  const url = new URL(value, BASE);
  // Checked again after parsing, which resolves `..` segments.
  if (url.origin !== BASE || !/^\/ops(?=$|\/)/.test(url.pathname)) return OPS_HOME;
  return url.pathname === OPS_LOGIN_PATH ? OPS_HOME : url.pathname + url.search;
}

/**
 * CSRF check of every FraudOps write: the browser's `Origin` must be this app's own origin, taken as
 * scheme plus the `Host` the request arrived for. Not `request.url`: under `next start` it carries
 * the address the server listens on, whatever host the browser called (checked 28/11, fraudops §11).
 * A page on another site can set neither header. Behind the platform proxy this is a deploy check.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const url = new URL(request.url);
  const host = request.headers.get("host") ?? url.host;
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  try {
    return origin === new URL(`${forwarded || url.protocol.slice(0, -1)}://${host}`).origin;
  } catch {
    return false;
  }
}
