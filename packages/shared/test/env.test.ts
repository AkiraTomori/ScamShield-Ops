import { describe, expect, it } from "vitest";
import { parseRuntimeDatabaseEnv, parseServerEnv } from "../src/env";

const url = "postgresql://user:s3cret-pass@localhost:5432/scamshield";

describe("parseServerEnv", () => {
  it("accepts a minimal environment (GROQ_API_KEY not needed yet)", () => {
    const result = parseServerEnv({ DATABASE_URL: url });
    expect(result.success).toBe(true);
  });

  it("treats empty optional values as unset", () => {
    const result = parseServerEnv({
      DATABASE_URL: url,
      GROQ_API_KEY: "",
      DATABASE_URL_MIGRATE: "",
    });
    expect(result.success && result.data.GROQ_API_KEY).toBeUndefined();
    expect(result.success && result.data.DATABASE_URL_MIGRATE).toBeUndefined();
  });

  it("fails when DATABASE_URL is missing", () => {
    expect(parseServerEnv({}).success).toBe(false);
  });

  it("fails when DATABASE_URL is not a postgres connection string", () => {
    expect(parseServerEnv({ DATABASE_URL: "mysql://x" }).success).toBe(false);
  });

  it("never echoes the offending value in its issues", () => {
    const result = parseServerEnv({ DATABASE_URL: "http://user:s3cret-pass@host" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error)).not.toContain("s3cret-pass");
  });
});

describe("parseRuntimeDatabaseEnv", () => {
  it("depends on DATABASE_URL only", () => {
    const result = parseRuntimeDatabaseEnv({
      DATABASE_URL: url,
      DATABASE_URL_MIGRATE: "not-a-connection-string",
      GROQ_API_KEY: "",
    });
    expect(result.success).toBe(true);
    expect(parseRuntimeDatabaseEnv({}).success).toBe(false);
  });
});
