import { checkHealth } from "@scamshield/core";
import { HealthResponse, parseRuntimeDatabaseEnv } from "@scamshield/shared";
import { getDeps } from "./deps";

export interface HealthContext {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  timeoutMs?: number;
}

/** "local" outside Vercel; the short commit SHA on Vercel. */
export function resolveVersion(env: Record<string, string | undefined>): string {
  const sha = env.VERCEL_GIT_COMMIT_SHA;
  return sha ? sha.slice(0, 7) : "local";
}

/**
 * Bridge for GET /api/health: parse only DATABASE_URL, run the check, map to HTTP (system-design §5).
 * Nothing from a caught error reaches the response body.
 */
export async function handleHealth(context: HealthContext = {}): Promise<Response> {
  const env = context.env ?? process.env;
  const parsed = parseRuntimeDatabaseEnv(env);
  const ping = parsed.success ? getDeps(parsed.data).database.ping : null;

  const { body, failure } = await checkHealth({
    ping,
    version: resolveVersion(env),
    now: context.now ?? (() => new Date()),
    timeoutMs: context.timeoutMs,
  });

  return Response.json(HealthResponse.parse(body), {
    status: failure === null ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
