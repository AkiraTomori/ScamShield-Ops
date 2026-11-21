import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-IP request counters in one-minute windows. `key` is a scope prefix (`pub:` or `login:`)
 * plus the HMAC-SHA256 hex of the IP; the raw IP is never stored (analysis-pipeline §3).
 * Incremented with one upsert; rows older than an hour are deleted opportunistically (data-model §2.7).
 */
export const rateLimitCounters = pgTable(
  "rate_limit_counters",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    check("rate_limit_counters_count_positive", sql`${t.count} >= 1`),
  ],
).enableRLS();

/**
 * LLM calls per Vietnam-local day (P-03). `day` is a plain date string chosen by the app, so it
 * cannot shift across time zones the way a JS Date would.
 */
export const llmDailyUsage = pgTable(
  "llm_daily_usage",
  {
    day: date("day", { mode: "string" }).primaryKey(),
    calls: integer("calls").notNull(),
  },
  (t) => [check("llm_daily_usage_calls_nonneg", sql`${t.calls} >= 0`)],
).enableRLS();
