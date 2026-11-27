import type { AnalysisTrace } from "@scamshield/core";
import type { InconclusiveReason, RuleCode, SignalType, Verdict } from "@scamshield/shared";

/** One (case, run) through the whole pipeline (eval-suite §3). Dev data only holds invented text. */
export interface PipelineRunRecord {
  caseId: string;
  run: number;
  at: string;
  verdict: Verdict;
  inconclusiveReason: InconclusiveReason | null;
  rule: RuleCode;
  signals: SignalType[];
  explanation: string | null;
  explanationFailure: string | null;
  signalsFailure: AnalysisTrace["signalsFailure"];
  signalAttempts: number;
  droppedSignals: number;
  llmCalls: number;
  /** `analyzeMessage` only: no network to the deployment and no database write. */
  latencyMs: number;
  /** `<kind>_<HTTP status>` of every failed provider call, e.g. `unavailable_429`. */
  providerFailures: string[];
}
