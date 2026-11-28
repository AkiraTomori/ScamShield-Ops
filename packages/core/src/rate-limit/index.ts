import { createHmac } from "node:crypto";
import { and, lt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "../db/schema";
import { llmDailyUsage, rateLimitCounters } from "../db/schema";
import { logEvent } from "../log";

/** Per-IP request limits and the optional daily LLM cap (analysis-pipeline §3, data-model §2.7–2.8). */

export type Db = PostgresJsDatabase<typeof schema>;

/** Shared by /api/analyses, /report and /case-status (Q-06). */
export const PUBLIC_LIMIT_PER_MINUTE = 10;

/** Sign-in attempts have their own budget (OP-01). */
export const LOGIN_LIMIT_PER_MINUTE = 5;

const WINDOW_MS = 60_000;
const KEEP_MS = 3_600_000;
const CLEANUP_PROBABILITY = 1 / 50;
const VIETNAM_OFFSET_MS = 7 * 3_600_000;
const RESERVE_TIMEOUT_MS = 1_000;

/** The raw IP is never stored or logged, only this keyed hash. */
export function rateLimitKey(scope: "pub" | "login", ip: string, salt: string): string {
  return `${scope}:${createHmac("sha256", salt).update(ip).digest("hex")}`;
}

export interface RateLimitDeps {
  db: Db;
  /** Injectable for tests. */
  random?: () => number;
}

/** Counts this request in its one-minute window with one atomic upsert (SO-01-AC04). */
export async function consumeRateLimit(
  key: string,
  deps: RateLimitDeps,
  now: Date,
  limit: number = PUBLIC_LIMIT_PER_MINUTE,
): Promise<{ allowed: boolean }> {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const [row] = await deps.db
    .insert(rateLimitCounters)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitCounters.key, rateLimitCounters.windowStart],
      set: { count: sql`${rateLimitCounters.count} + 1` },
    })
    .returning({ count: rateLimitCounters.count });
  if (!row) throw new Error("rate limit upsert returned no row");

  if ((deps.random ?? Math.random)() < CLEANUP_PROBABILITY) {
    try {
      await deps.db
        .delete(rateLimitCounters)
        .where(lt(rateLimitCounters.windowStart, new Date(now.getTime() - KEEP_MS)));
    } catch {
      // Housekeeping only: a later request cleans up.
    }
  }
  return { allowed: row.count <= limit };
}

/** Takes one call from today's budget (Vietnam time); false once the cap is reached (P-03). */
export async function reserveLlmCall(db: Db, now: Date, cap: number): Promise<boolean> {
  const day = new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
  await db.insert(llmDailyUsage).values({ day, calls: 0 }).onConflictDoNothing();
  const rows = await db
    .update(llmDailyUsage)
    .set({ calls: sql`${llmDailyUsage.calls} + 1` })
    .where(and(sql`${llmDailyUsage.day} = ${day}`, lt(llmDailyUsage.calls, cap)))
    .returning({ calls: llmDailyUsage.calls });
  return rows.length > 0;
}

/**
 * Keeps the daily-cap query inside the analysis budget: a counter that is slow or broken means no
 * model call, the same outcome as a reached cap (P-03).
 */
export function boundedReserve(
  reserve: () => Promise<boolean>,
  timeoutMs: number = RESERVE_TIMEOUT_MS,
): () => Promise<boolean> {
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    });
    try {
      return await Promise.race([reserve(), timeout]);
    } catch {
      logEvent({ event: "llm_cap_unavailable" });
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
