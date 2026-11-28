import type { MatchableIndicatorType } from "@scamshield/shared";

export interface MatchableIndicator {
  type: MatchableIndicatorType;
  normalized: string;
}

/**
 * What a `confirmed_scam` decision adds to the list (verified-indicators §2). The preview on the
 * form and the write both come through here, so staff see exactly what is recorded.
 *
 * `excludedDomains` is XM-01: a scam message often carries a real brand's domain, and recording it
 * would mark every genuine message of that brand as a confirmed scam. Each indicator appears once,
 * in a stable order, which also keeps two concurrent inserts from deadlocking.
 */
export function selectIndicatorsToConfirm(
  indicators: readonly MatchableIndicator[],
  excludedDomains: readonly string[],
): MatchableIndicator[] {
  const excluded = new Set(excludedDomains);
  const kept = new Map<string, MatchableIndicator>();
  for (const { type, normalized } of indicators) {
    if (type === "domain" && excluded.has(normalized)) continue;
    kept.set(`${type} ${normalized}`, { type, normalized });
  }
  // The keys are unique, so no two ever compare equal.
  return [...kept].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, indicator]) => indicator);
}
