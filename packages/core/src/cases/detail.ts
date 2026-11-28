import { AnalysisDetails, CaseDetail } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import type { StaffSession } from "../auth/session";
import { analyses, cases, decisions, staffUsers } from "../db/schema";
import { logEvent } from "../log";
import type { Db } from "../rate-limit";
import { normalizeCaseCode } from "../reports/lookup";
import { toDecisionRecord } from "./decision-record";
import { findRelatedCases } from "./related";

/** One investigation case (fraudops §5.1, SO-05-AC01). */

/** Null when there is no such case. Stored data that does not parse is an error, never shown (DB-02). */
export async function getCaseDetail(
  session: StaffSession,
  caseCode: string,
  deps: { db: Db },
): Promise<CaseDetail | null> {
  const code = normalizeCaseCode(caseCode);
  if (!code) return null;

  const [row] = await deps.db
    .select({ case: cases, analysis: analyses, decision: decisions, staff: staffUsers.displayName })
    .from(cases)
    .innerJoin(analyses, eq(analyses.id, cases.analysisId))
    .leftJoin(decisions, eq(decisions.caseId, cases.id))
    .leftJoin(staffUsers, eq(staffUsers.id, decisions.decidedBy))
    .where(eq(cases.code, code));
  if (!row) return null;
  const relatedCases = await findRelatedCases(session, row.case.id, deps);

  try {
    const { analysis, decision } = row;
    return CaseDetail.parse({
      caseId: row.case.id,
      caseCode: row.case.code,
      status: row.case.status,
      createdAt: row.case.createdAt.toISOString(),
      isSeed: row.case.isSeed,
      source: "user_report",
      channel: row.case.channel,
      reporterNote: row.case.reporterNote,
      redactedContent: analysis.redactedContent,
      analysis: {
        ...AnalysisDetails.parse(analysis.details),
        analysisId: analysis.id,
        verdict: analysis.verdict,
        inconclusiveReason: analysis.inconclusiveReason,
        riskTypes: analysis.riskTypes,
        redactions: analysis.redactionCounts,
        rule: analysis.rule,
        promptVersion: analysis.promptVersion,
        rulesVersion: analysis.rulesVersion,
        createdAt: analysis.createdAt.toISOString(),
      },
      aiSummary: row.case.aiSummary,
      decision: decision && toDecisionRecord(decision, row.staff),
      relatedCases,
    });
  } catch {
    // The parse error is not passed on: the page's errors are logged, and this one is about the data.
    logEvent({ event: "case_detail_invalid", code });
    throw new Error("case_detail_invalid");
  }
}
