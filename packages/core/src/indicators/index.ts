import type { BrandList, Indicator, IndicatorType } from "@scamshield/shared";
import { findBrands } from "./brands";
import { findAccounts, findPhones } from "./numbers";
import { findUrls, type FoundUrl } from "./urls";

export { findBrands, LONG_ALIAS, type FoundBrand } from "./brands";
export {
  CURRENCY_AFTER,
  findAccounts,
  findPhones,
  type FoundAccount,
  type FoundNumber,
} from "./numbers";
export { UNMATCHED_DOMAINS } from "./unmatched";
export { findUrls, type FoundUrl } from "./urls";

/** Per analysis, per kind: bounds the work a hostile message can cause (§6.1). */
export const MAX_PER_KIND = 10;

export interface ExtractedIndicators {
  /** Deduplicated by (type, normalized), in order of first appearance. Checks are empty here. */
  indicators: Indicator[];
  /** Every URL kept, including repeats of one domain with different hosts. */
  urls: FoundUrl[];
  brandIds: string[];
}

interface Positioned {
  start: number;
  type: IndicatorType;
  value: string;
  normalized: string;
}

/** Deterministic extraction (SO-02-AC01): the same content always yields the same list. */
export function extractIndicators(text: string, brands: BrandList): ExtractedIndicators {
  const allUrls = findUrls(text);
  const keptUrls = new Set([...new Set(allUrls.map((u) => u.normalized))].slice(0, MAX_PER_KIND));
  const urls = allUrls.filter((u) => keptUrls.has(u.normalized));

  const phones = findPhones(text, allUrls);
  const accounts = findAccounts(text);
  const mentioned = findBrands(text, brands);

  const items: Positioned[] = [
    ...urls.map((u) => ({
      start: u.start,
      type: "url" as const,
      value: u.value,
      normalized: u.normalized,
    })),
    ...urls.flatMap((u) =>
      u.domain
        ? [
            {
              start: u.start,
              type: "domain" as const,
              value: u.domainValue ?? u.domain,
              normalized: u.domain,
            },
          ]
        : [],
    ),
    ...phones.map((p) => ({ ...p, type: "phone" as const })),
    ...accounts.map((a) => ({ ...a, type: "bank_account" as const })),
    ...mentioned.map((b) => ({
      start: b.start,
      type: "brand" as const,
      value: b.value,
      normalized: b.brandId,
    })),
  ];

  // Array.prototype.sort is stable, so a url stays ahead of its domain at the same position.
  items.sort((a, b) => a.start - b.start);

  const seen = new Set<string>();
  const counts = new Map<IndicatorType, number>();
  const indicators: Indicator[] = [];
  for (const { type, value, normalized } of items) {
    const key = `${type}\u0000${normalized}`;
    const count = counts.get(type) ?? 0;
    if (seen.has(key) || count >= MAX_PER_KIND) continue;
    seen.add(key);
    counts.set(type, count + 1);
    indicators.push({ type, value, normalized, checks: [] });
  }

  return { indicators, urls, brandIds: mentioned.map((b) => b.brandId) };
}
