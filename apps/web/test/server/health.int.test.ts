import { afterAll, describe, expect, it } from "vitest";
import { closeAllDeps } from "../../src/server/deps";
import { handleHealth } from "../../src/server/health";

// Integration: needs the local Docker Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("handleHealth against a real Postgres", () => {
  afterAll(closeAllDeps);

  it("answers 200 even when DATABASE_URL_MIGRATE is malformed (it is not a runtime variable)", async () => {
    const response = await handleHealth({
      env: { DATABASE_URL: url, DATABASE_URL_MIGRATE: "not-a-connection-string" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", db: "ok" });
  });
});
