import { describe, expect, it, vi } from "vitest";
import { checkHealth } from "../../src/db/health";

const now = () => new Date("2026-11-20T07:05:00.000Z");
const base = { version: "abc1234", now };

describe("checkHealth", () => {
  it("reports ok when the ping succeeds", async () => {
    const result = await checkHealth({ ...base, ping: async () => {} });
    expect(result.failure).toBeNull();
    expect(result.body).toEqual({
      status: "ok",
      db: "ok",
      version: "abc1234",
      time: "2026-11-20T07:05:00.000Z",
    });
  });

  it("reports unavailable without the raw error when the ping throws", async () => {
    const log = vi.fn();
    const secret = "postgresql://admin:hunter2@db.internal.example:5432/prod";
    const result = await checkHealth({
      ...base,
      log,
      ping: async () => {
        throw new Error(`connect ECONNREFUSED ${secret}`);
      },
    });
    expect(result.failure).toBe("connect_failed");
    expect(result.body).toMatchObject({ status: "degraded", db: "unavailable" });
    const everything = JSON.stringify([result, log.mock.calls]);
    expect(everything).not.toContain("hunter2");
    expect(everything).not.toContain("db.internal.example");
    expect(everything).not.toContain("ECONNREFUSED");
  });

  it("reports a timeout when the ping never answers", async () => {
    const log = vi.fn();
    const result = await checkHealth({
      ...base,
      log,
      timeoutMs: 20,
      ping: () => new Promise(() => {}),
    });
    expect(result.failure).toBe("timeout");
    expect(result.body.status).toBe("degraded");
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "health_check_failed", code: "timeout" }),
    );
  });

  it("reports config_missing when no ping is available", async () => {
    const log = vi.fn();
    const result = await checkHealth({ ...base, log, ping: null });
    expect(result.failure).toBe("config_missing");
    expect(result.body.status).toBe("degraded");
  });

  it("logs only the closed set of fields", async () => {
    const log = vi.fn();
    await checkHealth({
      ...base,
      log,
      ping: async () => {
        throw new Error("x");
      },
    });
    const fields = Object.keys(log.mock.calls[0]?.[0] ?? {}).sort();
    expect(fields).toEqual(["code", "durationMs", "event"]);
  });
});
