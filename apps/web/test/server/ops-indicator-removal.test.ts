import type { RemoveResult, StaffSession } from "@scamshield/core";
import { DECISION_ERROR_MESSAGE_VI, ERROR_MESSAGE_VI } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleIndicatorRemoval,
  type RemovalServices,
} from "../../src/server/ops-indicator-removal";

const env = { DATABASE_URL: "postgresql://user:pass@localhost:5432/unused" };
const ORIGIN = "https://app.example";
const ID = "3f1c2b7e-8a4d-4f0b-9c21-6e5d4a3b2c10";
const URL_ = `${ORIGIN}/api/ops/confirmed-indicators/${ID}/removal`;
const SESSION = {
  staffUserId: "u1",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;
const REASON = "Lý do bí mật của nhân viên.";
const VALID = { reason: `  ${REASON}  ` };
const SIGNED_IN = { origin: ORIGIN, cookie: "ops_session=tok123" };

afterEach(() => {
  vi.restoreAllMocks();
});

function post(body: unknown, headers: Record<string, string> = SIGNED_IN) {
  return new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) });
}

function services(result: RemoveResult = { kind: "removed" }) {
  return {
    verify: vi.fn(async (token: string) => (token === "tok123" ? SESSION : null)),
    remove: vi.fn<RemovalServices["remove"]>(async () => result),
  };
}

const call = (request: Request, s = services(), id = ID) =>
  handleIndicatorRemoval(request, id, { env, services: s });

describe("POST /api/ops/confirmed-indicators/{id}/removal", () => {
  it("SO-08-AC03: answers 200, removing with the trimmed reason", async () => {
    const s = services();
    const response = await call(post(VALID), s);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ removed: true });
    expect(s.remove).toHaveBeenCalledWith(SESSION, ID, REASON);
  });

  it.each<Record<string, string>>([
    { cookie: "ops_session=tok123" },
    { cookie: "ops_session=tok123", origin: "https://evil.example" },
  ])("answers 403 before looking at the session: %j", async (headers) => {
    const s = services();
    expect((await call(post(VALID, headers), s)).status).toBe(403);
    expect(s.verify).not.toHaveBeenCalled();
    expect(s.remove).not.toHaveBeenCalled();
  });

  it.each<Record<string, string>>([
    { origin: ORIGIN },
    { origin: ORIGIN, cookie: "ops_session=stale" },
  ])("answers 401 without a session: %j", async (headers) => {
    const s = services();
    expect((await call(post(VALID, headers), s)).status).toBe(401);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it.each([
    ["no reason", {}],
    ["a 9-character reason", { reason: "123456789" }],
    ["spaces", { reason: " ".repeat(20) }],
    ["501 characters", { reason: "x".repeat(501) }],
  ])("SO-08-AC03: answers 400 for %s", async (_name, body) => {
    const s = services();
    const response = await call(post(body), s);
    expect(response.status).toBe(400);
    expect((await response.json()).error.fields).toEqual({
      reason: DECISION_ERROR_MESSAGE_VI.reason,
    });
    expect(s.remove).not.toHaveBeenCalled();
  });

  it.each([{ ...VALID, id: ID }, null, "text"])("answers 400 for a body %j", async (body) => {
    const s = services();
    expect((await call(post(body), s)).status).toBe(400);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it.each(["1", "abc", `${ID}'`, ""])("answers 400 for the id %j", async (id) => {
    const s = services();
    expect((await call(post(VALID), s, id)).status).toBe(400);
    expect(s.remove).not.toHaveBeenCalled();
  });

  it("answers 404 when there is no such indicator", async () => {
    expect((await call(post(VALID), services({ kind: "not_found" }))).status).toBe(404);
  });

  it("answers 409 when it was already removed, in words about the indicator", async () => {
    const response = await call(post(VALID), services({ kind: "already_removed" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: { code: "conflict", message: "Chỉ dấu này đã được gỡ trước đó." },
    });
  });

  it("answers 500 and logs neither the reason nor the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = services();
    s.remove.mockRejectedValue(new Error(`boom ${REASON}`));
    const response = await call(post(VALID), s);
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).toContain(ERROR_MESSAGE_VI.internal);
    expect(JSON.stringify([log.mock.calls, error.mock.calls, body])).not.toContain(REASON);
  });
});
