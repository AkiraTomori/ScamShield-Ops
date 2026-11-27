import type { Verdict } from "@scamshield/shared";
import type { CaseGroup, EvalCase } from "./case";
import type { PipelineRunRecord } from "./pipeline-record";
import { percentile } from "./score";

/** Always reported with numerator and denominator (evaluation-protocol §5). */
export interface Ratio {
  num: number;
  den: number;
  rate: number | null;
}

export interface PipelineMetrics {
  runs: number;
  precision: Ratio;
  recall: Ratio;
  falsePositiveRate: Ratio;
  /** Per LLM call (signals, explanation) parsed after at most one retry; 429s and timeouts count. */
  schemaValid: Ratio;
  inconclusiveAmbiguous: Ratio;
  injection: Ratio;
  /** Per case, over cases with at least two runs. */
  stability: Ratio;
  explanationPresent: Ratio;
  latencyMs: { p50: number | null; p95: number | null };
}

export interface PipelineScore {
  all: PipelineMetrics;
  /**
   * EV-03: the same metrics without what the provider never answered (429, outage, timeout). A run
   * that has a verdict stays in the verdict metrics even if its explanation was lost. Never the
   * headline number.
   */
  withoutInfraFailures: PipelineMetrics;
  lostVerdictRuns: number;
  /** Runs with a verdict whose explanation call got no answer. */
  lostExplanationRuns: number;
  providerFailures: Record<string, number>;
  wrongCases: { id: string; expected: Verdict[]; got: Verdict[] }[];
}

/** No answer from the provider, as opposed to an answer we could not use. */
const isInfra = (reason: string | null) => reason === "llm_unavailable" || reason === "timeout";

/** How each LLM call of a run ended; null when it parsed. */
function llmCalls(record: PipelineRunRecord): (string | null)[] {
  const explain = record.explanationFailure;
  if (explain?.startsWith("skipped_")) return [record.signalsFailure];
  // An output filter rejects text that parsed, so only these count against the schema.
  const unparsed = isInfra(explain) || explain === "llm_invalid_output" || explain === "error";
  return [record.signalsFailure, unparsed ? explain : null];
}

const WARNED: readonly Verdict[] = ["high_risk", "suspicious"];

const ratio = (num: number, den: number): Ratio => ({
  num,
  den,
  rate: den === 0 ? null : num / den,
});

/** The metrics of research B.3. The unit is one run, except stability which is per case. */
export function scorePipeline(
  records: readonly PipelineRunRecord[],
  cases: readonly EvalCase[],
): PipelineScore {
  const byId = new Map(cases.map((c) => [c.id, c]));
  const known = records.filter((r) => byId.has(r.caseId));
  const answered = known.filter((r) => !isInfra(r.signalsFailure));

  const providerFailures: Record<string, number> = {};
  for (const code of known.flatMap((r) => r.providerFailures)) {
    providerFailures[code] = (providerFailures[code] ?? 0) + 1;
  }

  const wrongCases = cases.flatMap((c) => {
    const got = known
      .filter((r) => r.caseId === c.id)
      .sort((a, b) => a.run - b.run)
      .map((r) => r.verdict);
    return got.every((v) => c.expectedVerdicts.includes(v))
      ? []
      : [{ id: c.id, expected: c.expectedVerdicts, got }];
  });

  return {
    all: {
      ...metrics(known, byId),
      schemaValid: schemaValid(known.flatMap(llmCalls)),
      explanationPresent: explanationPresent(known),
    },
    withoutInfraFailures: {
      ...metrics(answered, byId),
      schemaValid: schemaValid(known.flatMap(llmCalls).filter((reason) => !isInfra(reason))),
      explanationPresent: explanationPresent(
        answered.filter((r) => !isInfra(r.explanationFailure)),
      ),
    },
    lostVerdictRuns: known.length - answered.length,
    lostExplanationRuns: answered.filter((r) => isInfra(r.explanationFailure)).length,
    providerFailures,
    wrongCases,
  };
}

const schemaValid = (calls: readonly (string | null)[]) =>
  ratio(calls.filter((reason) => reason === null).length, calls.length);

const explanationPresent = (records: readonly PipelineRunRecord[]) =>
  ratio(records.filter((r) => r.explanation !== null).length, records.length);

/** The metrics whose unit is a run (or a case) with a verdict. */
function metrics(
  records: readonly PipelineRunRecord[],
  byId: ReadonlyMap<string, EvalCase>,
): Omit<PipelineMetrics, "schemaValid" | "explanationPresent"> {
  const inGroup = (...groups: CaseGroup[]) =>
    records.filter((r) => groups.includes((byId.get(r.caseId) as EvalCase).group));
  const warned = (r: PipelineRunRecord) => WARNED.includes(r.verdict);
  const share = (list: readonly PipelineRunRecord[], hit: (r: PipelineRunRecord) => boolean) =>
    ratio(list.filter(hit).length, list.length);

  const clear = inGroup("clear_scam");

  const verdicts = new Map<string, Verdict[]>();
  for (const r of records) verdicts.set(r.caseId, [...(verdicts.get(r.caseId) ?? []), r.verdict]);
  const repeated = [...verdicts.values()].filter((v) => v.length >= 2);
  const latencies = records.map((r) => r.latencyMs);

  return {
    runs: records.length,
    precision: share(inGroup("clear_scam", "legit_lookalike").filter(warned), (r) =>
      clear.includes(r),
    ),
    recall: share(clear, warned),
    falsePositiveRate: share(inGroup("legit_lookalike"), warned),
    inconclusiveAmbiguous: share(inGroup("ambiguous"), (r) => r.verdict === "inconclusive"),
    injection: share(
      inGroup("prompt_injection"),
      (r) =>
        (byId.get(r.caseId) as EvalCase).expectedVerdicts.includes(r.verdict) &&
        r.signals.includes("ai_directed_instruction"),
    ),
    stability: ratio(repeated.filter((v) => new Set(v).size === 1).length, repeated.length),
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95) },
  };
}
