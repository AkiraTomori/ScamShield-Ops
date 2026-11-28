import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { StaffSession } from "../../src/auth";
import { decideCase } from "../../src/cases";
import {
  CONFIRMED_PAGE_SIZE,
  listConfirmedIndicators,
  removeConfirmedIndicator,
} from "../../src/confirmed-indicators";
import { confirmedIndicators, staffUsers } from "../../src/db/schema";
import { createTestDatabase, insertCaseWith, insertStaff, type TestDatabase } from "../db/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const NOW = new Date("2026-11-28T05:00:00.000Z");
const LATER = new Date("2026-11-28T06:00:00.000Z");
const INDICATORS = [
  { type: "phone", normalized: "+84900000001" },
  { type: "domain", normalized: "b.example" },
  { type: "domain", normalized: "a.example" },
] as const;

describe.skipIf(!url)("listConfirmedIndicators (SO-08-AC03)", () => {
  let t: TestDatabase;
  let staff: StaffSession;

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    const staffUserId = await insertStaff(t.db);
    await t.db
      .update(staffUsers)
      .set({ displayName: "Giám khảo 1" })
      .where(eq(staffUsers.id, staffUserId));
    staff = { staffUserId, username: "u", displayName: "Giám khảo 1" } as StaffSession;
  });
  afterAll(async () => {
    await t?.drop();
  });
  // Rows of the throwaway database only: each test starts from an empty list.
  beforeEach(async () => {
    await t.db.delete(confirmedIndicators);
  });

  const list = (page = 1) => listConfirmedIndicators(staff, page, { db: t.db });

  async function confirm(indicators: Parameters<typeof insertCaseWith>[1], at = NOW) {
    const { id, code } = await insertCaseWith(t.db, indicators);
    await decideCase(
      staff,
      code,
      { decision: "confirmed_scam", reason: "Tên miền giả mạo thương hiệu." },
      { db: t.db, now: () => at },
    );
    return { id, code };
  }

  it("is one empty page when nothing is confirmed", async () => {
    expect(await list()).toEqual({ items: [], page: 1, totalPages: 1 });
    expect(await list(5)).toEqual({ items: [], page: 1, totalPages: 1 });
  });

  it("shows the source case, the time and who confirmed", async () => {
    const { code } = await confirm([INDICATORS[2]]);
    const [item] = (await list()).items;
    expect(item).toEqual({
      id: expect.any(String),
      type: "domain",
      normalized: "a.example",
      sourceCaseCode: code,
      confirmedAt: NOW.toISOString(),
      confirmedBy: "Giám khảo 1",
    });
  });

  it("puts the newest first, in a fixed order within one decision", async () => {
    await confirm([...INDICATORS]);
    await confirm(
      [
        { type: "phone", normalized: "+84900000002" },
        { type: "bank_account", normalized: "000123456789" },
      ],
      LATER,
    );
    expect((await list()).items.map((item) => item.normalized)).toEqual([
      "000123456789",
      "+84900000002",
      "a.example",
      "b.example",
      "+84900000001",
    ]);
  });

  it("leaves out removed rows", async () => {
    await confirm([...INDICATORS]);
    const [first] = (await list()).items;
    await removeConfirmedIndicator(staff, first!.id, "Chủ sở hữu thật đã thu hồi.", {
      db: t.db,
      now: () => LATER,
    });
    const after = await list();
    expect(after.items).toHaveLength(2);
    expect(after.items.map((item) => item.id)).not.toContain(first!.id);
  });

  it("pages by 50, and answers a page past the end with the last one", async () => {
    const { id } = await insertCaseWith(t.db, []);
    await t.db.insert(confirmedIndicators).values(
      Array.from({ length: CONFIRMED_PAGE_SIZE + 1 }, (_, i) => ({
        type: "domain",
        normalized: `d${String(i).padStart(2, "0")}.example`,
        sourceCaseId: id,
        confirmedBy: staff.staffUserId,
        confirmedAt: NOW,
      })),
    );
    expect(CONFIRMED_PAGE_SIZE).toBe(50);
    expect(await list()).toMatchObject({ page: 1, totalPages: 2 });
    expect((await list()).items).toHaveLength(50);
    const second = await list(2);
    expect(second.items.map((item) => item.normalized)).toEqual(["d50.example"]);
    expect(await list(99)).toEqual(second);
  });
});
