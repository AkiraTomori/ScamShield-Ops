import type { SignalSource, Verdict } from "@scamshield/shared";
import type { AnalysisResult, Check } from "@scamshield/shared/analysis";
import { BRANDS } from "@scamshield/shared/brands";
import { vi } from "../../copy/vi";

/** Every "what to show" decision of the result block (scamshield-ui §3.3, design-system §3). Pure. */
export interface ResultViewModel {
  verdict: Verdict;
  /** Under the verdict: why it is inconclusive, or that the AI step did not run. */
  note: string | null;
  canRetry: boolean;
  redactionNotice: string | null;
  explanation: string | null;
  signals: { label: string; source: SignalSource; evidence: string | null }[];
  indicators: {
    value: string;
    checks: { name: string; status: Check["status"]; detail: string | null }[];
  }[];
  recommendations: string[];
}

type BrandNames = readonly { id: string; name: string }[];

export function toViewModel(result: AnalysisResult, brands: BrandNames = BRANDS): ResultViewModel {
  const { verdict, inconclusiveReason: reason, redactions } = result;
  const unresolved = verdict === "inconclusive" && reason !== null;
  // P-01: the verdict stands on hard evidence although the model step failed.
  const llmSkipped = verdict === "high_risk" && reason !== null;
  const redacted = (["otp", "password", "card"] as const)
    .filter((kind) => redactions[kind] > 0)
    .map((kind) => vi.result.redactionKind[kind]);

  return {
    verdict,
    note: unresolved ? vi.inconclusiveReason[reason] : llmSkipped ? vi.result.llmSkippedNote : null,
    // Without new evidence a retry gives the same answer.
    canRetry: unresolved && reason !== "insufficient_evidence",
    redactionNotice: redacted.length > 0 ? vi.result.redactionNotice(redacted) : null,
    explanation: result.explanation,
    signals: result.signals.map(({ type, source, evidence }) => ({
      label: vi.signalType[type],
      source,
      // A rule's evidence is the indicator itself, which has its own card.
      evidence: source === "ai" ? evidence : null,
    })),
    // A brand name appears inside the official-domain check, not as a card.
    indicators: result.indicators
      .filter((indicator) => indicator.type !== "brand")
      .map(({ value, checks }) => ({
        value,
        checks: checks.map((check) => ({
          name: vi.checkType[check.type],
          status: check.status,
          detail: describeDetail(check, brands),
        })),
      })),
    recommendations: result.recommendations,
  };
}

/**
 * The sentence for (check, status, code). Anything not in the design-system §3 table gives null: the raw
 * code is never shown. The captured part may come from the sender, so render it as text.
 */
function describeDetail({ type, status, detail }: Check, brands: BrandNames): string | null {
  if (detail === null) return null;
  const capture = (pattern: RegExp) => pattern.exec(detail)?.slice(1);
  const copy = vi.checkDetail;

  if (type === "official_domain" && status !== "unavailable") {
    const brand = brands.find((b) => `brand:${b.id}` === detail);
    if (!brand) return null;
    return status === "warn"
      ? copy.officialDomainWarn(brand.name)
      : copy.officialDomainPass(brand.name);
  }
  if (type === "lookalike" && status === "warn") {
    // Distance 0 (same name, other ending) has no sentence yet: "differs by 0" would mislead.
    const near = capture(/^nearest:(.+):distance_([1-9]\d*)$/);
    if (near) return copy.nearest(near[0] ?? "", near[1] ?? "");
    const alias = capture(/^contains:(.+)$/);
    return alias ? copy.containsAlias(alias[0] ?? "") : null;
  }
  if (type === "punycode" && status === "warn") {
    const decoded = capture(/^decoded:(.+)$/);
    return decoded ? copy.decoded(decoded[0] ?? "") : null;
  }
  if (type === "domain_age" && status !== "unavailable") {
    const age = capture(/^age_days:(\d+)$/);
    return age ? copy.ageDays(age[0] ?? "") : null;
  }
  return null;
}
