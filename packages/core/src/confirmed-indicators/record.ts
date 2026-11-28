import { MatchableIndicatorType } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { analysisIndicators, cases, confirmedIndicators } from "../db/schema";
import { UNMATCHED_DOMAINS } from "../indicators";
import type { Db } from "../rate-limit";
import { selectIndicatorsToConfirm, type MatchableIndicator } from "./select";

/** A connection or a transaction on it. */
type Executor = Pick<Db, "select" | "insert">;

/** The stored indicators of this case that a `confirmed_scam` decision would add. */
async function indicatorsOfCase(db: Executor, caseId: string): Promise<MatchableIndicator[]> {
  const rows = await db
    .select({ type: analysisIndicators.type, normalized: analysisIndicators.normalized })
    .from(cases)
    .innerJoin(analysisIndicators, eq(analysisIndicators.analysisId, cases.analysisId))
    .where(eq(cases.id, caseId));
  return selectIndicatorsToConfirm(
    rows.map((row) => ({
      type: MatchableIndicatorType.parse(row.type),
      normalized: row.normalized,
    })),
    UNMATCHED_DOMAINS,
  );
}

/** The preview on the conclusion form (verified-indicators §2): what saving it would add. */
export async function listIndicatorsToConfirm(
  session: StaffSession,
  caseId: string,
  deps: { db: Db },
): Promise<MatchableIndicator[]> {
  // Not used by the query: asking for it means no caller can forget the check (fraudops §2).
  void session;
  return indicatorsOfCase(deps.db, caseId);
}

/**
 * Adds the case's indicators to the confirmed list, inside the decision's transaction: a failure
 * here rolls the decision back too (SO-08-AC01). An indicator already on the list keeps its first
 * source case and confirmer. Resolves with the number of rows added.
 */
export async function recordConfirmedIndicators(
  tx: Executor,
  caseId: string,
  staffUserId: string,
  at: Date,
): Promise<number> {
  const found = await indicatorsOfCase(tx, caseId);
  if (found.length === 0) return 0;
  const added = await tx
    .insert(confirmedIndicators)
    .values(
      found.map((indicator) => ({
        ...indicator,
        sourceCaseId: caseId,
        confirmedBy: staffUserId,
        confirmedAt: at,
      })),
    )
    // No target: the only conflict possible is the partial unique index on active rows.
    .onConflictDoNothing()
    .returning({ id: confirmedIndicators.id });
  return added.length;
}
