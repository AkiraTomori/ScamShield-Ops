import { describe, expect, it, vi } from "vitest";
import { submitLogin, submitLogout } from "../../src/features/auth/submit-session";

const req = { username: "judge1", password: "mat-khau-bi-mat-123" };
const answering = (status: number) =>
  vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
const offline = vi.fn(async () => {
  throw new Error("offline");
}) as unknown as typeof fetch;

describe("submitLogin", () => {
  it.each([
    [204, "signed_in"],
    [401, "invalid_credentials"],
    [429, "rate_limited"],
    [403, "failed"],
    [500, "failed"],
  ])("reads status %i as %s", async (status, kind) => {
    expect(await submitLogin(req, { fetchImpl: answering(status) })).toEqual({ kind });
  });

  it("reports a network error as failed", async () => {
    expect(await submitLogin(req, { fetchImpl: offline })).toEqual({ kind: "failed" });
  });

  it("posts the credentials in the body, not the URL", async () => {
    const fetchImpl = answering(204);
    await submitLogin(req, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/ops/session",
      expect.objectContaining({ method: "POST", body: JSON.stringify(req) }),
    );
  });
});

describe("submitLogout", () => {
  it.each([
    [204, true],
    [401, true],
    [403, false],
    [500, false],
  ])("reads status %i as signed out: %s", async (status, signedOut) => {
    expect(await submitLogout(answering(status))).toBe(signedOut);
  });

  it("reports a network error as still signed in", async () => {
    expect(await submitLogout(offline)).toBe(false);
  });
});
