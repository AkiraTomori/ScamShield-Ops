import { ConfirmedIndicatorPage } from "@scamshield/shared";
import { asc, count, desc, eq, isNull } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { cases, confirmedIndicators, staffUsers } from "../db/schema";
import type { Db } from "../rate-limit";

export const CONFIRMED_PAGE_SIZE = 50;

/** The active rows of the confirmed list, newest first (verified-indicators §6). */
export async function listConfirmedIndicators(
  session: StaffSession,
  page: number,
  deps: { db: Db },
): Promise<ConfirmedIndicatorPage> {
  // Not used by the query: asking for it means no caller can forget the check (fraudops §2).
  void session;
  const active = isNull(confirmedIndicators.removedAt);
  const [counted] = await deps.db
    .select({ total: count() })
    .from(confirmedIndicators)
    .where(active);
  const totalPages = Math.max(1, Math.ceil((counted?.total ?? 0) / CONFIRMED_PAGE_SIZE));
  const shown = Math.min(Math.max(1, page), totalPages);

  const rows = await deps.db
    .select({
      id: confirmedIndicators.id,
      type: confirmedIndicators.type,
      normalized: confirmedIndicators.normalized,
      sourceCaseCode: cases.code,
      confirmedAt: confirmedIndicators.confirmedAt,
      confirmedBy: staffUsers.displayName,
    })
    .from(confirmedIndicators)
    // Both foreign keys are RESTRICT, so neither join can drop a row.
    .innerJoin(cases, eq(cases.id, confirmedIndicators.sourceCaseId))
    .innerJoin(staffUsers, eq(staffUsers.id, confirmedIndicators.confirmedBy))
    .where(active)
    // The indicators of one decision share their time; (type, normalized) is unique among active rows.
    .orderBy(
      desc(confirmedIndicators.confirmedAt),
      asc(confirmedIndicators.type),
      asc(confirmedIndicators.normalized),
    )
    .limit(CONFIRMED_PAGE_SIZE)
    .offset((shown - 1) * CONFIRMED_PAGE_SIZE);

  return ConfirmedIndicatorPage.parse({
    items: rows.map(({ confirmedAt, ...row }) => ({
      ...row,
      confirmedAt: confirmedAt.toISOString(),
    })),
    page: shown,
    totalPages,
  });
}
