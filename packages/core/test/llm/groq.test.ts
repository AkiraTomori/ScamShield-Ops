import { describe, expect, it, vi } from "vitest";
import { createHttpClient } from "../../src/http";
import { createGroqClient, GroqConfigError, GROQ_ALLOWED_HOSTS } from "../../src/llm";

const KEY = "gsk_test_SECRET_KEY";
const req = (over = {}) => ({
  model: "m",
  system: "sys",
  user: "usr",
  maxTokens: 100,
  signal: new AbortController().signal,
  ...over,
});

function clientFor(fetchImpl: typeof fetch) {
  const http = createHttpClient({ allowedHosts: GROQ_ALLOWED_HOSTS, fetchImpl });
  return createGroqClient({ apiKey: KEY, http, monotonicNow: () => 0 });
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers }));

describe("groq client", () => {
  it("sends the documented chat request and parses the reply", async () => {
    const fetchImpl = json(200, {
      choices: [{ message: { content: '{"a":1}' }, finish_reason: "stop" }],
      usage: { prompt_tokens: 11, completion_tokens: 7 },
    });
    const res = await clientFor(fetchImpl).chatJson(req());
    expect(res).toMatchObject({
      ok: true,
      text: '{"a":1}',
      usage: { input: 11, output: 7 },
      finishReason: "stop",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: "m",
      temperature: 0,
      max_completion_tokens: 100,
      response_format: { type: "json_object" },
    });
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "usr" },
    ]);
  });

  it("omits response_format when jsonMode is off, and passes reasoning options only when given", async () => {
    const fetchImpl = json(200, { choices: [{ message: { content: "{}" } }] });
    await clientFor(fetchImpl).chatJson(req({ jsonMode: false }));
    const plain = JSON.parse(
      (fetchImpl.mock.calls[0] as unknown as [URL, RequestInit])[1].body as string,
    );
    expect(plain.response_format).toBeUndefined();
    expect(plain.reasoning_format).toBeUndefined();

    const fetch2 = json(200, { choices: [{ message: { content: "{}" } }] });
    await clientFor(fetch2).chatJson(req({ reasoningFormat: "hidden", reasoningEffort: "low" }));
    const withR = JSON.parse(
      (fetch2.mock.calls[0] as unknown as [URL, RequestInit])[1].body as string,
    );
    expect(withR).toMatchObject({ reasoning_format: "hidden", reasoning_effort: "low" });
  });

  it("treats null content as empty text", async () => {
    const res = await clientFor(json(200, { choices: [{ message: { content: null } }] })).chatJson(
      req(),
    );
    expect(res).toMatchObject({ ok: true, text: "" });
  });

  it("maps 429 to unavailable and reads retry-after", async () => {
    const res = await clientFor(json(429, { error: {} }, { "retry-after": "2" })).chatJson(req());
    expect(res).toMatchObject({ ok: false, kind: "unavailable", status: 429, retryAfterMs: 2000 });
  });

  it("maps 5xx and malformed 200 bodies to unavailable", async () => {
    expect(await clientFor(json(503, {})).chatJson(req())).toMatchObject({
      ok: false,
      kind: "unavailable",
      status: 503,
    });
    expect(await clientFor(json(200, { nope: 1 })).chatJson(req())).toMatchObject({
      ok: false,
      kind: "unavailable",
    });
  });

  it("maps network failures to unavailable and elapsed time to timeout", async () => {
    const net = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await clientFor(net).chatJson(req())).toMatchObject({ ok: false, kind: "unavailable" });

    const slow = vi.fn(
      (_u: unknown, init?: RequestInit) =>
        new Promise<Response>((_res, rej) =>
          init?.signal?.addEventListener("abort", () => rej(new DOMException("x", "AbortError"))),
        ),
    );
    const controller = new AbortController();
    const pending = clientFor(slow as unknown as typeof fetch).chatJson(
      req({ signal: controller.signal }),
    );
    controller.abort();
    expect(await pending).toMatchObject({ ok: false, kind: "timeout" });
  });

  it("maps a provider-side JSON validation failure to invalid_output, not a config error", async () => {
    const res = await clientFor(
      json(400, { error: { code: "json_validate_failed", type: "invalid_request_error" } }),
    ).chatJson(req());
    expect(res).toMatchObject({ ok: false, kind: "invalid_output", status: 400 });
  });

  it.each([401, 404, 400])(
    "throws a config error on %i, without leaking the key",
    async (status) => {
      const error = await clientFor(
        json(status, { error: { message: `bad key ${KEY}`, type: "invalid_request_error" } }),
      )
        .chatJson(req())
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(GroqConfigError);
      expect(String((error as Error).message)).not.toContain(KEY);
      expect(String((error as Error).message)).toContain(String(status));
    },
  );

  it("lists models and tolerates extra fields", async () => {
    const fetchImpl = json(200, {
      object: "list",
      data: [{ id: "a", owned_by: "x", active: true, context_window: 8192, extra: 1 }, { id: "b" }],
    });
    const models = await clientFor(fetchImpl).listModels();
    expect(models.map((m) => m.id)).toEqual(["a", "b"]);
    expect(String((fetchImpl.mock.calls[0] as unknown as [URL])[0])).toBe(
      "https://api.groq.com/openai/v1/models",
    );
  });

  it("cannot reach any host other than api.groq.com", () => {
    expect(GROQ_ALLOWED_HOSTS).toEqual(["api.groq.com"]);
  });
});
