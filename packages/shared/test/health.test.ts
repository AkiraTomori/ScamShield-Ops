import { describe, expect, it } from "vitest";
import { HealthResponse } from "../src/health";

const time = "2026-11-20T07:05:00.000Z";

describe("HealthResponse", () => {
  it("accepts the healthy body (system-design §5)", () => {
    const body = { status: "ok", db: "ok", version: "abc1234", time };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it("accepts the degraded body", () => {
    const body = { status: "degraded", db: "unavailable", version: "local", time };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it("rejects contradictory status/db combinations", () => {
    expect(
      HealthResponse.safeParse({ status: "ok", db: "unavailable", version: "x", time }).success,
    ).toBe(false);
    expect(
      HealthResponse.safeParse({ status: "degraded", db: "ok", version: "x", time }).success,
    ).toBe(false);
  });

  it("rejects extra fields so internals cannot leak through the contract", () => {
    const body = { status: "ok", db: "ok", version: "x", time, error: "boom" };
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });

  it("rejects a non-ISO time", () => {
    expect(
      HealthResponse.safeParse({ status: "ok", db: "ok", version: "x", time: "yesterday" }).success,
    ).toBe(false);
  });
});
