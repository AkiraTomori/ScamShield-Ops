import { describe, expect, it, vi } from "vitest";
import { submitReport } from "../../src/features/report/submit-report";

const answer = (status: number, body: unknown) =>
  vi.fn<typeof fetch>(async () => Response.json(body, { status }));
const send = (fetchImpl: typeof fetch, timeoutMs?: number) =>
  submitReport("a-b", { channel: "sms", note: "9h" }, { fetchImpl, timeoutMs });

describe("submitReport (browser)", () => {
  it("SO-04-AC01: posts the form and returns both codes", async () => {
    const fetchImpl = answer(201, {
      caseCode: "SC-0101",
      secretCode: "K7QX-2M9P",
      alreadyReported: false,
    });
    expect(await send(fetchImpl)).toEqual({
      kind: "created",
      caseCode: "SC-0101",
      secretCode: "K7QX-2M9P",
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/analyses/a-b/report");
    expect(JSON.parse(String(init?.body))).toEqual({ channel: "sms", note: "9h" });
  });

  it("SO-04-AC03: reads 'already reported'", async () => {
    const body = { caseCode: "SC-0101", secretCode: null, alreadyReported: true };
    expect(await send(answer(200, body))).toEqual({
      kind: "already_reported",
      caseCode: "SC-0101",
    });
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "failed"],
  ])("maps %i to %s", async (status, kind) => {
    expect(await send(answer(status, {}))).toEqual({ kind });
  });

  it("shows the server's message for a 400", async () => {
    const body = { error: { code: "validation_failed", message: "Lỗi" } };
    expect(await send(answer(400, body))).toEqual({ kind: "invalid", message: "Lỗi" });
  });

  it("treats a new report without a secret code, or an unknown shape, as a failure", async () => {
    const body = { caseCode: "SC-0101", secretCode: null, alreadyReported: false };
    expect(await send(answer(201, body))).toEqual({ kind: "failed" });
    expect(await send(answer(201, { ok: true }))).toEqual({ kind: "failed" });
  });

  it("gives up after its timeout", async () => {
    const hanging = vi.fn<typeof fetch>(
      (_, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    expect(await send(hanging, 5)).toEqual({ kind: "failed" });
  });
});
