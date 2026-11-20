import { afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/client";
import { checkHealth } from "../../src/db/health";

// Integration: needs the local Docker Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("health against a real Postgres", () => {
  const database = url ? createDatabase(url) : null;
  afterAll(async () => {
    await database?.close();
  });

  it("answers SELECT 1 through the same ping the route uses", async () => {
    const result = await checkHealth({
      ping: database ? database.ping : null,
      version: "local",
      now: () => new Date(),
    });
    expect(result.failure).toBeNull();
    expect(result.body.status).toBe("ok");
  });
});
