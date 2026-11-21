import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cases } from "../../src/db/schema";
import {
  caseRow,
  createTestDatabase,
  insertAnalysis,
  insertCase,
  rejection,
  type TestDatabase,
} from "./helpers";

// Integration: needs the local Docker Postgres. Skipped when DATABASE_URL is not in the environment.
// Own database, and the tests run in order: the sequence is global state, so the first test must
// see a fresh sequence and the last one exhausts it.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("case codes (DB-03)", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  it("numbers real cases SC-0101, SC-0102, … in order", async () => {
    const a = await insertCase(t.db, await insertAnalysis(t.db));
    const b = await insertCase(t.db, await insertAnalysis(t.db));
    expect(a.code).toBe("SC-0101");
    expect(b.code).toBe("SC-0102");
  });

  it("lets a seed case carry a reserved code without consuming the sequence", async () => {
    const seeded = await insertCase(t.db, await insertAnalysis(t.db), { code: "SC-0001" });
    expect(seeded.code).toBe("SC-0001");
    const next = await insertCase(t.db, await insertAnalysis(t.db));
    expect(next.code).toBe("SC-0103");
  });

  it("stops at SC-9999 instead of truncating the code (MAXVALUE)", async () => {
    await t.sql`SELECT setval('case_code_seq', 9998)`;
    const last = await insertCase(t.db, await insertAnalysis(t.db));
    expect(last.code).toBe("SC-9999");
    const analysisId = await insertAnalysis(t.db);
    const error = await rejection(() => t.db.insert(cases).values(caseRow(analysisId)));
    expect(error.code).toBe("2200H"); // sequence_generator_limit_exceeded
  });
});
