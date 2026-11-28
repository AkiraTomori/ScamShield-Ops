import { z } from "zod";
import data from "../data/url-lists.json";

/**
 * Shortener domains and abused TLDs (analysis-pipeline §12 P-04), and shared platform domains
 * (verified-indicators XM-04). Every entry names its source; entries are never filled in from
 * memory. Shorteners and TLDs come from published lists. Shared platforms are the one accepted
 * exception: their source is the owner's decision. The owner reviews the content in the PR.
 */
const Entry = z.object({ value: z.string().regex(/^[a-z0-9.-]+$/), source: z.string() }).strict();

export const UrlLists = z
  .object({
    sources: z.record(
      z.string(),
      z.object({ title: z.string(), url: z.url(), retrieved: z.iso.date() }).strict(),
    ),
    shorteners: z.array(Entry),
    riskyTlds: z.array(Entry),
    /** Domains many unrelated people share. They only narrow matching; no verdict rule reads them. */
    sharedPlatforms: z.array(Entry),
  })
  .strict()
  .refine(
    (lists) =>
      [...lists.shorteners, ...lists.riskyTlds, ...lists.sharedPlatforms].every(
        (e) => e.source in lists.sources,
      ),
    { message: "every entry must point to a declared source" },
  );
export type UrlLists = z.infer<typeof UrlLists>;

export const URL_LISTS: UrlLists = UrlLists.parse(data);
