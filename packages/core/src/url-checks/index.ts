import { domainToUnicode } from "node:url";
import type { BrandList, Check, Signal, SignalType, UrlLists } from "@scamshield/shared";
import { EVIDENCE_MAX_CHARS } from "@scamshield/shared";
import { LONG_ALIAS, type FoundUrl } from "../indicators";
import { clip } from "../text/clip";
import { fold } from "../text/fold";

export { detectInjection } from "./injection";

/**
 * Deterministic checks on URL strings (SO-02-AC02, analysis-pipeline §6.5). Pure string
 * comparison: no page, DNS record or certificate is ever requested (P5).
 */

export interface DomainCheckContext {
  /** URLs of this registrable domain, for subdomain checks. */
  urls: readonly Pick<FoundUrl, "host" | "subdomain">[];
  /** The domain as written in the message, used as evidence. */
  value: string;
  mentionedBrandIds: readonly string[];
  brands: BrandList;
  urlLists: UrlLists;
}

export interface CheckResult {
  checks: Check[];
  signals: Signal[];
}

export function isOfficialHost(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function signal(type: SignalType, evidence: string, indicator: string): Signal {
  return {
    type,
    source: "deterministic",
    evidence: clip(evidence, EVIDENCE_MAX_CHARS),
    indicator,
  };
}

/** Cyrillic letters that render like Latin ones. */
const CYRILLIC: Record<string, string> = {
  а: "a",
  в: "b",
  е: "e",
  һ: "h",
  н: "h",
  і: "i",
  ј: "j",
  к: "k",
  м: "m",
  о: "o",
  р: "p",
  с: "c",
  ѕ: "s",
  т: "t",
  у: "y",
  х: "x",
  ԁ: "d",
};

function skeleton(label: string): string {
  return [...label]
    .map((c) => CYRILLIC[c] ?? c)
    .join("")
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w");
}

/** Damerau-Levenshtein (optimal string alignment): an adjacent swap counts as one edit. */
function distance(a: string, b: string): number {
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        (rows[i - 1]?.[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (rows[i - 1]?.[j - 1] ?? 0) + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (rows[i - 2]?.[j - 2] ?? 0) + 1);
      }
      row.push(best);
    }
    rows.push(row);
  }
  return rows[a.length]?.[b.length] ?? 0;
}

const compact = (text: string) => fold(text).text.replace(/[^\p{L}\p{N}]/gu, "");

/** First brand alias of at least 4 characters contained in `text`. */
function containedAlias(text: string, brands: BrandList): string | undefined {
  const haystack = compact(text);
  for (const brand of brands) {
    for (const alias of brand.aliases) {
      const needle = compact(alias);
      if (needle.length >= LONG_ALIAS && haystack.includes(needle)) return alias;
    }
  }
  return undefined;
}

/** A short alias (MB, VCB…) counts in a subdomain only as a whole label part. */
function aliasInSubdomain(subdomain: string, brands: BrandList): string | undefined {
  const long = containedAlias(subdomain, brands);
  if (long) return long;
  const parts = new Set(subdomain.split(/[.\-_]/));
  return brands
    .flatMap((b) => b.aliases)
    .find((a) => a.length < LONG_ALIAS && parts.has(a.toLowerCase()));
}

/** The `lookalike` detail, or null when the main label resembles no official domain. */
function lookalikeOf(domain: string, brands: BrandList): string | null {
  const label = domainToUnicode(domain).split(".")[0] ?? "";
  const official = brands.flatMap((b) => b.domains);
  let nearest: { domain: string; distance: number } | null = null;
  let sameName: string | null = null;

  for (const candidate of official) {
    const other = candidate.split(".")[0] ?? "";
    const d = distance(label, other);
    if (d === 0) {
      sameName ??= candidate;
      continue;
    }
    const near = d <= (other.length < 8 ? 1 : 2) || skeleton(label) === skeleton(other);
    if (near && (!nearest || d < nearest.distance)) nearest = { domain: candidate, distance: d };
  }

  if (nearest) return `nearest:${nearest.domain}:distance_${nearest.distance}`;
  const alias = containedAlias(label, brands);
  if (alias) return `contains:${alias}`;
  return sameName ? `nearest:${sameName}:distance_0` : null;
}

export function checkDomain(domain: string, ctx: DomainCheckContext): CheckResult {
  const checks: Check[] = [];
  const types = new Set<SignalType>();
  const add = (type: Check["type"], detail: string | null, warn: boolean, found: SignalType) => {
    checks.push({ type, status: warn ? "warn" : "pass", detail });
    if (warn) types.add(found);
  };
  const official = isOfficialHost(
    domain,
    ctx.brands.flatMap((b) => b.domains),
  );

  const mentioned = ctx.brands.filter((b) => ctx.mentionedBrandIds.includes(b.id));
  const owner = mentioned.find((b) => isOfficialHost(domain, b.domains));
  const named = owner ?? mentioned.find((b) => b.id === ctx.mentionedBrandIds[0]);
  if (named) add("official_domain", `brand:${named.id}`, !owner, "brand_domain_mismatch");

  const lookalike = official ? null : lookalikeOf(domain, ctx.brands);
  add("lookalike", lookalike, lookalike !== null, "lookalike_domain");

  const hosts = [domain, ...ctx.urls.map((u) => u.host)];
  const punycode = hosts.find((h) => h.split(".").some((label) => label.startsWith("xn--")));
  add(
    "punycode",
    punycode ? `decoded:${domainToUnicode(punycode)}` : null,
    punycode !== undefined,
    "lookalike_domain",
  );

  const subdomains = ctx.urls.map((u) => u.subdomain).filter((s) => s !== "");
  if (subdomains.length > 0) {
    const alias = official
      ? undefined
      : subdomains.map((s) => aliasInSubdomain(s, ctx.brands)).find(Boolean);
    add(
      "subdomain_brand",
      alias ? `contains:${alias}` : null,
      Boolean(alias),
      "brand_in_subdomain",
    );
  }

  const shortened = ctx.urlLists.shorteners.some((e) => hosts.includes(e.value));
  add("shortener", null, shortened, "shortened_url");

  const tld = domain.split(".").at(-1);
  const risky = ctx.urlLists.riskyTlds.some((e) => e.value === tld);
  add("risky_tld", null, risky, "risky_tld");

  return { checks, signals: [...types].map((type) => signal(type, ctx.value, domain)) };
}

/** `ip_host` belongs to the url indicator: an IP has no registrable domain. */
export function checkUrl(url: Pick<FoundUrl, "isIp" | "normalized">, value: string): CheckResult {
  return {
    checks: [{ type: "ip_host", status: url.isIp ? "warn" : "pass", detail: null }],
    signals: url.isIp ? [signal("ip_url", value, url.normalized)] : [],
  };
}
