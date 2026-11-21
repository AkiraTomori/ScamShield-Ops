import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { InconclusiveReason, MatchableIndicatorType, RiskType, Verdict } from "@scamshield/shared";
import { allWithin, oneOf } from "./checks";

/**
 * One analysis that passed input validation. Immutable: no code path updates a row
 * (data-model §3). Holds only the REDACTED content; there is no column for the original text,
 * the IP, the user agent or any header.
 */
export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    redactedContent: text("redacted_content").notNull(),
    redactionCounts: jsonb("redaction_counts")
      .$type<{ otp: number; password: number; card: number }>()
      .notNull(),
    verdict: text("verdict").notNull(),
    rule: text("rule").notNull(),
    inconclusiveReason: text("inconclusive_reason"),
    riskTypes: text("risk_types")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    /** signals, indicators (with checks), explanation, recommendations. Parsed with zod on write AND read (DB-02). */
    details: jsonb("details").$type<unknown>().notNull(),
    promptVersion: text("prompt_version").notNull(),
    rulesVersion: text("rules_version").notNull(),
    modelSignals: text("model_signals"),
    modelExplain: text("model_explain"),
    /** Per-step latency, LLM call count, dropped_signals. For eval only; never returned by the API. */
    trace: jsonb("trace").$type<unknown>().notNull(),
    latencyMs: integer("latency_ms").notNull(),
    isSeed: boolean("is_seed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Input is at most 2,000 characters; the rest of the budget covers longer redaction labels.
    check("analyses_redacted_content_len", sql`char_length(${t.redactedContent}) <= 4000`),
    check("analyses_verdict_valid", oneOf(t.verdict, Verdict.options)),
    check(
      "analyses_inconclusive_reason_valid",
      sql`${t.inconclusiveReason} IS NULL OR ${oneOf(t.inconclusiveReason, InconclusiveReason.options)}`,
    ),
    // The reverse is not enforced: a reason may sit next to another verdict (high_risk, P-01).
    check(
      "analyses_inconclusive_has_reason",
      sql`${t.verdict} <> 'inconclusive' OR ${t.inconclusiveReason} IS NOT NULL`,
    ),
    check("analyses_risk_types_valid", allWithin(t.riskTypes, RiskType.options)),
    check("analyses_latency_ms_nonneg", sql`${t.latencyMs} >= 0`),
    index("analyses_created_at_idx").on(t.createdAt),
  ],
).enableRLS();

/**
 * Normalized domain/phone/bank-account indicators of an analysis, for related-case matching
 * (SO-07) and verified-indicator lookup (SO-08). Written in the same transaction as the analysis.
 */
export const analysisIndicators = pgTable(
  "analysis_indicators",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => analyses.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    normalized: text("normalized").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.analysisId, t.type, t.normalized] }),
    check("analysis_indicators_type_valid", oneOf(t.type, MatchableIndicatorType.options)),
    index("analysis_indicators_type_normalized_idx").on(t.type, t.normalized),
  ],
).enableRLS();
