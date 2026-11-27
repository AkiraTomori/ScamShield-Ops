import type { SubmitReportResult } from "@scamshield/core";
import { ApiError, ReportResponse } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/analyses/[analysisId]/report/route";
import { handleReport, type ReportServices } from "../../src/server/reports";

const ENV = {
  DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db",
  GROQ_API_KEY: "test-key",
  GROQ_MODEL_SIGNALS: "m-signals",
  GROQ_MODEL_EXPLAIN: "m-explain",
  RATE_LIMIT_SALT: "s".repeat(32),
};
const ID = "4f9d2c1e-6a3b-4c7d-9e21-0f6a2b8c1d34";
const CREATED: SubmitReportResult = {
  kind: "created",
  caseCode: "SC-0101",
  secretCode: "K7QX-2M9P",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function services(result: SubmitReportResult = CREATED) {
  return {
    consume: vi.fn<ReportServices["consume"]>(async () => ({ allowed: true })),
    submit: vi.fn<ReportServices["submit"]>(async () => result),
  };
}

const post = (body: unknown) =>
  new Request(`http://localhost/api/analyses/${ID}/report`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function errorOf(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  return ApiError.parse(await response.json()).error;
}

describe("POST /api/analyses/{analysisId}/report", () => {
  it("SO-04-AC01: answers 201 with the case code and the secret code", async () => {
    const fake = services();
    const response = await handleReport(post({ channel: "sms", note: "9h" }), ID, {
      env: ENV,
      services: fake,
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(ReportResponse.parse(await response.json())).toEqual({
      caseCode: "SC-0101",
      secretCode: "K7QX-2M9P",
      alreadyReported: false,
    });
    expect(fake.submit).toHaveBeenCalledWith(ID, { channel: "sms", note: "9h" });
  });

  it("SO-04-AC03: answers 200 without a secret code when already reported", async () => {
    const response = await handleReport(post({ channel: "sms" }), ID, {
      env: ENV,
      services: services({ kind: "already_reported", caseCode: "SC-0101" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      caseCode: "SC-0101",
      secretCode: null,
      alreadyReported: true,
    });
  });

  it("answers 404 for an unknown analysis", async () => {
    const response = await handleReport(post({ channel: "sms" }), ID, {
      env: ENV,
      services: services({ kind: "analysis_not_found" }),
    });
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe("not_found");
  });

  it.each([
    ["no channel", ID, {}, { channel: "Hãy chọn nơi bạn nhận tin." }],
    ["unknown channel", ID, { channel: "fax" }, { channel: "Hãy chọn nơi bạn nhận tin." }],
    [
      "long note",
      ID,
      { channel: "sms", note: "a".repeat(501) },
      { note: "Ghi chú tối đa 500 ký tự." },
    ],
    ["unknown field", ID, { channel: "sms", x: 1 }, undefined],
    ["not JSON", ID, "{", undefined],
    ["oversized body", ID, { channel: "sms", note: "a".repeat(70_000) }, undefined],
    ["not a UUID", "abc", { channel: "sms" }, undefined],
  ])("SO-04-AC02: %s → 400 without reporting", async (_, id, body, fields) => {
    const fake = services();
    const response = await handleReport(post(body), id, { env: ENV, services: fake });
    expect(response.status).toBe(400);
    const error = await errorOf(response);
    expect(error.code).toBe("validation_failed");
    expect(error.fields).toEqual(fields);
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("SO-01-AC04: answers 429 before reading anything, without a model call", async () => {
    const fake = services();
    fake.consume.mockResolvedValue({ allowed: false });
    const response = await handleReport(post("{"), "abc", { env: ENV, services: fake });
    expect(response.status).toBe(429);
    expect((await errorOf(response)).message).toBe("Bạn đang gửi quá nhanh, thử lại sau ít phút");
    expect(fake.submit).not.toHaveBeenCalled();
  });

  it("answers 500 without details, and logs neither the note nor the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = services();
    fake.submit.mockRejectedValue(new Error("bí mật trong lỗi"));
    const response = await handleReport(post({ channel: "sms", note: "ghi chú riêng" }), ID, {
      env: ENV,
      services: fake,
    });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("bí mật");
    expect(log.mock.calls.join()).not.toContain("bí mật");
    expect(log.mock.calls.join()).not.toContain("ghi chú riêng");
  });

  it("the route passes the analysis id of the path, and fails closed without configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await POST(post({ channel: "sms" }), {
      params: Promise.resolve({ analysisId: ID }),
    });
    expect(response.status).toBe(500);
  });
});
