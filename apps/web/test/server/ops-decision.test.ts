import type { DecideResult, StaffSession } from "@scamshield/core";
import { DECISION_ERROR_MESSAGE_VI, DecisionRecord, ERROR_MESSAGE_VI } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleDecision, type DecisionServices } from "../../src/server/ops-decision";

const env = { DATABASE_URL: "postgresql://user:pass@localhost:5432/unused" };
const ORIGIN = "https://app.example";
const URL_ = `${ORIGIN}/api/ops/cases/SC-0101/decision`;
const SESSION = {
  staffUserId: "u1",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;
const REASON = "Lý do bí mật của nhân viên.";
const RECORD: DecisionRecord = {
  decision: "not_scam",
  reason: REASON,
  decidedBy: "Giám khảo 1",
  decidedAt: "2026-11-28T05:00:00.000Z",
  disagreesWithEngine: true,
};
const VALID = { decision: "not_scam", reason: `  ${REASON}  ` };
const SIGNED_IN = { origin: ORIGIN, cookie: "ops_session=tok123" };

afterEach(() => {
  vi.restoreAllMocks();
});

function post(body: unknown, headers: Record<string, string> = SIGNED_IN) {
  return new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) });
}

function services(result: DecideResult = { kind: "decided", decision: RECORD }) {
  return {
    verify: vi.fn(async (token: string) => (token === "tok123" ? SESSION : null)),
    decide: vi.fn<DecisionServices["decide"]>(async () => result),
  };
}

const call = (request: Request, s = services()) =>
  handleDecision(request, "SC-0101", { env, services: s });

describe("POST /api/ops/cases/{caseCode}/decision", () => {
  it("SO-06-AC03: answers 200 with the stored decision, for the trimmed reason", async () => {
    const s = services();
    const response = await call(post(VALID), s);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(DecisionRecord.parse(await response.json())).toEqual(RECORD);
    expect(s.decide).toHaveBeenCalledWith(SESSION, "SC-0101", {
      decision: "not_scam",
      reason: REASON,
    });
  });

  it.each<Record<string, string>>([
    { cookie: "ops_session=tok123" },
    { cookie: "ops_session=tok123", origin: "https://evil.example" },
  ])("answers 403 before looking at the session: %j", async (headers) => {
    const s = services();
    const response = await call(post(VALID, headers), s);
    expect(response.status).toBe(403);
    expect(s.verify).not.toHaveBeenCalled();
    expect(s.decide).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { origin: ORIGIN },
    { origin: ORIGIN, cookie: "ops_session=stale" },
  ])("SO-06-AC01: answers 401 without a session: %j", async (headers) => {
    const s = services();
    const response = await call(post(VALID, headers), s);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("unauthorized");
    expect(s.decide).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", { decision: "not_scam" }, "reason"],
    ["a 9-character reason", { decision: "not_scam", reason: "123456789" }, "reason"],
    ["spaces", { decision: "not_scam", reason: " ".repeat(20) }, "reason"],
    ["501 characters", { decision: "not_scam", reason: "x".repeat(501) }, "reason"],
    ["invisible padding", { decision: "not_scam", reason: `ngắn${"​".repeat(20)}` }, "reason"],
    ["an unknown decision", { decision: "block_account", reason: REASON }, "decision"],
    ["no decision", { reason: REASON }, "decision"],
  ] as const)("SO-06-AC03: answers 400 for %s", async (_name, body, field) => {
    const s = services();
    const response = await call(post(body), s);
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      [field]: DECISION_ERROR_MESSAGE_VI[field],
    });
    expect(s.decide).not.toHaveBeenCalled();
  });

  it.each([{ ...VALID, caseCode: "SC-0001" }, null, "text"])(
    "answers 400 for a malformed body %j",
    async (body) => {
      expect((await call(post(body))).status).toBe(400);
    },
  );

  it("accepts 10 and 500 characters", async () => {
    for (const reason of ["x".repeat(10), "x".repeat(500)]) {
      expect((await call(post({ decision: "not_scam", reason }))).status).toBe(200);
    }
  });

  it("answers 404 when there is no such case", async () => {
    expect((await call(post(VALID), services({ kind: "not_found" }))).status).toBe(404);
  });

  it("SO-06-AC03: answers 409 without the other decision (OP-03)", async () => {
    const other = { ...RECORD, reason: "Lý do của người khác." };
    const response = await call(post(VALID), services({ kind: "conflict", decision: other }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "conflict", message: ERROR_MESSAGE_VI.conflict },
    });
  });

  it("answers 500 and logs neither the reason nor the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = services();
    s.decide.mockRejectedValue(new Error(`boom ${REASON}`));
    const response = await call(post(VALID), s);
    expect(response.status).toBe(500);
    const written = JSON.stringify([log.mock.calls, error.mock.calls, await response.text()]);
    expect(written).not.toContain(REASON);
  });
});
