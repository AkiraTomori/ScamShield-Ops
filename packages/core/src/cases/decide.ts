import { Verdict, type DecisionRecord, type DecisionRequest } from "@scamshield/shared";
import { and, eq } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { recordConfirmedIndicators } from "../confirmed-indicators/record";
import { cases, decisions, staffUsers } from "../db/schema";
import type { Db } from "../rate-limit";
import { normalizeCaseCode } from "../reports/lookup";
import { disagreesWithEngine } from "./agreement";
import { toDecisionRecord } from "./decision-record";

/** Closing a case with a staff decision (fraudops §5.3, data-model §4). */

export type DecideResult =
  | { kind: "decided"; decision: DecisionRecord }
  /** Someone else closed it first; theirs is the decision that stands. */
  | { kind: "conflict"; decision: DecisionRecord }
  | { kind: "not_found" };

export async function decideCase(
  session: StaffSession,
  caseCode: string,
  req: DecisionRequest,
  deps: { db: Db; now: () => Date },
): Promise<DecideResult> {
  const code = normalizeCaseCode(caseCode);
  if (!code) return { kind: "not_found" };
  const at = deps.now();

  return deps.db.transaction(async (tx): Promise<DecideResult> => {
    // The condition on the status is what lets only one of two concurrent decisions through: the
    // second waits for the row, then finds it closed.
    const [closed] = await tx
      .update(cases)
      .set({ status: "closed", closedAt: at, updatedAt: at })
      .where(and(eq(cases.code, code), eq(cases.status, "pending_review")))
      .returning({ id: cases.id, engineVerdict: cases.engineVerdict });

    if (!closed) {
      const [existing] = await tx
        .select({ decision: decisions, staff: staffUsers.displayName })
        .from(cases)
        .leftJoin(decisions, eq(decisions.caseId, cases.id))
        .leftJoin(staffUsers, eq(staffUsers.id, decisions.decidedBy))
        .where(eq(cases.code, code));
      if (!existing) return { kind: "not_found" };
      // Closing and deciding happen in one transaction, so this is damaged data.
      if (!existing.decision) throw new Error("closed_without_decision");
      return { kind: "conflict", decision: toDecisionRecord(existing.decision, existing.staff) };
    }

    const engineVerdict = Verdict.parse(closed.engineVerdict);
    const [stored] = await tx
      .insert(decisions)
      .values({
        caseId: closed.id,
        decision: req.decision,
        reason: req.reason,
        decidedBy: session.staffUserId,
        decidedAt: at,
        engineVerdict,
        disagreesWithEngine: disagreesWithEngine(req.decision, engineVerdict),
      })
      .returning();
    if (!stored) throw new Error("decision insert returned no row");
    // In this transaction, so no case ends up confirmed_scam without its indicators (SO-08-AC01).
    if (req.decision === "confirmed_scam") {
      await recordConfirmedIndicators(tx, closed.id, session.staffUserId, at);
    }
    return { kind: "decided", decision: toDecisionRecord(stored, session.displayName) };
  });
}
