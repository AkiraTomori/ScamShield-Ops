import { z } from "zod";
import data from "../data/url-lists.json";

/**
 * Shortener domains and abused TLDs (analysis-pipeline §12 P-04). Every entry names a published
 * source; entries are never filled in from memory. The owner reviews the content in the PR.
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
  })
  .strict()
  .refine(
    (lists) => [...lists.shorteners, ...lists.riskyTlds].every((e) => e.source in lists.sources),
    { message: "every entry must point to a declared source" },
  );
export type UrlLists = z.infer<typeof UrlLists>;

export const URL_LISTS: UrlLists = UrlLists.parse(data);
