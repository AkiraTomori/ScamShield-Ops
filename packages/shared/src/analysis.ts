import { z } from "zod";
import {
  CheckStatus,
  CheckType,
  IndicatorType,
  InconclusiveReason,
  RiskType,
  SignalSource,
  SignalType,
  Verdict,
} from "./enums";

// Shapes of POST /api/analyses (architecture/contracts §2–§5). There is deliberately no score or
// probability field (SO-03-AC04).

export const EVIDENCE_MAX_CHARS = 200;
export const EXPLANATION_MAX_CHARS = 800;

/** Verdict rule codes of rules-v1 (analysis-pipeline §7). */
export const RuleCode = z.enum(["R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"]);
export type RuleCode = z.infer<typeof RuleCode>;

export const Check = z.object({
  type: CheckType,
  status: CheckStatus,
  /** Short code the UI translates, e.g. `nearest:<domain>:distance_1`. Never third-party free text. */
  detail: z.string().nullable(),
});
export type Check = z.infer<typeof Check>;

export const Indicator = z.object({
  type: IndicatorType,
  /** As it appears in the redacted content. */
  value: z.string(),
  /** Matching form (SO-07-AC02). */
  normalized: z.string(),
  checks: z.array(Check),
});
export type Indicator = z.infer<typeof Indicator>;

export const Signal = z.object({
  type: SignalType,
  source: SignalSource,
  evidence: z.string().max(EVIDENCE_MAX_CHARS).nullable(),
  /** `normalized` of the indicator behind a deterministic signal. */
  indicator: z.string().nullable(),
});
export type Signal = z.infer<typeof Signal>;

export const RedactionCounts = z.object({
  otp: z.number().int().nonnegative(),
  password: z.number().int().nonnegative(),
  card: z.number().int().nonnegative(),
});
export type RedactionCounts = z.infer<typeof RedactionCounts>;

/** The part of a result stored in `analyses.details` (data-model DB-02: parsed on write and read). */
export const AnalysisDetails = z.object({
  signals: z.array(Signal),
  indicators: z.array(Indicator),
  explanation: z.string().max(EXPLANATION_MAX_CHARS).nullable(),
  recommendations: z.array(z.string().min(1)).min(2).max(4),
});
export type AnalysisDetails = z.infer<typeof AnalysisDetails>;

export const AnalysisResult = AnalysisDetails.extend({
  analysisId: z.uuid(),
  verdict: Verdict,
  inconclusiveReason: InconclusiveReason.nullable(),
  riskTypes: z.array(RiskType),
  redactions: RedactionCounts,
  rule: RuleCode,
  promptVersion: z.string().min(1),
  rulesVersion: z.string().min(1),
  createdAt: z.iso.datetime(),
}).strict();
export type AnalysisResult = z.infer<typeof AnalysisResult>;

/** Request body. Length rules live in `normalizeInput`, so the error wording stays in one place. */
export const CreateAnalysisRequest = z.object({ content: z.string() }).strict();
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequest>;
