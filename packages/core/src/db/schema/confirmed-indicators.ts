import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { MatchableIndicatorType } from "@scamshield/shared";
import { cases } from "./cases";
import { oneOf } from "./checks";
import { staffUsers } from "./staff";

/**
 * Indicators a staff decision confirmed as scam (SO-08, verified-indicators §4). Removal is a soft
 * delete that keeps who removed it, why and when; the same indicator can be confirmed again later.
 */
export const confirmedIndicators = pgTable(
  "confirmed_indicators",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    normalized: text("normalized").notNull(),
    /** RESTRICT: a case that added an indicator cannot be deleted while the row is there. */
    sourceCaseId: uuid("source_case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    confirmedBy: uuid("confirmed_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: uuid("removed_by").references(() => staffUsers.id, { onDelete: "restrict" }),
    removalReason: text("removal_reason"),
  },
  (t) => [
    check("confirmed_indicators_type_valid", oneOf(t.type, MatchableIndicatorType.options)),
    check(
      "confirmed_indicators_removal_complete",
      sql`(${t.removedAt} IS NULL) = (${t.removedBy} IS NULL) AND (${t.removedAt} IS NULL) = (${t.removalReason} IS NULL)`,
    ),
    check(
      "confirmed_indicators_removal_reason_len",
      sql`${t.removalReason} IS NULL OR char_length(${t.removalReason}) BETWEEN 10 AND 500`,
    ),
    // One active row per indicator; also serves the engine's lookup (T-080).
    uniqueIndex("confirmed_indicators_active_idx")
      .on(t.type, t.normalized)
      .where(sql`${t.removedAt} IS NULL`),
  ],
).enableRLS();
