import type { StaffSession } from "@scamshield/core";
import { ERROR_MESSAGE_VI } from "@scamshield/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleLogin,
  handleLogout,
  type LoginServices,
  type LogoutServices,
} from "../../src/server/ops-auth";

const env = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/unused",
  RATE_LIMIT_SALT: "s".repeat(32),
};
const URL_ = "https://app.example/api/ops/session";
const PASSWORD = "mat-khau-bi-mat-123";
const SESSION = {
  staffUserId: "u1",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function post(body: unknown, headers: Record<string, string> = { origin: "https://app.example" }) {
  return new Request(URL_, { method: "POST", headers, body: JSON.stringify(body) });
}

function del(headers: Record<string, string>) {
  return new Request(URL_, { method: "DELETE", headers });
}

function loginServices(overrides: Partial<LoginServices> = {}) {
  return {
    consume: vi.fn(async () => ({ allowed: true })),
    login: vi.fn(async () => ({ token: "tok123", expiresAt: new Date(Date.now() + 43_200_000) })),
    ...overrides,
  };
}

function logoutServices(overrides: Partial<LogoutServices> = {}) {
  return {
    verify: vi.fn(async (token: string) => (token === "tok123" ? SESSION : null)),
    logout: vi.fn(async () => {}),
    ...overrides,
  };
}

const valid = { username: " Judge1 ", password: PASSWORD };

describe("POST /api/ops/session", () => {
  it("answers 204 with a 12-hour HttpOnly cookie", async () => {
    const services = loginServices();
    const response = await handleLogin(post(valid), { env, services });
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBe(
      "ops_session=tok123; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax; Secure",
    );
    expect(services.login).toHaveBeenCalledWith({ username: "judge1", password: PASSWORD });
  });

  it("OP-02: drops Secure only in next dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await handleLogin(post(valid), { env, services: loginServices() });
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });

  it.each<Record<string, string>>([{}, { origin: "https://evil.example" }])(
    "answers 403 before doing anything for headers %j",
    async (headers) => {
      const services = loginServices();
      const response = await handleLogin(post(valid, headers), { env, services });
      expect(response.status).toBe(403);
      expect((await response.json()).error.code).toBe("forbidden_origin");
      expect(services.consume).not.toHaveBeenCalled();
      expect(services.login).not.toHaveBeenCalled();
    },
  );

  it("OP-01: counts in its own bucket and answers 429 without checking the password", async () => {
    const services = loginServices({ consume: vi.fn(async () => ({ allowed: false })) });
    const response = await handleLogin(post(valid), { env, services });
    expect(response.status).toBe(429);
    expect(services.consume).toHaveBeenCalledWith(
      expect.stringMatching(/^login:[0-9a-f]{64}$/),
      expect.any(Date),
    );
    expect(services.login).not.toHaveBeenCalled();
  });

  it.each([
    {},
    { username: "judge1" },
    { username: "  ", password: PASSWORD },
    { username: "judge1", password: "" },
    { username: "judge1", password: "x".repeat(201) },
    { ...valid, extra: true },
  ])("answers 400 for %j", async (body) => {
    const services = loginServices();
    const response = await handleLogin(post(body), { env, services });
    expect(response.status).toBe(400);
    expect(services.login).not.toHaveBeenCalled();
  });

  it("answers 401 invalid_credentials without a cookie and without saying which part", async () => {
    const services = loginServices({ login: vi.fn(async () => null) });
    const response = await handleLogin(post(valid), { env, services });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toEqual({
      error: { code: "invalid_credentials", message: ERROR_MESSAGE_VI.invalid_credentials },
    });
  });

  it("answers 500 and logs neither the password nor the error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const services = loginServices({
      login: vi.fn(async () => {
        throw new Error(`boom ${PASSWORD}`);
      }),
    });
    const response = await handleLogin(post(valid), { env, services });
    expect(response.status).toBe(500);
    const written = JSON.stringify([log.mock.calls, error.mock.calls, await response.text()]);
    expect(written).not.toContain(PASSWORD);
  });

  it("answers 500 when the environment is incomplete", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const response = await handleLogin(post(valid), { env: {}, services: loginServices() });
    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/ops/session", () => {
  const origin = "https://app.example";

  it("ends the session and clears the cookie", async () => {
    const services = logoutServices();
    const response = await handleLogout(del({ origin, cookie: "a=1; ops_session=tok123" }), {
      env,
      services,
    });
    expect(response.status).toBe(204);
    expect(services.logout).toHaveBeenCalledWith("tok123");
    expect(response.headers.get("set-cookie")).toContain("ops_session=; Path=/; Max-Age=0");
  });

  it.each([undefined, "ops_session=stale", "ops_session="])(
    "SO-06-AC01: answers 401 for the cookie %j",
    async (cookie) => {
      const services = logoutServices();
      const response = await handleLogout(del(cookie ? { origin, cookie } : { origin }), {
        env,
        services,
      });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("unauthorized");
      expect(services.logout).not.toHaveBeenCalled();
    },
  );

  it("checks Origin before the session", async () => {
    const services = logoutServices();
    const response = await handleLogout(
      del({ origin: "https://evil.example", cookie: "ops_session=tok123" }),
      { env, services },
    );
    expect(response.status).toBe(403);
    expect(services.verify).not.toHaveBeenCalled();
  });
});
