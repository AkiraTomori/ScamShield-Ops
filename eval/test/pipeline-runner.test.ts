import type { ChatJsonRequest, ChatJsonResult } from "@scamshield/core";
import { BRANDS, URL_LISTS } from "@scamshield/shared";
import { describe, expect, it, vi } from "vitest";
import type { EvalCase } from "../src/case";
import type { PipelineRunRecord } from "../src/pipeline-record";
import { createEvalPipelineDeps, runPipeline, runPipelineCase } from "../src/pipeline-runner";

const CASE: EvalCase = {
  id: "dev-001",
  group: "clear_scam",
  content: "Tài khoản sẽ bị khoá trong 2 giờ. Xác minh tại vi-xac-minh.example và nhập mã OTP.",
  expectedVerdicts: ["high_risk", "suspicious"],
  expectedSignals: [],
  forbiddenSignals: [],
  notes: "",
};

const ok = (text: string): ChatJsonResult => ({
  ok: true,
  text,
  usage: { input: 10, output: 5 },
  latencyMs: 100,
  finishReason: "stop",
});

/** Fake model on a fake clock: every call takes 400 ms. */
function setup(reply?: ChatJsonResult) {
  const clock = { t: Date.parse("2026-11-27T03:00:00Z") };
  const chatJson = vi.fn(async (req: ChatJsonRequest) => {
    clock.t += 400;
    if (reply) return reply;
    return req.model === "m-explain"
      ? ok('{"explanation":"Tin tạo áp lực và đòi mã xác thực."}')
      : ok(
          '{"signals":[{"type":"urgency","evidence":"trong 2 giờ"},{"type":"credential_request","evidence":"nhập mã OTP"}],"mentionedBrands":[]}',
        );
  });
  const deps = createEvalPipelineDeps({
    llm: { chatJson },
    models: { signals: "m-signals", explain: "m-explain" },
    reasoningEffort: "low",
    now: () => new Date(clock.t),
  });
  return { deps, chatJson };
}

describe("eval pipeline deps (eval-suite §3.1)", () => {
  it("uses the production data files and has no lookup, daily cap or database", () => {
    const { deps } = setup();
    expect(deps.brands).toBe(BRANDS);
    expect(deps.urlLists).toBe(URL_LISTS);
    expect(deps.llmOptions).toEqual({ reasoningEffort: "low" });
    for (const key of ["lookupDomain", "reserveLlmCall", "database"]) {
      expect(deps).not.toHaveProperty(key);
    }
  });

  it("SO-08-AC02: uses an empty confirmed list, so results do not depend on any database", async () => {
    const { deps } = setup();
    expect(
      await deps.verifiedIndicators([{ type: "domain", normalized: "vi-xac-minh.example" }]),
    ).toEqual([]);
  });
});

describe("runPipelineCase", () => {
  it("SO-09-AC03: records what the whole pipeline decided for the case", async () => {
    const { deps } = setup();
    await expect(runPipelineCase(CASE, 2, deps)).resolves.toMatchObject({
      caseId: "dev-001",
      run: 2,
      at: "2026-11-27T03:00:00.000Z",
      verdict: "high_risk",
      inconclusiveReason: null,
      signals: expect.arrayContaining(["urgency", "credential_request"]),
      explanation: "Tin tạo áp lực và đòi mã xác thực.",
      explanationFailure: null,
      signalsFailure: null,
      signalAttempts: 1,
      llmCalls: 2,
      latencyMs: 800,
      providerFailures: [],
    });
  });

  it("EV-03: keeps a 429 as the outcome of the run, without waiting and retrying", async () => {
    const { deps, chatJson } = setup({
      ok: false,
      kind: "unavailable",
      status: 429,
      latencyMs: 5,
    });
    await expect(runPipelineCase(CASE, 1, deps)).resolves.toMatchObject({
      signalsFailure: "llm_unavailable",
      providerFailures: ["unavailable_429"],
      llmCalls: 1,
    });
    expect(chatJson).toHaveBeenCalledTimes(1);
  });
});

describe("runPipeline", () => {
  it("runs one analysis at a time, skips finished ones and pauses only in between", async () => {
    const { deps } = setup();
    const order: string[] = [];
    const records: PipelineRunRecord[] = [];
    await runPipeline([CASE, { ...CASE, id: "dev-002" }], 2, deps, {
      gapMs: 2000,
      done: new Set(["dev-001#2"]),
      sleep: async (ms) => void order.push(`sleep ${ms}`),
      onRecord: (r) => {
        records.push(r);
        order.push(`${r.caseId} run ${r.run}`);
      },
    });
    expect(order).toEqual([
      "dev-001 run 1",
      "sleep 2000",
      "dev-002 run 1",
      "sleep 2000",
      "dev-002 run 2",
    ]);
    expect(records).toHaveLength(3);
  });
});
