import { analyzeMessage } from "@scamshield/core";
import { AnalysisResult, ApiError, BRANDS, URL_LISTS } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/analyses/route";
import { handleCreateAnalysis, type AnalysisServices } from "../../src/server/analyses";

const ENV = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db",
  GROQ_API_KEY: "test-key",
  GROQ_MODEL_SIGNALS: "m-signals",
  GROQ_MODEL_EXPLAIN: "m-explain",
  RATE_LIMIT_SALT: "s".repeat(32),
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Real pipeline with a fake model; no network, no database. */
function fakeServices(over: Partial<AnalysisServices> = {}) {
  const llm = vi.fn(async () => ({
    ok: true as const,
    text: '{"signals":[],"mentionedBrands":[],"explanation":"Chưa thấy dấu hiệu rủi ro."}',
    usage: { input: 1, output: 1 },
    latencyMs: 1,
    finishReason: "stop",
  }));
  const services = {
    consume: vi.fn(async () => ({ allowed: true })),
    analyze: vi.fn((content: string, startedAt: number) =>
      analyzeMessage(
        content,
        {
          llm: { chatJson: llm },
          models: { signals: "m-signals", explain: "m-explain" },
          brands: BRANDS,
          urlLists: URL_LISTS,
          now: () => new Date(),
          random: () => "abc",
          newId: () => crypto.randomUUID(),
        },
        { startedAt },
      ),
    ),
    save: vi.fn(async () => {}),
    ...over,
  } satisfies AnalysisServices;
  return { services, llm };
}

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/analyses", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function errorOf(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return ApiError.parse(await response.json()).error;
}

describe("POST /api/analyses", () => {
  it("SO-01-AC01: answers 200 with a result and stores it, without any login", async () => {
    const { services } = fakeServices();
    const response = await handleCreateAnalysis(
      post({ content: "Chiều mai mình hẹn nhau uống cà phê nhé bạn" }),
      { env: ENV, services },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(AnalysisResult.parse(body)).toMatchObject({ verdict: "no_signal" });
    expect(body).not.toHaveProperty("trace");
    expect(body).not.toHaveProperty("redactedContent");
    expect(services.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["empty", { content: "   " }, "Hãy dán nội dung tin nhắn cần kiểm tra."],
    ["too long", { content: "a".repeat(2001) }, "Nội dung quá dài. Tối đa 2.000 ký tự."],
    ["not a string", { content: 5 }, "Dữ liệu gửi lên chưa hợp lệ."],
    ["unknown field", { content: "a", x: 1 }, "Dữ liệu gửi lên chưa hợp lệ."],
    ["not JSON", "{", "Dữ liệu gửi lên chưa hợp lệ."],
    ["oversized body", { content: "a".repeat(70_000) }, "Dữ liệu gửi lên chưa hợp lệ."],
  ])("SO-01-AC02: %s → 400 without calling the model", async (_, body, message) => {
    const { services, llm } = fakeServices();
    const response = await handleCreateAnalysis(post(body), { env: ENV, services });
    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatchObject({ code: "validation_failed", message });
    expect(llm).not.toHaveBeenCalled();
    expect(services.save).not.toHaveBeenCalled();
  });

  it("SO-01-AC04: over the limit → 429 with the exact sentence, no analysis", async () => {
    const { services, llm } = fakeServices({ consume: async () => ({ allowed: false }) });
    const response = await handleCreateAnalysis(post({ content: "xin chào" }), {
      env: ENV,
      services,
    });
    expect(response.status).toBe(429);
    expect(await errorOf(response)).toEqual({
      code: "rate_limited",
      message: "Bạn đang gửi quá nhanh, thử lại sau ít phút",
    });
    expect(services.analyze).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
  });

  it("counts by a keyed hash of the first forwarded address, never the address", async () => {
    const { services } = fakeServices();
    await handleCreateAnalysis(
      post({ content: "" }, { "x-forwarded-for": "203.0.113.4, 10.0.0.1" }),
      { env: ENV, services },
    );
    await handleCreateAnalysis(post({ content: "" }, { "x-forwarded-for": "203.0.113.4" }), {
      env: ENV,
      services,
    });
    const [first, second] = vi.mocked(services.consume).mock.calls;
    expect(first?.[0]).toMatch(/^pub:[0-9a-f]{64}$/);
    expect(first?.[0]).toBe(second?.[0]);
  });

  it.each([
    ["the counter fails", { consume: () => Promise.reject(new Error("db: secret-host")) }],
    ["the counter hangs", { consume: () => new Promise<never>(() => {}) }],
    ["the analysis throws", { analyze: () => Promise.reject(new Error("secret-key")) }],
    ["storing fails", { save: () => Promise.reject(new Error("db: secret-host")) }],
  ])("when %s → 500 internal, nothing leaked", async (_, over) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { services } = fakeServices(over);
    const response = await handleCreateAnalysis(post({ content: "nội dung riêng tư" }), {
      env: ENV,
      services,
      rateLimitTimeoutMs: 20,
    });
    expect(response.status).toBe(500);
    const everything = JSON.stringify([await errorOf(response), log.mock.calls]);
    expect(everything).not.toContain("secret");
    expect(everything).not.toContain("riêng tư");
  });

  it("answers 500 when configuration is missing, through the real route", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("GROQ_API_KEY", "");
    const response = await POST(post({ content: "xin chào" }));
    expect(response.status).toBe(500);
  });
});
