import { CaseListPage, type CaseListQuery } from "@scamshield/shared";
import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { cases, decisions } from "../db/schema";
import type { Db } from "../rate-limit";
import { normalizeCaseCode } from "../reports/lookup";

/** The FraudOps case queue (fraudops §4, SO-06-AC02). */

export const CASES_PAGE_SIZE = 25;

/** A code search ignores the status filter, so a closed case is still found. */
function filters(query: CaseListQuery): SQL | undefined {
  const verdict = query.verdict ? eq(cases.engineVerdict, query.verdict) : undefined;
  if (query.code) {
    const code = normalizeCaseCode(query.code);
    return and(code ? eq(cases.code, code) : sql`false`, verdict);
  }
  return and(query.status === "all" ? undefined : eq(cases.status, query.status), verdict);
}

/** Newest first, read from the snapshot columns of `cases`; the analysis is not joined. */
export async function listCases(
  session: StaffSession,
  query: CaseListQuery,
  deps: { db: Db },
): Promise<CaseListPage> {
  // Not used by the query: asking for it means no caller can forget the check (fraudops §2).
  void session;
  const where = filters(query);
  const [counted] = await deps.db.select({ total: count() }).from(cases).where(where);
  const total = counted?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CASES_PAGE_SIZE));
  const page = Math.min(query.page, totalPages);

  const rows = await deps.db
    .select({
      caseCode: cases.code,
      createdAt: cases.createdAt,
      engineVerdict: cases.engineVerdict,
      riskTypes: cases.riskTypes,
      status: cases.status,
      isSeed: cases.isSeed,
      decision: decisions.decision,
    })
    .from(cases)
    .leftJoin(decisions, eq(decisions.caseId, cases.id))
    .where(where)
    .orderBy(desc(cases.createdAt), desc(cases.id))
    .limit(CASES_PAGE_SIZE)
    .offset((page - 1) * CASES_PAGE_SIZE);

  const hasAnyCase =
    total > 0 || (await deps.db.select({ id: cases.id }).from(cases).limit(1)).length > 0;

  return CaseListPage.parse({
    items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    page,
    totalPages,
    hasAnyCase,
  });
}
