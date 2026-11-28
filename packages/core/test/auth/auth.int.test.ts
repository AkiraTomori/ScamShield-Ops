import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashPassword, login, logout, verifyPassword, verifySession } from "../../src/auth";
import { staffSessions, staffUsers } from "../../src/db/schema";
import { createTestDatabase, uniq, type TestDatabase } from "../db/helpers";

const PASSWORD = "mat-khau-thu-nghiem";

describe("verifyPassword", () => {
  it("accepts only the password that was hashed", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword(PASSWORD.toUpperCase(), hash)).toBe(false);
    expect(await verifyPassword(PASSWORD, "not-a-hash")).toBe(false);
  });
});

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;

describe.skipIf(!url)("staff sessions", () => {
  let t: TestDatabase;
  const now = new Date("2026-11-28T03:00:00.000Z");
  const hours = (n: number) => new Date(now.getTime() + n * 3_600_000);
  const deps = (at: Date = now, random = () => 1) => ({ db: t.db, now: () => at, random });

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function newUser(overrides: { disabledAt?: Date } = {}) {
    const username = uniq("staff_");
    const [row] = await t.db
      .insert(staffUsers)
      .values({
        username,
        displayName: "Nhân viên thử",
        passwordHash: await hashPassword(PASSWORD),
        isDemo: false,
        ...overrides,
      })
      .returning({ id: staffUsers.id });
    return { id: row!.id, username };
  }

  const sessionsOf = (id: string) =>
    t.db.select().from(staffSessions).where(eq(staffSessions.staffUserId, id));

  it("opens a 12-hour session and stores only the hash of its token", async () => {
    const user = await newUser();
    const session = await login({ username: user.username, password: PASSWORD }, deps());
    expect(session?.expiresAt).toEqual(hours(12));

    const rows = await sessionsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(createHash("sha256").update(session!.token).digest("hex"));
    expect(JSON.stringify(rows)).not.toContain(session!.token);

    expect(await verifySession(session!.token, deps(hours(11)))).toEqual({
      staffUserId: user.id,
      username: user.username,
      displayName: "Nhân viên thử",
    });
  });

  it("keeps an earlier session when the same account signs in again", async () => {
    const user = await newUser();
    const first = await login({ username: user.username, password: PASSWORD }, deps());
    const second = await login({ username: user.username, password: PASSWORD }, deps());
    expect(first!.token).not.toBe(second!.token);
    expect(await verifySession(first!.token, deps())).not.toBeNull();
    expect(await verifySession(second!.token, deps())).not.toBeNull();
  });

  it("answers null for a wrong password, an unknown user and a disabled user", async () => {
    const user = await newUser();
    const disabled = await newUser({ disabledAt: now });
    for (const req of [
      { username: user.username, password: "sai-mat-khau-roi" },
      { username: "khong_ton_tai", password: PASSWORD },
      { username: disabled.username, password: PASSWORD },
    ]) {
      expect(await login(req, deps())).toBeNull();
    }
    expect(await sessionsOf(user.id)).toHaveLength(0);
    expect(await sessionsOf(disabled.id)).toHaveLength(0);
  });

  it("SO-06-AC01: refuses an expired session, a disabled account and a made-up token", async () => {
    const user = await newUser();
    const session = await login({ username: user.username, password: PASSWORD }, deps());
    expect(await verifySession(session!.token, deps(hours(12)))).toBeNull();
    expect(await verifySession("", deps())).toBeNull();
    expect(await verifySession("a".repeat(43), deps())).toBeNull();

    await t.db.update(staffUsers).set({ disabledAt: now }).where(eq(staffUsers.id, user.id));
    expect(await verifySession(session!.token, deps())).toBeNull();
  });

  it("SO-06-AC01: ends the session at logout, and only that one", async () => {
    const user = await newUser();
    const first = await login({ username: user.username, password: PASSWORD }, deps());
    const second = await login({ username: user.username, password: PASSWORD }, deps());
    await logout(first!.token, deps());
    expect(await verifySession(first!.token, deps())).toBeNull();
    expect(await verifySession(second!.token, deps())).not.toBeNull();
  });

  it("removes expired sessions on some sign-ins", async () => {
    const user = await newUser();
    const req = { username: user.username, password: PASSWORD };
    await login(req, deps());
    await login(
      req,
      deps(hours(13), () => 0),
    );
    const rows = await sessionsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.expiresAt).toEqual(hours(25));
  });
});
