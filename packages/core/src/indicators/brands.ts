import type { BrandList } from "@scamshield/shared";
import { fold, type Span } from "../text/fold";

/** Deterministic brand mentions (analysis-pipeline §6.4). Only these feed the domain checks. */

export interface FoundBrand extends Span {
  value: string;
  brandId: string;
}

/** Aliases shorter than this are matched case-sensitively, in capitals (MB, ACB, VCB…). */
export const LONG_ALIAS = 4;

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordPattern(alias: string): RegExp {
  const body = alias.split(/\s+/).map(escape).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, "u");
}

/** First mention of each brand, in order of appearance. */
export function findBrands(content: string, brands: BrandList): FoundBrand[] {
  const folded = fold(content);
  const found: FoundBrand[] = [];

  for (const brand of brands) {
    let best: Span | null = null;
    for (const alias of brand.aliases) {
      const long = alias.length >= LONG_ALIAS;
      const match = wordPattern(long ? fold(alias).text : alias).exec(long ? folded.text : content);
      if (!match) continue;
      const end = match.index + match[0].length;
      const span = long
        ? { start: folded.at(match.index), end: folded.at(end) }
        : { start: match.index, end };
      // Prefer the earliest mention, and the longest one at that position ("MB Bank" over "MB").
      if (!best || span.start < best.start || (span.start === best.start && span.end > best.end)) {
        best = span;
      }
    }
    if (best)
      found.push({ ...best, value: content.slice(best.start, best.end), brandId: brand.id });
  }
  return found.sort((a, b) => a.start - b.start);
}
