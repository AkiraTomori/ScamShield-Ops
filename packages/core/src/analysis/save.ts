import { AnalysisDetails, MatchableIndicatorType } from "@scamshield/shared";
import { analyses, analysisIndicators } from "../db/schema";
import type { Db } from "../rate-limit";
import type { AnalysisOutcome } from "./analyze";

/**
 * Stores one analysis and its matchable indicators in a single transaction (data-model §4).
 * Only redacted content is available to write; the original text never reaches this function.
 */
export async function saveAnalysis(outcome: AnalysisOutcome, deps: { db: Db }): Promise<void> {
  const { result, trace, record } = outcome;
  // Parsed on the way in (DB-02).
  const details = AnalysisDetails.parse({
    signals: result.signals,
    indicators: result.indicators,
    explanation: result.explanation,
    recommendations: result.recommendations,
  });
  const matchable = result.indicators.flatMap((i) => {
    const type = MatchableIndicatorType.safeParse(i.type);
    return type.success
      ? [{ analysisId: result.analysisId, type: type.data, normalized: i.normalized }]
      : [];
  });

  await deps.db.transaction(async (tx) => {
    await tx.insert(analyses).values({
      id: result.analysisId,
      redactedContent: record.redactedContent,
      redactionCounts: result.redactions,
      verdict: result.verdict,
      rule: result.rule,
      inconclusiveReason: result.inconclusiveReason,
      riskTypes: result.riskTypes,
      details,
      promptVersion: result.promptVersion,
      rulesVersion: result.rulesVersion,
      modelSignals: record.modelSignals,
      modelExplain: record.modelExplain,
      trace,
      latencyMs: Math.max(0, Math.round(trace.steps.totalMs)),
      createdAt: new Date(result.createdAt),
    });
    if (matchable.length > 0) await tx.insert(analysisIndicators).values(matchable);
  });
}
