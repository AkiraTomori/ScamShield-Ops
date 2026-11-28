import { MatchableIndicatorType } from "@scamshield/shared";
import { and, eq, isNull, or } from "drizzle-orm";
import { confirmedIndicators } from "../db/schema";
import { UNMATCHED_DOMAINS } from "../indicators";
import type { Db } from "../rate-limit";
import { selectIndicatorsToConfirm, type MatchableIndicator } from "./select";

/**
 * Which of a message's indicators are on the confirmed list now (SO-08-AC02, verified-indicators §3).
 * The engine's read path: it takes no staff session and returns nothing about who confirmed what, or
 * from which case.
 *
 * XM-01 applies here too, not only when recording: a domain added to the brand list after someone
 * confirmed it must stop counting at once.
 */
export async function findVerifiedMatches(
  keys: readonly MatchableIndicator[],
  deps: { db: Db },
): Promise<MatchableIndicator[]> {
  const asked = selectIndicatorsToConfirm(keys, UNMATCHED_DOMAINS);
  // `or()` of nothing would be no condition at all, and match every row.
  if (asked.length === 0) return [];
  const rows = await deps.db
    .select({ type: confirmedIndicators.type, normalized: confirmedIndicators.normalized })
    .from(confirmedIndicators)
    .where(
      and(
        isNull(confirmedIndicators.removedAt),
        or(
          ...asked.map((key) =>
            and(
              eq(confirmedIndicators.type, key.type),
              eq(confirmedIndicators.normalized, key.normalized),
            ),
          ),
        ),
      ),
    );
  return rows.map((row) => ({
    type: MatchableIndicatorType.parse(row.type),
    normalized: row.normalized,
  }));
}
