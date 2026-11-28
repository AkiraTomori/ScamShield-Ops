import { BRANDS, RelatedCases, URL_LISTS } from "@scamshield/shared";
import { and, count, countDistinct, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { StaffSession } from "../auth/session";
import { analysisIndicators, cases, decisions } from "../db/schema";
import type { Db } from "../rate-limit";

/**
 * Cases sharing a normalized indicator (SO-07, related-cases §2–3). A plain comparison of what the
 * pipeline stored: nothing is normalized again here, and no model is involved.
 */

export const RELATED_CASES_LIMIT = 20;

/**
 * Domains that link nothing (ST-01): a brand's own sites and URL shorteners appear in unrelated
 * messages. Both come from their single data file.
 */
export const UNMATCHED_DOMAINS: readonly string[] = [
  ...BRANDS.flatMap((brand) => brand.domains),
  ...URL_LISTS.shorteners.map((entry) => entry.value),
];

const current = alias(cases, "current_case");
const mine = alias(analysisIndicators, "mine");
const theirs = alias(analysisIndicators, "theirs");

/**
 * Both queries below join `current` → `mine` → `theirs` → `cases`, where `cases` is the OTHER case.
 * An analysis nobody reported has no case, so it drops out.
 */
const ownIndicators = eq(mine.analysisId, current.analysisId);
const sameIndicator = and(eq(theirs.type, mine.type), eq(theirs.normalized, mine.normalized));
const otherCase = and(eq(cases.analysisId, theirs.analysisId), ne(cases.id, current.id));
const matchable = or(ne(mine.type, "domain"), notInArray(mine.normalized, [...UNMATCHED_DOMAINS]));

/** The most shared indicators first, then the newest. `total` counts every match, not the page. */
export async function findRelatedCases(
  session: StaffSession,
  caseId: string,
  deps: { db: Db },
): Promise<RelatedCases> {
  // Not used by the query: asking for it means no caller can forget the check (fraudops §2).
  void session;
  const rows = await deps.db
    .select({
      caseCode: cases.code,
      status: cases.status,
      decision: decisions.decision,
      isSeed: cases.isSeed,
      createdAt: cases.createdAt,
      sharedIndicators: sql<unknown>`json_agg(
      json_build_object('type', ${mine.type}, 'normalized', ${mine.normalized})
      order by ${mine.type}, ${mine.normalized}
    )`,
      total: sql<number>`(count(*) over ())::int`,
    })
    .from(current)
    .innerJoin(mine, ownIndicators)
    .innerJoin(theirs, sameIndicator)
    .innerJoin(cases, otherCase)
    .leftJoin(decisions, eq(decisions.caseId, cases.id))
    .where(and(eq(current.id, caseId), matchable))
    .groupBy(cases.id, decisions.caseId)
    .orderBy(desc(count()), desc(cases.createdAt), desc(cases.id))
    .limit(RELATED_CASES_LIMIT);

  return RelatedCases.parse({
    total: rows[0]?.total ?? 0,
    // Field by field: the schema is strict and `total` is a column of every row.
    items: rows.map((row) => ({
      caseCode: row.caseCode,
      status: row.status,
      decision: row.decision,
      isSeed: row.isSeed,
      createdAt: row.createdAt.toISOString(),
      sharedIndicators: row.sharedIndicators,
    })),
  });
}

/** How many other cases each of these relates to, for the list. A case with none is absent. */
export async function countRelatedCases(
  caseIds: string[],
  deps: { db: Db },
): Promise<Map<string, number>> {
  if (caseIds.length === 0) return new Map();
  const rows = await deps.db
    .select({ id: current.id, total: countDistinct(cases.id) })
    .from(current)
    .innerJoin(mine, ownIndicators)
    .innerJoin(theirs, sameIndicator)
    .innerJoin(cases, otherCase)
    .where(and(inArray(current.id, caseIds), matchable))
    .groupBy(current.id);
  return new Map(rows.map((row) => [row.id, row.total]));
}
