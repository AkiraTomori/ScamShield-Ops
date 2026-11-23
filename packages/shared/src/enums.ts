import { z } from "zod";

// Enum values shared by the API, the LLM output schemas and the database CHECK constraints.
// Source of truth: docs/architecture/contracts.md §1. The DB derives its CHECK lists from these,
// so a value is added here once (plus a migration that widens the CHECK).

export const Verdict = z.enum(["high_risk", "suspicious", "no_signal", "inconclusive"]);
export type Verdict = z.infer<typeof Verdict>;

export const InconclusiveReason = z.enum([
  "insufficient_evidence",
  "timeout",
  "llm_invalid_output",
  "llm_unavailable",
]);
export type InconclusiveReason = z.infer<typeof InconclusiveReason>;

export const IndicatorType = z.enum(["url", "domain", "phone", "bank_account", "brand"]);
export type IndicatorType = z.infer<typeof IndicatorType>;

/**
 * Indicator types stored in `analysis_indicators`: only the ones SO-07-AC01 matches on. `url` and
 * `brand` stay inside `analyses.details` (data-model §2.2).
 */
export const MatchableIndicatorType = IndicatorType.extract(["domain", "phone", "bank_account"]);
export type MatchableIndicatorType = z.infer<typeof MatchableIndicatorType>;

export const RiskType = z.enum([
  "brand_impersonation",
  "otp_phishing",
  "payment_request",
  "fake_prize",
  "other",
]);
export type RiskType = z.infer<typeof RiskType>;

export const ReportChannel = z.enum(["sms", "zalo", "messenger", "email", "other"]);
export type ReportChannel = z.infer<typeof ReportChannel>;

export const CaseStatus = z.enum(["pending_review", "closed"]);
export type CaseStatus = z.infer<typeof CaseStatus>;

export const Decision = z.enum(["confirmed_scam", "not_scam", "insufficient_evidence"]);
export type Decision = z.infer<typeof Decision>;

export const SignalSource = z.enum(["deterministic", "ai"]);
export type SignalSource = z.infer<typeof SignalSource>;

/** Every signal the product can emit, AI-derived and deterministic (contracts §3, analysis-pipeline §6.9). */
export const SignalType = z.enum([
  "claims_organization",
  "urgency",
  "threat",
  "credential_request",
  "payment_request",
  "reward_promise",
  "ai_directed_instruction",
  "brand_domain_mismatch",
  "lookalike_domain",
  "brand_in_subdomain",
  "shortened_url",
  "ip_url",
  "risky_tld",
  "new_domain",
  "blocklisted_url",
  "verified_indicator",
]);
export type SignalType = z.infer<typeof SignalType>;
