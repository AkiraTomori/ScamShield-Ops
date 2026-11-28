import { and, eq, isNull } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { confirmedIndicators } from "../db/schema";
import type { Db } from "../rate-limit";

export type RemoveResult =
  { kind: "removed" } | { kind: "already_removed" } | { kind: "not_found" };

/**
 * Takes one indicator off the confirmed list, keeping the row with who, why and when (SO-08-AC03,
 * verified-indicators §5). `id` must already be a UUID: Postgres rejects anything else.
 */
export async function removeConfirmedIndicator(
  session: StaffSession,
  id: string,
  reason: string,
  deps: { db: Db; now: () => Date },
): Promise<RemoveResult> {
  // The condition on `removed_at` is what lets only one of two concurrent removals through.
  const removed = await deps.db
    .update(confirmedIndicators)
    .set({ removedAt: deps.now(), removedBy: session.staffUserId, removalReason: reason })
    .where(and(eq(confirmedIndicators.id, id), isNull(confirmedIndicators.removedAt)))
    .returning({ id: confirmedIndicators.id });
  if (removed.length > 0) return { kind: "removed" };

  const [existing] = await deps.db
    .select({ id: confirmedIndicators.id })
    .from(confirmedIndicators)
    .where(eq(confirmedIndicators.id, id));
  return { kind: existing ? "already_removed" : "not_found" };
}
