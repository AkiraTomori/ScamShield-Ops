import type {
  BrandList,
  InconclusiveReason,
  Indicator,
  RiskType,
  RuleCode,
  Signal,
  SignalType,
  Verdict,
} from "@scamshield/shared";
import { isOfficialHost } from "../url-checks";

export { recommend, RECOMMENDATIONS } from "./recommendations";

/**
 * The verdict rules, `rules-v1` (P4, SO-03-AC02, analysis-pipeline §7). Pure: same input, same
 * output. The model never supplies a verdict.
 */
export const RULES_VERSION = "rules-v1";

/** Minimum length below which a message with no signal cannot be judged (§7.1). */
const MIN_TEXT_CHARS = 25;

const HARD: readonly SignalType[] = ["verified_indicator", "blocklisted_url"];
const DOMAIN_DECEPTION: readonly SignalType[] = [
  "brand_domain_mismatch",
  "lookalike_domain",
  "brand_in_subdomain",
];
const STRONG: readonly SignalType[] = [
  "ai_directed_instruction",
  "credential_request",
  ...DOMAIN_DECEPTION,
];
const MEDIUM: readonly SignalType[] = [
  "payment_request",
  "reward_promise",
  "threat",
  "shortened_url",
  "ip_url",
  "new_domain",
];
const WEAK: readonly SignalType[] = ["urgency", "claims_organization", "risky_tld"];

export type LlmFailure = Exclude<InconclusiveReason, "insufficient_evidence">;

export interface DecisionInput {
  signals: readonly Signal[];
  /** With their checks. */
  indicators: readonly Indicator[];
  /** Why there are no LLM signals; null when the model step succeeded. */
  llmFailure: LlmFailure | null;
  /** Code points of the standard (normalized) content. */
  textLength: number;
  brands: BrandList;
}

export interface Decision {
  verdict: Verdict;
  rule: RuleCode;
  inconclusiveReason: InconclusiveReason | null;
  riskTypes: RiskType[];
}

export function decide(input: DecisionInput): Decision {
  // Distinct types: two links of the same kind are one finding, not two.
  const found = new Set(input.signals.map((s) => s.type));
  const has = (type: SignalType) => found.has(type);
  const count = (group: readonly SignalType[]) => group.filter(has).length;

  const strong = count(STRONG);
  const medium = count(MEDIUM);
  const weak = count(WEAK);
  const deceptive = count(DOMAIN_DECEPTION) > 0;
  const hasUrl = input.indicators.some((i) => i.type === "url");

  const [rule, verdict] = ((): [RuleCode, Verdict] => {
    if (count(HARD) > 0) return ["R1", "high_risk"];
    if (input.llmFailure) return ["R0", "inconclusive"];
    if (has("ai_directed_instruction") && strong + medium >= 2) return ["R2", "high_risk"];
    if (deceptive && (has("credential_request") || has("payment_request"))) {
      return ["R3", "high_risk"];
    }
    if (has("credential_request") && (has("threat") || has("urgency") || deceptive || hasUrl)) {
      return ["R4", "high_risk"];
    }
    if (strong >= 2) return ["R5", "high_risk"];
    if (strong >= 1) return ["R6", "suspicious"];
    if (medium >= 2 || (medium >= 1 && weak >= 1)) return ["R7", "suspicious"];
    if (found.size === 0 && lacksEvidence(input)) return ["R8", "inconclusive"];
    return ["R9", "no_signal"];
  })();

  return {
    verdict,
    rule,
    // R1 keeps the failure so the UI can say the AI part did not run (P-01).
    inconclusiveReason: rule === "R8" ? "insufficient_evidence" : input.llmFailure,
    riskTypes: riskTypes(verdict, input, has, deceptive),
  };
}

function lacksEvidence(input: DecisionInput): boolean {
  if (input.textLength < MIN_TEXT_CHARS) return true;
  const official = input.brands.flatMap((b) => b.domains);
  return input.indicators.some(
    (i) =>
      i.type === "domain" &&
      !isOfficialHost(i.normalized, official) &&
      i.checks.some((c) => c.status === "unavailable"),
  );
}

function riskTypes(
  verdict: Verdict,
  input: DecisionInput,
  has: (type: SignalType) => boolean,
  deceptive: boolean,
): RiskType[] {
  if (verdict !== "high_risk" && verdict !== "suspicious") return [];
  const official = input.brands.flatMap((b) => b.domains);
  const unofficialUrl = input.indicators.some(
    (i) => i.type === "url" && !isOfficialHost(new URL(i.normalized).hostname, official),
  );
  const namesBrand = input.indicators.some((i) => i.type === "brand");

  const types: RiskType[] = [];
  if (deceptive || (has("claims_organization") && namesBrand && unofficialUrl)) {
    types.push("brand_impersonation");
  }
  if (has("credential_request")) types.push("otp_phishing");
  if (has("payment_request")) types.push("payment_request");
  if (has("reward_promise")) types.push("fake_prize");
  return types.length > 0 ? types : ["other"];
}
