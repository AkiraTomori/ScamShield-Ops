import { type Decision } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { StaffSession } from "../../src/auth";
import { decideCase } from "../../src/cases";
import { listIndicatorsToConfirm, removeConfirmedIndicator } from "../../src/confirmed-indicators";
import { cases, confirmedIndicators, decisions } from "../../src/db/schema";
import {
  createTestDatabase,
  insertCaseWith,
  insertStaff,
  PG,
  rejection,
  type TestDatabase,
} from "../db/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const NOW = new Date("2026-11-28T05:00:00.000Z");
const LATER = new Date("2026-11-28T06:00:00.000Z");
const REASON = "Tên miền giả mạo thương hiệu.";
const REMOVAL = "Chủ sở hữu thật đã thu hồi.";
const SCAM = [
  { type: "domain", normalized: "vi-xac-minh.example" },
  { type: "phone", normalized: "0900000001" },
  { type: "bank_account", normalized: "0123456789" },
] as const;

describe.skipIf(!url)("confirmed indicators (SO-08)", () => {
  let t: TestDatabase;
  let first: StaffSession;
  let second: StaffSession;

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    const staff = async () => {
      const staffUserId = await insertStaff(t.db);
      return { staffUserId, username: "u", displayName: "Nhân viên thử" } as StaffSession;
    };
    first = await staff();
    second = await staff();
  });
  afterAll(async () => {
    await t?.drop();
  });
  // Rows of the throwaway database only: each test starts from an empty list.
  beforeEach(async () => {
    await t.db.delete(confirmedIndicators);
  });

  const decide = (code: string, decision: Decision, session = first, at = NOW) =>
    decideCase(session, code, { decision, reason: REASON }, { db: t.db, now: () => at });

  const remove = (id: string, session = second) =>
    removeConfirmedIndicator(session, id, REMOVAL, { db: t.db, now: () => LATER });

  const rows = () =>
    t.db
      .select()
      .from(confirmedIndicators)
      .orderBy(confirmedIndicators.type, confirmedIndicators.normalized);

  async function confirmOne(normalized: string) {
    const { id, code } = await insertCaseWith(t.db, [{ type: "domain", normalized }]);
    await decide(code, "confirmed_scam");
    const row = (await rows()).find((r) => r.sourceCaseId === id)!;
    return row.id;
  }

  it("SO-08-AC01: a confirmed_scam decision records the indicators, with case, staff and time", async () => {
    const { id, code } = await insertCaseWith(t.db, [...SCAM]);
    await decide(code, "confirmed_scam");
    const stored = await rows();
    expect(stored.map(({ type, normalized }) => ({ type, normalized }))).toEqual([
      SCAM[2],
      SCAM[0],
      SCAM[1],
    ]);
    for (const row of stored) {
      expect(row).toMatchObject({
        sourceCaseId: id,
        confirmedBy: first.staffUserId,
        confirmedAt: NOW,
        removedAt: null,
        removedBy: null,
        removalReason: null,
      });
    }
  });

  it("XM-01, XM-04: records no excluded domain, and shows none in the preview", async () => {
    const { id, code } = await insertCaseWith(t.db, [
      { type: "domain", normalized: "momo.vn" },
      { type: "domain", normalized: "bit.ly" },
      { type: "domain", normalized: "zalo.me" },
      SCAM[0],
    ]);
    expect(await listIndicatorsToConfirm(first, id, { db: t.db })).toEqual([SCAM[0]]);
    await decide(code, "confirmed_scam");
    expect((await rows()).map((r) => r.normalized)).toEqual([SCAM[0].normalized]);
  });

  it.each(["not_scam", "insufficient_evidence"] as const)(
    "SO-08-AC03: %s records nothing",
    async (decision) => {
      const { code } = await insertCaseWith(t.db, [...SCAM]);
      expect((await decide(code, decision)).kind).toBe("decided");
      expect(await rows()).toEqual([]);
    },
  );

  it("closes a case that has nothing to record", async () => {
    const { code } = await insertCaseWith(t.db, []);
    expect((await decide(code, "confirmed_scam")).kind).toBe("decided");
    expect(await rows()).toEqual([]);
  });

  it("keeps the first source of an indicator already on the list, and adds the new ones", async () => {
    const one = await insertCaseWith(t.db, [SCAM[0]]);
    const two = await insertCaseWith(t.db, [SCAM[0], SCAM[1]]);
    await decide(one.code, "confirmed_scam");
    expect((await decide(two.code, "confirmed_scam", second, LATER)).kind).toBe("decided");
    expect(await rows()).toMatchObject([
      { normalized: SCAM[0].normalized, sourceCaseId: one.id, confirmedBy: first.staffUserId },
      { normalized: SCAM[1].normalized, sourceCaseId: two.id, confirmedBy: second.staffUserId },
    ]);
  });

  it("records a shared indicator once when two cases are confirmed at the same time", async () => {
    const one = await insertCaseWith(t.db, [...SCAM]);
    const two = await insertCaseWith(t.db, [...SCAM]);
    const results = await Promise.all([
      decide(one.code, "confirmed_scam"),
      decide(two.code, "confirmed_scam", second),
    ]);
    expect(results.map((r) => r.kind)).toEqual(["decided", "decided"]);
    expect(await rows()).toHaveLength(SCAM.length);
  });

  it("SO-08-AC01: rolls the decision back when the indicators cannot be written", async () => {
    const { id, code } = await insertCaseWith(t.db, [...SCAM]);
    // A temporary constraint of the throwaway database that no new row can satisfy.
    await t.sql`ALTER TABLE confirmed_indicators ADD CONSTRAINT refuse_all CHECK (false)`;
    try {
      await expect(decide(code, "confirmed_scam")).rejects.toThrow();
    } finally {
      await t.sql`ALTER TABLE confirmed_indicators DROP CONSTRAINT refuse_all`;
    }
    const [stored] = await t.db.select().from(cases).where(eq(cases.id, id));
    expect(stored).toMatchObject({ status: "pending_review", closedAt: null });
    expect(await t.db.select().from(decisions).where(eq(decisions.caseId, id))).toEqual([]);
    expect(await rows()).toEqual([]);
  });

  it("SO-08-AC03: removes once, keeping who, why and when", async () => {
    const id = await confirmOne("go-mot-lan.example");
    expect(await remove(id)).toEqual({ kind: "removed" });
    expect(await remove(id, first)).toEqual({ kind: "already_removed" });
    expect(await rows()).toMatchObject([
      { removedAt: LATER, removedBy: second.staffUserId, removalReason: REMOVAL },
    ]);
  });

  it("lets exactly one of two concurrent removals through", async () => {
    const id = await confirmOne("go-cung-luc.example");
    const results = await Promise.all([remove(id, first), remove(id, second)]);
    expect(results.map((r) => r.kind).sort()).toEqual(["already_removed", "removed"]);
  });

  it("finds nothing for an unknown id", async () => {
    expect(await remove("00000000-0000-4000-8000-000000000000")).toEqual({ kind: "not_found" });
  });

  it("can be confirmed again after removal, keeping the removed row", async () => {
    await remove(await confirmOne("xac-nhan-lai.example"));
    await confirmOne("xac-nhan-lai.example");
    const stored = await rows();
    expect(stored.map((r) => r.removedAt === null).sort()).toEqual([false, true]);
  });

  it("is held to its constraints by the database", async () => {
    const { id } = await insertCaseWith(t.db, []);
    const row = {
      type: "domain",
      normalized: "rang-buoc.example",
      sourceCaseId: id,
      confirmedBy: first.staffUserId,
    };
    const insert = (overrides: Partial<typeof confirmedIndicators.$inferInsert> = {}) =>
      t.db.insert(confirmedIndicators).values({ ...row, ...overrides });
    const removal = { removedAt: NOW, removedBy: first.staffUserId, removalReason: REMOVAL };

    expect((await rejection(() => insert({ type: "url" }))).code).toBe(PG.check);
    for (const missing of ["removedAt", "removedBy", "removalReason"] as const) {
      expect((await rejection(() => insert({ ...removal, [missing]: null }))).code).toBe(PG.check);
    }
    for (const removalReason of ["123456789", "x".repeat(501)]) {
      expect((await rejection(() => insert({ ...removal, removalReason }))).code).toBe(PG.check);
    }
    await insert(removal);
    await insert();
    expect((await rejection(() => insert())).code).toBe(PG.unique);
    // The source case cannot go while its indicators are there (verified-indicators §4).
    expect((await rejection(() => t.db.delete(cases).where(eq(cases.id, id)))).code).toBe(
      PG.foreignKey,
    );
  });
});
