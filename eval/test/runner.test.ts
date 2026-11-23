import { describe, expect, it, vi } from "vitest";
import {
  EXPLANATION_MAX_TOKENS,
  SIGNALS_MAX_TOKENS,
  type ChatJsonRequest,
  type ChatJsonResult,
} from "@scamshield/core";
import { parseQ08Args, pricesFor, ArgError } from "../src/args";
import { estimateRun } from "../src/estimate";
import { labelExplanationInput } from "../src/explanation-input";
import { buildTasks, runAll, runTask, taskKey } from "../src/runner";
import { formatGradingSheet, formatSummary, hasGradedScores } from "../src/report";
import { gradingSheetPath } from "../src/cache";
import { scoreModel } from "../src/score";
import type { EvalCase } from "../src/case";

const c1: EvalCase = {
  id: "dev-001",
  group: "clear_scam",
  content: "[Ví XYZ] Khoá trong 2 giờ, nhập mã OTP tại vi-xac-minh.example",
  expectedVerdicts: ["high_risk"],
  expectedSignals: ["urgency", "brand_domain_mismatch"],
  forbiddenSignals: [],
  notes: "",
};
const c2: EvalCase = { ...c1, id: "dev-002" };

/** Fake model: signals step then explanation step, keyed off the system prompt. No network. */
function fakeLlm(opts: { rateLimitFirst?: boolean } = {}) {
  const seen: ChatJsonRequest[] = [];
  let limited = false;
  return {
    seen,
    chatJson: vi.fn(async (req: ChatJsonRequest): Promise<ChatJsonResult> => {
      seen.push(req);
      if (opts.rateLimitFirst && !limited) {
        limited = true;
        return { ok: false, kind: "unavailable", status: 429, retryAfterMs: 10, latencyMs: 1 };
      }
      const isSignals = req.system.includes("bộ trích tín hiệu");
      const text = isSignals
        ? JSON.stringify({
            signals: [{ type: "urgency", evidence: "Khoá trong 2 giờ" }],
            mentionedBrands: ["Ví XYZ"],
          })
        : JSON.stringify({ explanation: "Tin tạo áp lực thời gian." });
      return {
        ok: true,
        text,
        usage: { input: 10, output: 5 },
        latencyMs: 50,
        finishReason: "stop",
      };
    }),
  };
}
const deps = (llm: ReturnType<typeof fakeLlm>) => ({
  llm,
  now: () => new Date(1_000_000),
  random: () => "r4nd",
  sleep: async () => {},
});

describe("runner", () => {
  it("runs both steps for a task and keeps raw results", async () => {
    const llm = fakeLlm();
    const record = await runTask({ model: "m", case: c1, run: 1 }, deps(llm));
    expect(record.signals).toMatchObject({ ok: true, signals: [{ type: "urgency" }] });
    expect(record.explanation).toMatchObject({ ok: true });
    expect(record.raw.map((r) => r.step)).toEqual(["signals", "explain"]);
    expect(record.rateLimited).toBe(0);
  });

  it("feeds the explanation step from the labels, never the message text", async () => {
    const llm = fakeLlm();
    await runTask({ model: "m", case: c1, run: 1 }, deps(llm));
    const explainReq = llm.seen[1]!;
    expect(explainReq.user).toContain('"rule":"label"');
    expect(explainReq.user).not.toContain("vi-xac-minh.example");
    expect(labelExplanationInput(c1).signals).toEqual([
      { type: "urgency", source: "ai", evidence: null },
      { type: "brand_domain_mismatch", source: "deterministic", evidence: null },
    ]);
  });

  it("waits out a 429 and counts it separately from attempts", async () => {
    const llm = fakeLlm({ rateLimitFirst: true });
    const record = await runTask({ model: "m", case: c1, run: 1 }, deps(llm));
    expect(record.rateLimited).toBe(1);
    expect(record.signals).toMatchObject({ ok: true, attempts: 1 });
  });

  it("buildTasks expands model × case × run and skips finished ones (resume)", () => {
    const all = buildTasks(["a", "b"], [c1, c2], 3);
    expect(all).toHaveLength(12);
    const done = new Set([taskKey({ model: "a", caseId: "dev-001", run: 1 })]);
    expect(buildTasks(["a", "b"], [c1, c2], 3, done)).toHaveLength(11);
  });

  it("runAll never exceeds the concurrency bound and stops on request", async () => {
    let active = 0;
    let peak = 0;
    const llm = {
      chatJson: vi.fn(async (req: ChatJsonRequest): Promise<ChatJsonResult> => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        const isSignals = req.system.includes("bộ trích tín hiệu");
        return {
          ok: true,
          text: isSignals ? '{"signals":[],"mentionedBrands":[]}' : '{"explanation":"ok"}',
          usage: { input: 1, output: 1 },
          latencyMs: 1,
          finishReason: "stop",
        };
      }),
    };
    const records: string[] = [];
    await runAll(buildTasks(["m"], [c1, c2], 3), deps(llm as never), {
      concurrency: 2,
      onRecord: (r) => void records.push(r.caseId),
    });
    expect(records).toHaveLength(6);
    expect(peak).toBeLessThanOrEqual(2 * 1); // 2 workers, each running one call at a time

    let stop = false;
    const first: string[] = [];
    await runAll(buildTasks(["m"], [c1, c2], 3), deps(llm as never), {
      concurrency: 1,
      shouldStop: () => stop,
      onRecord: (r) => {
        first.push(r.caseId);
        stop = true;
      },
    });
    expect(first).toHaveLength(1);
  });

  it("scores records produced by the runner end to end", async () => {
    const llm = fakeLlm();
    const record = await runTask({ model: "m", case: c1, run: 1 }, deps(llm));
    const score = scoreModel("m", [c1], [record]);
    expect(score.recall).toEqual({ found: 1, expected: 1, rate: 1 });
    expect(formatSummary([score])).toContain("Model: m");
    expect(formatGradingSheet("m", [c1], [record])).toContain("Tin tạo áp lực thời gian.");
  });
});

describe("grading sheet", () => {
  it("is keyed by model, case-file hash and prompt versions so runs never share a sheet", () => {
    const a = gradingSheetPath("d", "openai/gpt-oss-20b", "5218bec8ffff", "signals-v1-explain-v3");
    const b = gradingSheetPath("d", "openai/gpt-oss-20b", "5218bec8ffff", "signals-v1-explain-v4");
    expect(a).toBe("d/q08-grading-openai_gpt-oss-20b__5218bec8__signals-v1-explain-v3.md");
    expect(b).not.toBe(a);
  });

  it("detects hand-entered scores and treats a blank sheet as ungraded", () => {
    const blank = formatGradingSheet("m", [c1], []);
    expect(hasGradedScores(blank)).toBe(false);
    expect(hasGradedScores("## dev-001\n- Điểm: _\n")).toBe(false);
    expect(hasGradedScores("## dev-001\n- Điểm: \\_\n")).toBe(false);
    expect(hasGradedScores("## dev-001\n- Điểm: 3\n")).toBe(true);
    expect(hasGradedScores("## dev-001\n- Điểm: 2 (nêu sự kiện ngoài)\n")).toBe(true);
  });
});

describe("estimate and args", () => {
  it("estimate counts calls and sizes input from the real prompts", () => {
    const e = estimateRun({
      cases: [c1, c2],
      models: 3,
      runs: 3,
      prices: [
        { inPerMillion: 1, outPerMillion: 2 },
        { inPerMillion: 1, outPerMillion: 2 },
        { inPerMillion: 1, outPerMillion: 2 },
      ],
    });
    expect(e.calls).toBe(2 * 3 * 3 * 2);
    expect(e.inputTokens).toBeGreaterThan(0);
    expect(e.outputTokensMax).toBe(2 * 9 * (SIGNALS_MAX_TOKENS + EXPLANATION_MAX_TOKENS));
    expect(e.cost?.max).toBeGreaterThan(e.cost?.min ?? Infinity);
  });

  it("without --confirm the parsed args default to a dry run", () => {
    expect(parseQ08Args(["--models", "a,b"]).confirm).toBe(false);
    expect(parseQ08Args(["--models", "a,b", "--confirm", "--runs", "2"])).toMatchObject({
      models: ["a", "b"],
      runs: 2,
      confirm: true,
    });
  });

  it("validates args", () => {
    expect(() => parseQ08Args(["--runs", "0"])).toThrow(ArgError);
    expect(() => parseQ08Args(["--resume", "--fresh"])).toThrow(ArgError);
    expect(() => parseQ08Args(["--reasoning-format", "raw"])).toThrow(ArgError);
    expect(() =>
      parseQ08Args(["--models", "a,b", "--price-in", "1,2,3", "--price-out", "1"]),
    ).toThrow(ArgError);
  });

  it("expands one price to every model", () => {
    const args = parseQ08Args(["--models", "a,b", "--price-in", "0.5", "--price-out", "1,2"]);
    expect(pricesFor(args)).toEqual([
      { inPerMillion: 0.5, outPerMillion: 1 },
      { inPerMillion: 0.5, outPerMillion: 2 },
    ]);
    expect(pricesFor(parseQ08Args(["--models", "a"]))).toBeUndefined();
  });
});

describe("retry-failed and concurrency args", () => {
  it("--retry-failed needs --resume; concurrency is bounded", () => {
    expect(() => parseQ08Args(["--retry-failed"])).toThrow(ArgError);
    expect(parseQ08Args(["--resume", "--retry-failed", "--concurrency", "1"])).toMatchObject({
      retryFailed: true,
      concurrency: 1,
    });
    expect(() => parseQ08Args(["--concurrency", "9"])).toThrow(ArgError);
  });
});

describe("reusing signals from an earlier run", () => {
  it("skips the signals call and keeps the earlier signals and raw output", async () => {
    const first = fakeLlm();
    const earlier = await runTask({ model: "m", case: c1, run: 1 }, deps(first));
    const second = fakeLlm();
    const record = await runTask(
      { model: "m", case: c1, run: 1 },
      { ...deps(second), reuse: () => earlier },
    );
    expect(second.seen).toHaveLength(1); // explanation only
    expect(second.seen[0]?.system).toContain("giải thích");
    expect(record.signals).toEqual(earlier.signals);
    expect(record.raw.map((r) => r.step)).toEqual(["signals", "explain"]);
  });
});
