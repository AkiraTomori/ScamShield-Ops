import { DecisionRecord } from "@scamshield/shared";
import type { decisions } from "../db/schema";

/** A stored decision as the API and the case page show it. */
export function toDecisionRecord(
  row: typeof decisions.$inferSelect,
  decidedBy: string | null,
): DecisionRecord {
  return DecisionRecord.parse({
    decision: row.decision,
    reason: row.reason,
    decidedBy,
    decidedAt: row.decidedAt.toISOString(),
    disagreesWithEngine: row.disagreesWithEngine,
  });
}
