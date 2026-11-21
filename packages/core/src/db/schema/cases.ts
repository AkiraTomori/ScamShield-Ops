import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { CaseStatus, Decision, ReportChannel, RiskType, Verdict } from "@scamshield/shared";
import { analyses } from "./analyses";
import { allWithin, oneOf } from "./checks";
import { staffUsers } from "./staff";

/**
 * Source of real case codes (DB-03): the first real case is SC-0101. Codes SC-0001…SC-0040 are
 * reserved for seed cases, which get their code from the seed command. MAXVALUE 9999 keeps the
 * 4-digit `lpad` below from silently truncating; at the limit `nextval` fails loudly instead.
 */
export const caseCodeSeq = pgSequence("case_code_seq", { startWith: 101, maxValue: 9999 });

/** A user's report of an analysis, which is also the FraudOps case (DB-01: one table). */
export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code")
      .notNull()
      .unique()
      .default(sql`'SC-' || lpad(nextval('case_code_seq')::text, 4, '0')`),
    /** UNIQUE: an analysis has at most one case (SO-04-AC03). RESTRICT: an analysis with a case cannot be deleted. */
    analysisId: uuid("analysis_id")
      .notNull()
      .unique()
      .references(() => analyses.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("pending_review"),
    channel: text("channel").notNull(),
    reporterNote: text("reporter_note"),
    /** scrypt hash of the secret code. The code itself is never stored. */
    secretHash: text("secret_hash").notNull(),
    /** Snapshot of the analysis verdict at report time, so filtering needs no join. Analyses are immutable. */
    engineVerdict: text("engine_verdict").notNull(),
    riskTypes: text("risk_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** `{ summary, nextSteps }`; null when the LLM failed at report time (A-02). */
    aiSummary: jsonb("ai_summary").$type<unknown>(),
    summaryPromptVersion: text("summary_prompt_version"),
    isSeed: boolean("is_seed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    check("cases_code_valid", sql`${t.code} ~ '^SC-[0-9]{4,}$'`),
    check("cases_status_valid", oneOf(t.status, CaseStatus.options)),
    check("cases_channel_valid", oneOf(t.channel, ReportChannel.options)),
    check(
      "cases_reporter_note_len",
      sql`${t.reporterNote} IS NULL OR char_length(${t.reporterNote}) <= 500`,
    ),
    check("cases_engine_verdict_valid", oneOf(t.engineVerdict, Verdict.options)),
    check("cases_risk_types_valid", allWithin(t.riskTypes, RiskType.options)),
    // A case is closed exactly when it has a closing time.
    check(
      "cases_closed_at_matches_status",
      sql`(${t.status} = 'closed') = (${t.closedAt} IS NOT NULL)`,
    ),
    index("cases_status_created_at_idx").on(t.status, t.createdAt.desc()),
    index("cases_engine_verdict_created_at_idx").on(t.engineVerdict, t.createdAt.desc()),
  ],
).enableRLS();

/** A staff member's conclusion. One per case (the PK), immutable. */
export const decisions = pgTable(
  "decisions",
  {
    caseId: uuid("case_id")
      .primaryKey()
      .references(() => cases.id, { onDelete: "cascade" }),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    decidedBy: uuid("decided_by")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "restrict" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    /** Snapshot at decision time. */
    engineVerdict: text("engine_verdict").notNull(),
    /** Computed in code from the SO-06-AC04 agreement table; stored so eval can read it back. */
    disagreesWithEngine: boolean("disagrees_with_engine").notNull(),
  },
  (t) => [
    check("decisions_decision_valid", oneOf(t.decision, Decision.options)),
    check("decisions_reason_len", sql`char_length(${t.reason}) BETWEEN 10 AND 500`),
    check("decisions_engine_verdict_valid", oneOf(t.engineVerdict, Verdict.options)),
  ],
).enableRLS();
