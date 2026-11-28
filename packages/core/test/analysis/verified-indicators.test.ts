import { URL_LISTS, type BrandList } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeMessage, VERIFIED_LOOKUP_TIMEOUT_MS, type AnalysisDeps } from "../../src/analysis";
import type { ChatJsonResult } from "../../src/llm";
import { okText } from "../llm/helpers";

// The confirmed list inside the pipeline (SO-08-AC02, verified-indicators §3), with fake I/O.

const FAKE: BrandList = [
  { id: "vi-xyz", name: "Ví XYZ", kind: "wallet", aliases: ["Ví XYZ"], domains: ["vixyz.example"] },
];
const MESSAGE =
  "Bạn được hoàn tiền, xem tại https://nhan.vi-xac-minh.example/a, gọi 0900 000 001, STK 000123456789";
const DOMAIN = { type: "domain", normalized: "vi-xac-minh.example" } as const;
const VERIFIED_CHECK = { type: "verified_indicator", status: "warn", detail: null };

const NO_SIGNALS = okText('{"signals":[],"mentionedBrands":[]}');
const MODEL_DOWN: ChatJsonResult = { ok: false, kind: "unavailable", latencyMs: 1 };

function setup(verified: AnalysisDeps["verifiedIndicators"], reply: ChatJsonResult = NO_SIGNALS) {
  const chatJson = vi.fn(async (req: { model: string }) =>
    req.model === "m-explain" ? okText('{"explanation":"Giải thích."}') : reply,
  );
  const log = vi.fn();
  const deps: AnalysisDeps = {
    llm: { chatJson },
    models: { signals: "m-signals", explain: "m-explain" },
    brands: FAKE,
    urlLists: URL_LISTS,
    verifiedIndicators: verified,
    now: () => new Date("2026-11-28T03:00:00Z"),
    random: () => "abc123",
    newId: () => "6f1c0b1e-5a3e-4e7b-9d0a-2c6f1b8a9d10",
    log,
  };
  return { deps, chatJson, log };
}

const listed =
  (...matches: Awaited<ReturnType<AnalysisDeps["verifiedIndicators"]>>) =>
  async () =>
    matches;

const checksOf = (result: { indicators: { type: string; checks: unknown[] }[] }, type: string) =>
  result.indicators.find((i) => i.type === type)?.checks ?? [];

afterEach(() => {
  vi.useRealTimers();
});

describe("confirmed indicators in the pipeline", () => {
  it("SO-08-AC02: a match adds the check, the signal and high_risk by R1", async () => {
    const { deps } = setup(listed(DOMAIN));
    const { result } = await analyzeMessage(MESSAGE, deps);

    expect(result).toMatchObject({ verdict: "high_risk", rule: "R1", inconclusiveReason: null });
    expect(result.signals[0]).toEqual({
      type: "verified_indicator",
      source: "deterministic",
      evidence: "vi-xac-minh.example",
      indicator: "vi-xac-minh.example",
    });
    expect(result.signals.filter((s) => s.type === "verified_indicator")).toHaveLength(1);
    expect(checksOf(result, "domain")).toContainEqual(VERIFIED_CHECK);
    // The domain's own checks stay.
    expect(checksOf(result, "domain").length).toBeGreaterThan(1);
  });

  it("SO-08-AC02: phone numbers and bank accounts get the check too", async () => {
    const { deps } = setup(
      listed(
        { type: "phone", normalized: "+84900000001" },
        { type: "bank_account", normalized: "000123456789" },
      ),
    );
    const { result } = await analyzeMessage(MESSAGE, deps);
    expect(checksOf(result, "phone")).toEqual([VERIFIED_CHECK]);
    expect(checksOf(result, "bank_account")).toEqual([VERIFIED_CHECK]);
    expect(result.signals.map((s) => s.indicator)).toEqual(
      expect.arrayContaining(["+84900000001", "000123456789"]),
    );
    expect(result.rule).toBe("R1");
  });

  it("P-01: stays high_risk when the model fails, and says the AI part did not run", async () => {
    const { deps } = setup(listed(DOMAIN), MODEL_DOWN);
    const { result } = await analyzeMessage(MESSAGE, deps);
    expect(result).toMatchObject({
      verdict: "high_risk",
      rule: "R1",
      inconclusiveReason: "llm_unavailable",
      explanation: null,
    });
  });

  it("matches on type as well as value", async () => {
    const { deps } = setup(listed({ type: "bank_account", normalized: "+84900000001" }));
    const { result } = await analyzeMessage(MESSAGE, deps);
    expect(checksOf(result, "phone")).toEqual([]);
    expect(result.signals.map((s) => s.type)).not.toContain("verified_indicator");
  });

  it("adds nothing without a match: there is no passing check", async () => {
    const { deps } = setup(listed());
    const { result } = await analyzeMessage(MESSAGE, deps);
    expect(JSON.stringify(result)).not.toContain("verified_indicator");
    expect(result.rule).not.toBe("R1");
  });

  it("asks once, with the domains, phone numbers and accounts of the message only", async () => {
    const verified = vi.fn<AnalysisDeps["verifiedIndicators"]>(listed());
    const { deps, chatJson } = setup(verified);
    await analyzeMessage(`Ví XYZ: ${MESSAGE}`, deps);
    expect(verified).toHaveBeenCalledTimes(1);
    expect(verified.mock.calls[0]).toEqual([
      expect.arrayContaining([
        DOMAIN,
        { type: "phone", normalized: "+84900000001" },
        { type: "bank_account", normalized: "000123456789" },
      ]),
    ]);
    expect(verified.mock.calls[0]![0]).toHaveLength(3);
    expect(verified.mock.invocationCallOrder[0]!).toBeLessThan(
      chatJson.mock.invocationCallOrder[0]!,
    );
  });

  it("does not ask when the message has nothing to look up", async () => {
    const verified = vi.fn(listed());
    const { deps } = setup(verified);
    await analyzeMessage("Chiều mai mình hẹn nhau uống cà phê nhé bạn", deps);
    expect(verified).not.toHaveBeenCalled();
  });

  it("fails the analysis, before any model call, when the list cannot be read", async () => {
    const { deps, chatJson, log } = setup(async () => {
      // A driver error carries the query's values: it must not travel on.
      throw new Error("select … params: 0900000001");
    });
    await expect(analyzeMessage(MESSAGE, deps)).rejects.toThrow(/^verified_lookup_failed$/);
    expect(chatJson).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith({ event: "verified_lookup_failed" });
  });

  it("gives the lookup one second", async () => {
    vi.useFakeTimers();
    const { deps, chatJson } = setup(() => new Promise(() => {}));
    const outcome = expect(analyzeMessage(MESSAGE, deps)).rejects.toThrow("verified_lookup_failed");
    await vi.advanceTimersByTimeAsync(VERIFIED_LOOKUP_TIMEOUT_MS);
    await outcome;
    expect(VERIFIED_LOOKUP_TIMEOUT_MS).toBe(1_000);
    expect(chatJson).not.toHaveBeenCalled();
  });
});
