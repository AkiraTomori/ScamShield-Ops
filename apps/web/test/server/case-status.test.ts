import { CaseStatusResponse } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/case-status/route";
import { handleCaseStatus, type CaseStatusServices } from "../../src/server/case-status";

const ENV = { DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db", RATE_LIMIT_SALT: "s".repeat(32) };
const FOUND = {
  caseCode: "SC-0101",
  status: "confirmed_scam",
  updatedAt: "2026-11-27T07:05:00.000Z",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function services(found: CaseStatusResponse | null = FOUND) {
  return {
    consume: vi.fn<CaseStatusServices["consume"]>(async () => ({ allowed: true })),
    lookup: vi.fn<CaseStatusServices["lookup"]>(async () => found),
  };
}

const post = (body: unknown) =>
  new Request("http://localhost/api/case-status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const REQUEST = { caseCode: "SC-0101", secretCode: "K7QX-2M9P" };

describe("POST /api/case-status", () => {
  it("SO-04-AC04: answers 200 with three fields only, and needs no model configuration", async () => {
    const response = await handleCaseStatus(post(REQUEST), { env: ENV, services: services() });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(CaseStatusResponse.parse(await response.json())).toEqual(FOUND);
  });

  it("SO-04-AC04: any mismatch gets one identical 404", async () => {
    const answers = await Promise.all(
      [
        REQUEST,
        { caseCode: "SC-9999", secretCode: "K7QX-2M9P" },
        { caseCode: "xyz", secretCode: "!!" },
      ].map(async (body) => {
        const response = await handleCaseStatus(post(body), { env: ENV, services: services(null) });
        return {
          status: response.status,
          headers: [...response.headers],
          body: await response.text(),
        };
      }),
    );
    expect(new Set(answers.map((a) => JSON.stringify(a))).size).toBe(1);
    expect(answers[0]?.status).toBe(404);
    expect(JSON.parse(answers[0]?.body ?? "")).toEqual({
      error: { code: "not_found", message: "Không tìm thấy báo cáo khớp với hai mã này." },
    });
  });

  it.each([
    ["missing field", { caseCode: "SC-0101" }],
    ["blank", { caseCode: "  ", secretCode: "x" }],
    ["too long", { caseCode: "SC-0101", secretCode: "x".repeat(33) }],
    ["unknown field", { ...REQUEST, x: 1 }],
    ["not JSON", "{"],
  ])("answers 400 for %s without looking anything up", async (_, body) => {
    const fake = services();
    const response = await handleCaseStatus(post(body), { env: ENV, services: fake });
    expect(response.status).toBe(400);
    expect(fake.lookup).not.toHaveBeenCalled();
  });

  it("SO-01-AC04: answers 429 without looking anything up", async () => {
    const fake = services();
    fake.consume.mockResolvedValue({ allowed: false });
    const response = await handleCaseStatus(post(REQUEST), { env: ENV, services: fake });
    expect(response.status).toBe(429);
    expect(fake.lookup).not.toHaveBeenCalled();
  });

  it("logs neither code when something breaks", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const fake = services();
    fake.lookup.mockRejectedValue(new Error("K7QX-2M9P"));
    const response = await handleCaseStatus(post(REQUEST), { env: ENV, services: fake });
    expect(response.status).toBe(500);
    expect(log.mock.calls.join()).not.toContain("K7QX");
  });

  it("the route fails closed without configuration", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect((await POST(post(REQUEST))).status).toBe(500);
  });
});
