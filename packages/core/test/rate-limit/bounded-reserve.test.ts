import { afterEach, describe, expect, it, vi } from "vitest";
import { boundedReserve } from "../../src/rate-limit";

afterEach(() => vi.restoreAllMocks());

describe("boundedReserve (P-03, 20 s ceiling)", () => {
  it("passes the counter's answer through", async () => {
    expect(await boundedReserve(async () => true, 50)()).toBe(true);
    expect(await boundedReserve(async () => false, 50)()).toBe(false);
  });

  it.each([
    ["hangs", () => new Promise<boolean>(() => {})],
    ["fails", () => Promise.reject(new Error("db: secret-host"))],
  ])("skips the model call when the counter %s", async (_, reserve) => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await boundedReserve(reserve, 20)()).toBe(false);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret");
  });
});
