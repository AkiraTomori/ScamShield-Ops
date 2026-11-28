import { createHash, randomBytes } from "node:crypto";
import type { LoginRequest } from "@scamshield/shared";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { staffSessions, staffUsers } from "../db/schema";
import { DUMMY_SECRET_HASH } from "../crypto/scrypt";
import type { Db } from "../rate-limit";
import { verifyPassword } from "./password";

/** Staff sign-in and server-side sessions (fraudops §3, DB-04). */

/** Fixed lifetime: using a session does not extend it. */
export const SESSION_TTL_MS = 12 * 3_600_000;
const TOKEN_BYTES = 32;
const CLEANUP_PROBABILITY = 1 / 50;

declare const verified: unique symbol;

/**
 * A signed-in staff member. Only `verifySession` makes one, and every FraudOps read or write takes it
 * as its first argument, so a forgotten check does not typecheck (fraudops §2).
 */
export interface StaffSession {
  readonly staffUserId: string;
  readonly username: string;
  readonly displayName: string;
  readonly [verified]: true;
}

export interface AuthDeps {
  db: Db;
  now: () => Date;
  /** Injectable for tests. */
  random?: () => number;
}

/** What the database holds: a copy of the table does not let anyone sign in. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * A new session for the right password; null for every other case. A missing or disabled account
 * still costs one scrypt run, so timing does not tell them from a wrong password.
 */
export async function login(
  req: LoginRequest,
  deps: AuthDeps,
): Promise<{ token: string; expiresAt: Date } | null> {
  const [user] = await deps.db
    .select({
      id: staffUsers.id,
      passwordHash: staffUsers.passwordHash,
      disabledAt: staffUsers.disabledAt,
    })
    .from(staffUsers)
    .where(eq(staffUsers.username, req.username));
  const active = user && !user.disabledAt ? user : undefined;
  const matches = await verifyPassword(req.password, active?.passwordHash ?? DUMMY_SECRET_HASH);
  if (!active || !matches) return null;

  const now = deps.now();
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await deps.db
    .insert(staffSessions)
    .values({ tokenHash: hashToken(token), staffUserId: active.id, expiresAt });

  if ((deps.random ?? Math.random)() < CLEANUP_PROBABILITY) {
    try {
      await deps.db.delete(staffSessions).where(lt(staffSessions.expiresAt, now));
    } catch {
      // Housekeeping only: a later sign-in cleans up.
    }
  }
  return { token, expiresAt };
}

/** Null for an unknown or expired token and for a disabled account. */
export async function verifySession(token: string, deps: AuthDeps): Promise<StaffSession | null> {
  if (!token) return null;
  const [row] = await deps.db
    .select({
      staffUserId: staffUsers.id,
      username: staffUsers.username,
      displayName: staffUsers.displayName,
    })
    .from(staffSessions)
    .innerJoin(staffUsers, eq(staffUsers.id, staffSessions.staffUserId))
    .where(
      and(
        eq(staffSessions.tokenHash, hashToken(token)),
        gt(staffSessions.expiresAt, deps.now()),
        isNull(staffUsers.disabledAt),
      ),
    );
  return row ? (row as StaffSession) : null;
}

export async function logout(token: string, deps: AuthDeps): Promise<void> {
  await deps.db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
}
