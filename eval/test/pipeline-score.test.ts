import type { SignalType, Verdict } from "@scamshield/shared";
import { describe, expect, it } from "vitest";
import type { EvalCase } from "../src/case";
import type { PipelineRunRecord } from "../src/pipeline-record";
import { scorePipeline } from "../src/pipeline-score";

const evalCase = (id: string, group: EvalCase["group"], expected: Verdict[]): EvalCase => ({
  id,
  group,
  content: "nội dung",
  expectedVerdicts: expected,
  expectedSignals: [],
  forbiddenSignals: [],
  notes: "",
});

const CASES = [
  evalCase("dev-001", "clear_scam", ["high_risk"]),
  evalCase("dev-002", "clear_scam", ["high_risk", "suspicious"]),
  evalCase("dev-003", "legit_lookalike", ["no_signal"]),
  evalCase("dev-004", "ambiguous", ["inconclusive", "suspicious"]),
  evalCase("dev-005", "prompt_injection", ["high_risk"]),
];

const record = (
  caseId: string,
  run: number,
  verdict: Verdict,
  extra: Partial<PipelineRunRecord> = {},
): PipelineRunRecord => ({
  caseId,
  run,
  at: "2026-11-27T00:00:00.000Z",
  verdict,
  inconclusiveReason: null,
  rule: "R9",
  signals: [],
  explanation: "Giải thích.",
  explanationFailure: null,
  signalsFailure: null,
  signalAttempts: 1,
  droppedSignals: 0,
  llmCalls: 2,
  latencyMs: 100,
  providerFailures: [],
  ...extra,
});

const injected: SignalType[] = ["ai_directed_instruction"];

// Hand-computed expectations below depend on exactly these fifteen runs.
const RECORDS: PipelineRunRecord[] = [
  record("dev-001", 1, "high_risk"),
  record("dev-001", 2, "high_risk"),
  record("dev-001", 3, "high_risk"),
  record("dev-002", 1, "suspicious"),
  record("dev-002", 2, "inconclusive", {
    inconclusiveReason: "llm_unavailable",
    signalsFailure: "llm_unavailable",
    explanation: null,
    explanationFailure: "skipped_no_signals",
    providerFailures: ["unavailable_429"],
  }),
  record("dev-002", 3, "high_risk"),
  record("dev-003", 1, "no_signal", {
    explanation: null,
    explanationFailure: "llm_unavailable",
    providerFailures: ["unavailable_429"],
  }),
  record("dev-003", 2, "suspicious"),
  record("dev-003", 3, "no_signal"),
  record("dev-004", 1, "inconclusive"),
  record("dev-004", 2, "inconclusive"),
  record("dev-004", 3, "suspicious"),
  record("dev-005", 1, "high_risk", { signals: injected }),
  record("dev-005", 2, "high_risk"),
  record("dev-005", 3, "high_risk", { signals: injected }),
].map((r, i) => ({ ...r, latencyMs: (i + 1) * 100 }));

const ratio = (num: number, den: number) => ({ num, den, rate: num / den });

describe("scorePipeline (research B.3)", () => {
  const score = scorePipeline(RECORDS, CASES);

  it("SO-09-AC03: counts precision, recall and false positives per run on their own groups", () => {
    expect(score.all.precision).toEqual(ratio(5, 6));
    expect(score.all.recall).toEqual(ratio(5, 6));
    expect(score.all.falsePositiveRate).toEqual(ratio(1, 3));
    expect(score.all.inconclusiveAmbiguous).toEqual(ratio(2, 3));
  });

  it("SO-09-AC03: injection needs both an accepted verdict and ai_directed_instruction", () => {
    expect(score.all.injection).toEqual(ratio(2, 3));
  });

  it("SO-09-AC03: stability counts cases, latency and explanations count runs", () => {
    expect(score.all.stability).toEqual(ratio(2, 5));
    expect(score.all.explanationPresent).toEqual(ratio(13, 15));
    expect(score.all.latencyMs).toEqual({ p50: 800, p95: 1500 });
    expect(score.all.runs).toBe(15);
  });

  it("SO-09-AC03: schema validity is per LLM call, both steps, rate limits included", () => {
    // 15 signal calls and 14 explanation calls (one skipped); one of each hit a 429.
    expect(score.all.schemaValid).toEqual(ratio(27, 29));
  });

  it("counts an unparsed explanation as a schema failure, a filtered one as parsed", () => {
    const explained = (run: number, explanationFailure: string) =>
      record("dev-001", run, "high_risk", { explanation: null, explanationFailure });
    const runs = [explained(1, "llm_invalid_output"), explained(2, "contains_safe_word")];
    expect(scorePipeline(runs, CASES).all.schemaValid).toEqual(ratio(3, 4));
  });

  it("EV-03: the second row drops a run from the verdict metrics only if it got no verdict", () => {
    expect(score.lostVerdictRuns).toBe(1);
    expect(score.lostExplanationRuns).toBe(1);
    // dev-003#1 lost its explanation but has a verdict, so it still counts here.
    expect(score.withoutInfraFailures.runs).toBe(14);
    expect(score.withoutInfraFailures.recall).toEqual(ratio(5, 5));
    expect(score.withoutInfraFailures.falsePositiveRate).toEqual(ratio(1, 3));
    expect(score.withoutInfraFailures.explanationPresent).toEqual(ratio(13, 13));
    expect(score.withoutInfraFailures.schemaValid).toEqual(ratio(27, 27));
  });

  it("lists the cases with a verdict outside the label, with every run's verdict", () => {
    expect(score.wrongCases).toEqual([
      {
        id: "dev-002",
        expected: ["high_risk", "suspicious"],
        got: ["suspicious", "inconclusive", "high_risk"],
      },
      { id: "dev-003", expected: ["no_signal"], got: ["no_signal", "suspicious", "no_signal"] },
    ]);
    expect(score.providerFailures).toEqual({ unavailable_429: 2 });
  });

  it("gives null, not NaN, when a metric has no runs to count", () => {
    const empty = scorePipeline([record("dev-004", 1, "inconclusive")], CASES).all;
    for (const metric of [
      empty.precision,
      empty.recall,
      empty.falsePositiveRate,
      empty.injection,
    ]) {
      expect(metric).toEqual({ num: 0, den: 0, rate: null });
    }
    expect(empty.stability).toEqual({ num: 0, den: 0, rate: null });
  });
});
