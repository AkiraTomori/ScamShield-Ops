import { HealthResponse } from "@scamshield/shared";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/health/route";
import { closeAllDeps } from "../../src/server/deps";
import { handleHealth, resolveVersion } from "../../src/server/health";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
afterAll(closeAllDeps);

describe("handleHealth", () => {
  it("returns 503 config_missing when DATABASE_URL is absent, never touching a database", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await handleHealth({ env: {} });
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = HealthResponse.parse(await response.json());
    expect(body).toMatchObject({ status: "degraded", db: "unavailable", version: "local" });
    expect(String(log.mock.calls[0]?.[0])).toContain('"code":"config_missing"');
  });

  it("returns 503 without leaking host, user or password when the database is unreachable", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = { DATABASE_URL: "postgresql://leaky-user:leaky-pass@127.0.0.1:1/leaky-db" };
    const response = await handleHealth({ env });
    expect(response.status).toBe(503);
    const text = await response.text();
    const everything = text + JSON.stringify(log.mock.calls);
    for (const secret of ["leaky-user", "leaky-pass", "127.0.0.1", "leaky-db", "ECONNREFUSED"]) {
      expect(everything).not.toContain(secret);
    }
    expect(HealthResponse.parse(JSON.parse(text)).status).toBe("degraded");
  });

  it("ignores DATABASE_URL_MIGRATE: a malformed value must not turn the check into config_missing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = {
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db",
      DATABASE_URL_MIGRATE: "not-a-connection-string",
    };
    const response = await handleHealth({ env });
    expect(response.status).toBe(503);
    // The database was actually attempted (connect_failed), not rejected up front.
    expect(String(log.mock.calls[0]?.[0])).toContain('"code":"connect_failed"');
  });

  it("ignores GROQ_API_KEY and other variables the health check does not use", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const env = { DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db", GROQ_API_KEY: "" };
    await handleHealth({ env });
    expect(String(log.mock.calls[0]?.[0])).toContain('"code":"connect_failed"');
  });

  it("returns a fresh time on every call", async () => {
    const times = [new Date("2026-11-20T07:00:00.000Z"), new Date("2026-11-20T07:00:05.000Z")];
    let i = 0;
    const call = () => handleHealth({ env: {}, now: () => times[i++] ?? new Date() });
    vi.spyOn(console, "log").mockImplementation(() => {});
    const a = HealthResponse.parse(await (await call()).json());
    const b = HealthResponse.parse(await (await call()).json());
    expect(a.time).not.toBe(b.time);
  });
});

describe("GET /api/health route", () => {
  it("is dynamic and answers 503 with no-store when env is missing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("DATABASE_URL", "");
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("resolveVersion", () => {
  it("is 'local' outside Vercel and the 7-char SHA on Vercel", () => {
    expect(resolveVersion({})).toBe("local");
    expect(resolveVersion({ VERCEL_GIT_COMMIT_SHA: "0123456789abcdef" })).toBe("0123456");
  });
});
