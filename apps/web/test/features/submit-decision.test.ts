import { describe, expect, it, vi } from "vitest";
import { submitDecision } from "../../src/features/cases/submit-decision";

const req = { decision: "not_scam", reason: "Lý do đủ mười ký tự" } as const;
const answering = (status: number, body: unknown = {}) =>
  vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;

describe("submitDecision", () => {
  it.each([
    [200, "saved"],
    [409, "taken"],
    [401, "signed_out"],
    [404, "not_found"],
    [403, "failed"],
    [500, "failed"],
  ])("reads status %i as %s", async (status, kind) => {
    expect(await submitDecision("SC-0101", req, { fetchImpl: answering(status) })).toEqual({
      kind,
    });
  });

  it("passes the field messages of a 400 on", async () => {
    const fields = { reason: "Lý do cần từ 10 đến 500 ký tự." };
    const fetchImpl = answering(400, { error: { code: "validation_failed", fields } });
    expect(await submitDecision("SC-0101", req, { fetchImpl })).toEqual({
      kind: "invalid",
      fields,
    });
  });

  it("posts to the case, with the reason in the body", async () => {
    const fetchImpl = answering(200);
    await submitDecision("SC-0101", req, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/ops/cases/SC-0101/decision",
      expect.objectContaining({ method: "POST", body: JSON.stringify(req) }),
    );
  });

  it("reports a network error as failed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await submitDecision("SC-0101", req, { fetchImpl })).toEqual({ kind: "failed" });
  });
});
