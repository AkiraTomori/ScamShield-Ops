import { LOGIN_PASSWORD_MAX_CHARS } from "@scamshield/shared";
import { sql } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { staffUsers } from "../db/schema";
import type { Db } from "../rate-limit";

/** The demo accounts judge1…judge5 (demo-data §3.4, Q-07). */

export const DEMO_STAFF_COUNT = 5;
export const DEMO_PASSWORD_MIN_CHARS = 12;

/** Its message names the rule that failed, never a password. */
export class DemoPasswordsError extends Error {}

/**
 * Creates the accounts, or rewrites their password hashes when they exist. Nothing is written unless
 * all five passwords are acceptable. A disabled account stays disabled.
 */
export async function upsertDemoStaff(passwords: string[], deps: { db: Db }): Promise<void> {
  if (passwords.length !== DEMO_STAFF_COUNT) {
    throw new DemoPasswordsError(`Expected exactly ${DEMO_STAFF_COUNT} passwords.`);
  }
  if (
    passwords.some((p) => p.length < DEMO_PASSWORD_MIN_CHARS || p.length > LOGIN_PASSWORD_MAX_CHARS)
  ) {
    throw new DemoPasswordsError(
      `Each password needs ${DEMO_PASSWORD_MIN_CHARS} to ${LOGIN_PASSWORD_MAX_CHARS} characters.`,
    );
  }

  const rows = await Promise.all(
    passwords.map(async (password, index) => ({
      username: `judge${index + 1}`,
      displayName: `Giám khảo ${index + 1}`,
      passwordHash: await hashPassword(password),
      isDemo: true,
    })),
  );
  // One statement, so the five accounts change together or not at all.
  await deps.db
    .insert(staffUsers)
    .values(rows)
    .onConflictDoUpdate({
      target: staffUsers.username,
      set: {
        displayName: sql`excluded.display_name`,
        passwordHash: sql`excluded.password_hash`,
        isDemo: sql`excluded.is_demo`,
      },
    });
}
