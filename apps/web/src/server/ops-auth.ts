import {
  consumeRateLimit,
  logEvent,
  login,
  LOGIN_LIMIT_PER_MINUTE,
  logout,
  rateLimitKey,
} from "@scamshield/core";
import {
  LoginRequest,
  parsePublicApiEnv,
  parseRuntimeDatabaseEnv,
  type PublicApiEnv,
  type RuntimeDatabaseEnv,
} from "@scamshield/shared";
import { getDeps } from "./deps";
import { clientIp, failure, RATE_LIMIT_TIMEOUT_MS, readJson, within } from "./http";
import { isSameOrigin } from "./ops-guards";
import {
  clearedSessionCookie,
  readSessionToken,
  requireStaffApi,
  sessionCookie,
  verifyWithDatabase,
  type VerifyToken,
} from "./ops-session";

// POST and DELETE /api/ops/session (api.md §4, fraudops §3). No password, token or cookie is logged.

/** The I/O the routes need, replaceable in tests. */
export interface LoginServices {
  consume: (key: string, now: Date) => Promise<{ allowed: boolean }>;
  login: (req: LoginRequest) => Promise<{ token: string; expiresAt: Date } | null>;
}

export interface LogoutServices {
  verify: VerifyToken;
  logout: (token: string) => Promise<void>;
}

export interface OpsContext<Services> {
  env?: Record<string, string | undefined>;
  services?: Services;
}

const authDeps = (env: RuntimeDatabaseEnv) => ({
  db: getDeps(env).database.db,
  now: () => new Date(),
});

function loginServices(env: PublicApiEnv): LoginServices {
  const deps = authDeps(env);
  return {
    consume: (key, now) => consumeRateLimit(key, { db: deps.db }, now, LOGIN_LIMIT_PER_MINUTE),
    login: (req) => login(req, deps),
  };
}

function logoutServices(env: RuntimeDatabaseEnv): LogoutServices {
  return {
    verify: verifyWithDatabase(env),
    logout: (token) => logout(token, authDeps(env)),
  };
}

function noContent(setCookie: string): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store", "Set-Cookie": setCookie },
  });
}

export async function handleLogin(
  request: Request,
  context: OpsContext<LoginServices> = {},
): Promise<Response> {
  let step = "config";
  try {
    // First of all, also for sign-in: no other site may sign a browser in (login CSRF).
    if (!isSameOrigin(request)) return failure("forbidden_origin");
    const env = parsePublicApiEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "ops_login_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? loginServices(env.data);

    step = "rate_limit";
    const key = rateLimitKey("login", clientIp(request), env.data.RATE_LIMIT_SALT);
    const { allowed } = await within(services.consume(key, new Date()), RATE_LIMIT_TIMEOUT_MS);
    if (!allowed) return failure("rate_limited");

    step = "input";
    const body = LoginRequest.safeParse(await readJson(request));
    if (!body.success) return failure("validation_failed");

    step = "login";
    const session = await services.login(body.data);
    if (!session) return failure("invalid_credentials");
    const maxAge = Math.round((session.expiresAt.getTime() - Date.now()) / 1000);
    return noContent(sessionCookie(session.token, maxAge));
  } catch {
    logEvent({ event: "ops_login_failed", code: step });
    return failure("internal");
  }
}

export async function handleLogout(
  request: Request,
  context: OpsContext<LogoutServices> = {},
): Promise<Response> {
  try {
    if (!isSameOrigin(request)) return failure("forbidden_origin");
    const env = parseRuntimeDatabaseEnv(context.env ?? process.env);
    if (!env.success) {
      logEvent({ event: "ops_logout_failed", code: "config_missing" });
      return failure("internal");
    }
    const services = context.services ?? logoutServices(env.data);
    const session = await requireStaffApi(request, services.verify);
    if (session instanceof Response) return session;
    await services.logout(readSessionToken(request));
    return noContent(clearedSessionCookie());
  } catch {
    logEvent({ event: "ops_logout_failed", code: "logout" });
    return failure("internal");
  }
}
