import { z } from "zod";
import { AnalysisResult } from "./analysis";
import { CaseStatus, Decision, MatchableIndicatorType, ReportChannel } from "./enums";
import { LlmCaseSummaryOutput } from "./llm";

// One investigation case (contracts §6). Read on the server only: browser code imports types.

/** A staff conclusion as shown on a case (contracts §6). */
export const DecisionRecord = z
  .object({
    decision: Decision,
    reason: z.string().min(1),
    /** Display name of the staff member. */
    decidedBy: z.string().min(1),
    decidedAt: z.iso.datetime(),
    disagreesWithEngine: z.boolean(),
  })
  .strict();
export type DecisionRecord = z.infer<typeof DecisionRecord>;

/** Cases sharing an indicator (SO-07, related-cases §3). Empty until T-070. */
export const RelatedCases = z
  .object({
    total: z.number().int().nonnegative(),
    items: z.array(
      z
        .object({
          caseCode: z.string().min(1),
          status: CaseStatus,
          decision: Decision.nullable(),
          isSeed: z.boolean(),
          createdAt: z.iso.datetime(),
          sharedIndicators: z.array(
            z.object({ type: MatchableIndicatorType, normalized: z.string() }).strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict();
export type RelatedCases = z.infer<typeof RelatedCases>;

/** One investigation case (contracts §6, SO-05-AC01). */
export const CaseDetail = z
  .object({
    caseId: z.uuid(),
    caseCode: z.string().min(1),
    status: CaseStatus,
    createdAt: z.iso.datetime(),
    isSeed: z.boolean(),
    source: z.literal("user_report"),
    channel: ReportChannel,
    reporterNote: z.string().nullable(),
    redactedContent: z.string(),
    analysis: AnalysisResult,
    /** Null when the model failed at report time (A-02). */
    aiSummary: LlmCaseSummaryOutput.nullable(),
    decision: DecisionRecord.nullable(),
    relatedCases: RelatedCases,
  })
  .strict();
export type CaseDetail = z.infer<typeof CaseDetail>;
