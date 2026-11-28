import { BRANDS, URL_LISTS } from "@scamshield/shared";

/**
 * Domains that say nothing about a sender: a brand's own sites and URL shorteners appear in
 * unrelated messages. They link no cases (related-cases ST-01) and are never recorded as confirmed
 * scam indicators (verified-indicators XM-01). Both come from their single data file.
 */
export const UNMATCHED_DOMAINS: readonly string[] = [
  ...BRANDS.flatMap((brand) => brand.domains),
  ...URL_LISTS.shorteners.map((entry) => entry.value),
];
