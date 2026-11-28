import { describe, expect, it } from "vitest";
import { resolveE2eEnv } from "../../e2e/env";

const LOCAL = "postgresql://u:p@127.0.0.1:5432/scamshield_e2e";
const REMOTE = "postgresql://u:p@db.example.com:5432/postgres";
const main = { DATABASE_URL: REMOTE, DATABASE_URL_MIGRATE: REMOTE, GROQ_API_KEY: "from-env" };
const local = { DATABASE_URL: LOCAL, E2E_JUDGE_PASSWORD: "local-password" };

describe("which site and database the E2E uses", () => {
  it("runs locally with the database of .env.e2e, never the one of .env", () => {
    const { deployed, env } = resolveE2eEnv({}, main, local);
    expect(deployed).toBeUndefined();
    expect(env.DATABASE_URL).toBe(LOCAL);
    expect(env.DATABASE_URL_MIGRATE).toBeUndefined();
    expect(env.GROQ_API_KEY).toBe("from-env");
  });

  // A value left behind in a file would send every later run to the deployed site.
  it("goes to a deployed site only when the shell says so", () => {
    const forgotten = { E2E_BASE_URL: "https://app.example.com" };
    const { deployed, env } = resolveE2eEnv(
      {},
      { ...main, ...forgotten },
      { ...local, ...forgotten },
    );
    expect(deployed).toBeUndefined();
    // Nor is it put in the environment, where a worker process would read it as the shell's.
    expect(env.E2E_BASE_URL).toBeUndefined();
  });

  it("uses .env, not .env.e2e, against a deployed site", () => {
    const shell = { E2E_BASE_URL: "https://app.example.com" };
    const { deployed, env } = resolveE2eEnv(
      shell,
      { ...main, E2E_JUDGE_PASSWORD: "site-password" },
      local,
    );
    expect(deployed).toBe("https://app.example.com");
    expect(env.E2E_JUDGE_PASSWORD).toBe("site-password");
  });

  it("lets the shell win over the files", () => {
    const { env } = resolveE2eEnv({ E2E_JUDGE_PASSWORD: "typed" }, main, local);
    expect(env.E2E_JUDGE_PASSWORD).toBeUndefined();
  });

  it.each([
    ["no .env.e2e", {}, {}],
    ["a remote database in .env.e2e", {}, { DATABASE_URL: REMOTE }],
    ["a remote database in the shell", { DATABASE_URL: REMOTE }, local],
    ["not a URL", {}, { DATABASE_URL: "localhost" }],
  ])("refuses to run locally with %s, without echoing the value", (_name, shell, file) => {
    expect(() => resolveE2eEnv(shell, main, file)).toThrow(/e2e:setup/);
    expect(() => resolveE2eEnv(shell, main, file)).not.toThrow(/example\.com/);
  });
});
