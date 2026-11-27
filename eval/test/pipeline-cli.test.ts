import { describe, expect, it } from "vitest";
import { ArgError, parsePipelineArgs } from "../src/args";
import { parsePipelineEvalEnv } from "../src/env";
import { formatB4Row, type RunMeta } from "../src/pipeline-report";
import { scorePipeline } from "../src/pipeline-score";

describe("parsePipelineArgs", () => {
  it("defaults to three runs, a 2 s gap and no permission to call the provider", () => {
    expect(parsePipelineArgs(["--set", "dev"])).toEqual({ runs: 3, gapMs: 2000, confirm: false });
    expect(
      parsePipelineArgs(["--set", "dev", "--runs", "1", "--gap-ms", "65000", "--yes"]),
    ).toEqual({ runs: 1, gapMs: 65_000, confirm: true });
  });

  it("SO-09-AC02: cannot run the held-out set, whose guards are not built", () => {
    expect(() => parsePipelineArgs(["--set", "heldout"])).toThrow(/T-103/);
  });

  it("rejects a missing or unknown set and bad numbers", () => {
    for (const argv of [
      [],
      ["--set", "all"],
      ["--set", "dev", "--runs", "0"],
      ["--set", "dev", "--gap-ms=-1"],
    ]) {
      expect(() => parsePipelineArgs(argv)).toThrow(ArgError);
    }
  });

  it("has no flag that points it at another case file", () => {
    expect(() => parsePipelineArgs(["--set", "dev", "--cases", "x.jsonl"])).toThrow(/--cases/);
  });
});

describe("parsePipelineEvalEnv", () => {
  it("needs the same model settings as production and defaults the reasoning effort", () => {
    const env = { GROQ_API_KEY: "k", GROQ_MODEL_SIGNALS: "a", GROQ_MODEL_EXPLAIN: "b" };
    const parsed = parsePipelineEvalEnv({ ...env, GROQ_REASONING_EFFORT: "" });
    expect(parsed.success && parsed.data.GROQ_REASONING_EFFORT).toBe("low");
    expect(parsePipelineEvalEnv({ ...env, GROQ_MODEL_EXPLAIN: "" }).success).toBe(false);
  });
});

describe("formatB4Row (research B.4)", () => {
  const meta: RunMeta = {
    date: "2026-11-27",
    set: "dev",
    commit: "abc1234",
    dirty: true,
    models: { signals: "m-a", explain: "m-a" },
    promptVersion: "signals-v1+explain-v3",
    rulesVersion: "rules-v1",
    interrupted: false,
  };
  const score = scorePipeline(
    [
      {
        caseId: "dev-001",
        run: 1,
        at: "2026-11-27T00:00:00.000Z",
        verdict: "high_risk",
        inconclusiveReason: null,
        rule: "R3",
        signals: [],
        explanation: "Giải thích.",
        explanationFailure: null,
        signalsFailure: null,
        signalAttempts: 1,
        droppedSignals: 0,
        llmCalls: 2,
        latencyMs: 4049,
        providerFailures: [],
      },
    ],
    [
      {
        id: "dev-001",
        group: "clear_scam",
        content: "x",
        expectedVerdicts: ["high_risk"],
        expectedSignals: [],
        forbiddenSignals: [],
        notes: "",
      },
    ],
  );

  it("SO-09-AC04: fills all fourteen columns, with counts and a dash for an empty metric", () => {
    const cells = formatB4Row(meta, score)
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    expect(cells).toHaveLength(14);
    expect(cells.slice(0, 12)).toEqual([
      "2026-11-27",
      "dev",
      "abc1234 (cây làm việc có thay đổi)",
      "m-a",
      "signals-v1+explain-v3 / rules-v1",
      "100% (1/1)",
      "100% (1/1)",
      "— (0/0)",
      "100% (2/2)",
      "— (0/0)",
      "— (0/0)",
      "4,0 s / 4,0 s",
    ]);
    expect(cells[13]).toContain("0/1 lượt mất verdict");
  });
});
