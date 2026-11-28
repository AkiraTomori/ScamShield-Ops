import { describe, expect, it, vi } from "vitest";
import { submitRemoval } from "../../src/features/indicators/submit-removal";

const ID = "3f1c2b7e-8a4d-4f0b-9c21-6e5d4a3b2c10";
const REQ = { reason: "Chủ sở hữu thật đã thu hồi." };
const answer = (status: number, body: unknown = {}) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));

describe("submitRemoval (SO-08-AC03)", () => {
  it("posts the reason to the removal route of this indicator", async () => {
    const fetchImpl = answer(200, { removed: true });
    expect(await submitRemoval(ID, REQ, { fetchImpl })).toEqual({ kind: "removed" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(`/api/ops/confirmed-indicators/${ID}/removal`);
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify(REQ) });
  });

  it.each([
    [409, "already"],
    [401, "signed_out"],
    [404, "not_found"],
    [403, "failed"],
    [500, "failed"],
  ] as const)("reads %i as %s", async (status, kind) => {
    expect(await submitRemoval(ID, REQ, { fetchImpl: answer(status) })).toEqual({ kind });
  });

  it("passes on the message of the reason field", async () => {
    const fetchImpl = answer(400, { error: { fields: { reason: "Lý do quá ngắn." } } });
    expect(await submitRemoval(ID, REQ, { fetchImpl })).toEqual({
      kind: "invalid",
      message: "Lý do quá ngắn.",
    });
  });

  it("reads a network error as failed", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Promise.reject(new TypeError("offline")));
    expect(await submitRemoval(ID, REQ, { fetchImpl })).toEqual({ kind: "failed" });
  });
});
