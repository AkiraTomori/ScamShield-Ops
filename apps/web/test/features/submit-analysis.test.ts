import { describe, expect, it } from "vitest";
import { ERROR_MESSAGE_VI } from "@scamshield/shared";
import { submitAnalysis } from "../../src/features/analysis/submit-analysis";

const RESULT = {
  analysisId: "3f0c2a5e-1c1e-4a57-9a5e-0d6a5a1f2b3c",
  verdict: "no_signal",
  inconclusiveReason: null,
  riskTypes: [],
  signals: [],
  indicators: [],
  explanation: null,
  recommendations: ["Kiểm tra qua kênh chính thức.", "Không chia sẻ mã OTP."],
  redactions: { otp: 0, password: 0, card: 0 },
  rule: "R9",
  promptVersion: "signals-v1",
  rulesVersion: "rules-v1",
  createdAt: "2026-11-27T10:00:00.000Z",
};

const answering =
  (body: unknown, status = 200) =>
  async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

/** Never answers; rejects when the request is aborted, as `fetch` does. */
const hanging: typeof fetch = (_, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")));
  });

describe("submitAnalysis", () => {
  it("SO-01-AC01: posts the content and returns the parsed result", async () => {
    const calls: [unknown, RequestInit | undefined][] = [];
    const outcome = await submitAnalysis("tin nhắn", {
      fetchImpl: async (url, init) => {
        calls.push([url, init]);
        return answering(RESULT)();
      },
    });
    expect(outcome).toEqual({ kind: "ok", result: RESULT });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("/api/analyses");
    expect(calls[0]?.[1]?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.[1]?.body))).toEqual({ content: "tin nhắn" });
  });

  it("SO-01-AC02: passes on the server's wording for a 400", async () => {
    const message = "Nội dung quá dài. Tối đa 2.000 ký tự.";
    const fetchImpl = answering({ error: { code: "validation_failed", message } }, 400);
    expect(await submitAnalysis("x", { fetchImpl })).toEqual({ kind: "invalid", message });
  });

  it("falls back to the generic wording when a 400 has no readable body", async () => {
    expect(await submitAnalysis("x", { fetchImpl: answering("<html>", 400) })).toEqual({
      kind: "invalid",
      message: ERROR_MESSAGE_VI.validation_failed,
    });
  });

  it("SO-01-AC04: reports a 429 as rate limited", async () => {
    expect(await submitAnalysis("x", { fetchImpl: answering({}, 429) })).toEqual({
      kind: "rate_limited",
    });
  });

  it.each([
    ["a server error", answering({ error: { code: "internal", message: "…" } }, 500)],
    ["a 200 that does not match the schema", answering({ ...RESULT, score: 0.9 })],
    ["a 200 that is not JSON", answering("<html>")],
    [
      "a network failure",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("treats %s as failed, never as a result", async (_, fetchImpl) => {
    expect(await submitAnalysis("x", { fetchImpl })).toEqual({ kind: "failed" });
  });

  it("SO-03-AC06: gives up after the client timeout", async () => {
    expect(await submitAnalysis("x", { fetchImpl: hanging, timeoutMs: 5 })).toEqual({
      kind: "failed",
    });
  });

  it("answers 'aborted' when the caller cancels, so nothing is shown", async () => {
    const controller = new AbortController();
    const pending = submitAnalysis("x", { fetchImpl: hanging, signal: controller.signal });
    controller.abort();
    expect(await pending).toEqual({ kind: "aborted" });
  });
});
