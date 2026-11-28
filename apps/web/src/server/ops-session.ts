// Server only. The session is checked next to the data, in every page and route, never in a layout
// or proxy (fraudops §2).
import { verifySession, type StaffSession } from "@scamshield/core";
import { parseRuntimeDatabaseEnv } from "@scamshield/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDeps } from "./deps";
import { failure } from "./http";
import { OPS_LOGIN_PATH, safeNextPath } from "./ops-guards";

export const SESSION_COOKIE = "ops_session";

function cookie(value: string, maxAge: number): string {
  // OP-02: Secure everywhere except `next dev` on http://localhost.
  const secure = process.env.NODE_ENV === "development" ? "" : "; Secure";
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

export function sessionCookie(token: string, maxAgeSeconds: number): string {
  return cookie(token, maxAgeSeconds);
}

export function clearedSessionCookie(): string {
  return cookie("", 0);
}

/** The token from the `Cookie` header; empty when there is none. */
export function readSessionToken(request: Request): string {
  for (const part of request.headers.get("cookie")?.split(";") ?? []) {
    const [name, ...value] = part.split("=");
    if (name?.trim() === SESSION_COOKIE) return value.join("=").trim();
  }
  return "";
}

export type VerifyToken = (token: string) => Promise<StaffSession | null>;

export function verifyWithDatabase(env: { DATABASE_URL: string }): VerifyToken {
  return (token) => verifySession(token, { db: getDeps(env).database.db, now: () => new Date() });
}

/** For every `/api/ops/*` route but sign-in: the session, or the 401 to send (SO-06-AC01). */
export async function requireStaffApi(
  request: Request,
  verify: VerifyToken,
): Promise<StaffSession | Response> {
  const token = readSessionToken(request);
  const session = token ? await verify(token) : null;
  return session ?? failure("unauthorized");
}

/** The signed-in staff member of this page request, if any. One lookup per request. */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const env = parseRuntimeDatabaseEnv(process.env);
  if (!env.success) throw new Error("config_missing");
  return verifyWithDatabase(env.data)(token);
});

/** For every page under `/ops`: without a session, to sign-in and back afterwards (SO-06-AC01). */
export async function requireStaffPage(nextPath: string): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session) {
    redirect(`${OPS_LOGIN_PATH}?next=${encodeURIComponent(safeNextPath(nextPath))}`);
  }
  return session;
}
