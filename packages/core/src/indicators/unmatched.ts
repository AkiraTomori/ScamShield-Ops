import { BRANDS, URL_LISTS } from "@scamshield/shared";

/**
 * Domains that say nothing about a sender: a brand's own sites, URL shorteners and shared platforms
 * appear in unrelated messages. They link no cases (related-cases ST-01) and are neither recorded
 * nor matched as confirmed scam indicators (verified-indicators XM-01, XM-04). Each list comes from
 * its single data file.
 */
export const UNMATCHED_DOMAINS: readonly string[] = [
  ...BRANDS.flatMap((brand) => brand.domains),
  ...URL_LISTS.shorteners.map((entry) => entry.value),
  ...URL_LISTS.sharedPlatforms.map((entry) => entry.value),
];
