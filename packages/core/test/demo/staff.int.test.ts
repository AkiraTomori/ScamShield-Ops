import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { login } from "../../src/auth";
import { staffUsers } from "../../src/db/schema";
import { DemoPasswordsError, upsertDemoStaff } from "../../src/demo";
import { createTestDatabase, type TestDatabase } from "../db/helpers";

const passwords = (tag: string) => [1, 2, 3, 4, 5].map((n) => `${tag}-judge-${n}-xxxx`);

describe("upsertDemoStaff input", () => {
  // Rejected before the database is touched, so no database is needed here.
  const deps = {
    db: new Proxy({}, { get: () => expect.unreachable("must not write") }) as never,
  };

  it.each([
    ["four passwords", passwords("a").slice(0, 4)],
    ["six passwords", [...passwords("a"), "another-password"]],
    ["a short one", [...passwords("a").slice(0, 4), "short-pass1"]],
    ["a too long one", [...passwords("a").slice(0, 4), "x".repeat(201)]],
  ])("refuses %s without echoing it", async (_name, input) => {
    const error = await upsertDemoStaff(input, deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DemoPasswordsError);
    for (const password of input) expect((error as Error).message).not.toContain(password);
  });
});

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("upsertDemoStaff", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  const signIn = (username: string, password: string) =>
    login({ username, password }, { db: t.db, now: () => new Date(), random: () => 1 });

  it("SO-10-AC02: creates judge1 to judge5, which can sign in", async () => {
    await upsertDemoStaff(passwords("first"), { db: t.db });
    const rows = await t.db.select().from(staffUsers).orderBy(staffUsers.username);
    expect(rows.map((r) => [r.username, r.displayName, r.isDemo])).toEqual(
      [1, 2, 3, 4, 5].map((n) => [`judge${n}`, `Giám khảo ${n}`, true]),
    );
    for (const [index, password] of passwords("first").entries()) {
      expect(await signIn(`judge${index + 1}`, password)).not.toBeNull();
    }
  });

  it("changes passwords on a second run without duplicates or re-enabling", async () => {
    await upsertDemoStaff(passwords("first"), { db: t.db });
    await t.db
      .update(staffUsers)
      .set({ disabledAt: new Date() })
      .where(eq(staffUsers.username, "judge5"));
    await upsertDemoStaff(passwords("second"), { db: t.db });

    expect(await t.db.select().from(staffUsers)).toHaveLength(5);
    expect(await signIn("judge1", passwords("first")[0]!)).toBeNull();
    expect(await signIn("judge1", passwords("second")[0]!)).not.toBeNull();
    expect(await signIn("judge5", passwords("second")[4]!)).toBeNull();
  });
});
