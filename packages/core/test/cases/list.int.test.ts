import type { CaseListQuery, Decision, Verdict } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { StaffSession } from "../../src/auth";
import { CASES_PAGE_SIZE, listCases } from "../../src/cases";
import { cases, decisions } from "../../src/db/schema";
import {
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertStaff,
  type TestDatabase,
} from "../db/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const SESSION = {
  staffUserId: "u",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;

describe.skipIf(!url)("listCases", () => {
  let t: TestDatabase;
  let staffId: string;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    staffId = await insertStaff(t.db);
  });
  beforeEach(async () => {
    await t.db.delete(cases);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const query = (overrides: Partial<CaseListQuery> = {}): CaseListQuery => ({
    status: "pending_review",
    verdict: null,
    code: "",
    page: 1,
    ...overrides,
  });
  const list = (overrides: Partial<CaseListQuery> = {}) =>
    listCases(SESSION, query(overrides), { db: t.db });
  const codes = async (overrides: Partial<CaseListQuery> = {}) =>
    (await list(overrides)).items.map((item) => item.caseCode);

  /** `minute` orders the cases; a decision closes one. */
  async function newCase(
    minute: number,
    options: { verdict?: Verdict; decision?: Decision; isSeed?: boolean } = {},
  ) {
    const createdAt = new Date(Date.UTC(2026, 10, 28, 3, minute));
    const { id, code } = await insertCase(t.db, await insertAnalysis(t.db), {
      createdAt,
      engineVerdict: options.verdict ?? "suspicious",
      isSeed: options.isSeed ?? false,
    });
    if (options.decision) {
      await t.db
        .update(cases)
        .set({ status: "closed", closedAt: createdAt })
        .where(eq(cases.id, id));
      await t.db.insert(decisions).values({
        caseId: id,
        decision: options.decision,
        reason: "Lý do nội bộ của nhân viên",
        decidedBy: staffId,
        engineVerdict: options.verdict ?? "suspicious",
        disagreesWithEngine: false,
      });
    }
    return code;
  }

  it("SO-06-AC02: lists the waiting cases by default, newest first", async () => {
    const older = await newCase(1);
    const newest = await newCase(3, { verdict: "high_risk", isSeed: true });
    await newCase(2, { decision: "not_scam" });

    const page = await list();
    expect(page.items.map((i) => i.caseCode)).toEqual([newest, older]);
    expect(page.items[0]).toEqual({
      caseCode: newest,
      createdAt: "2026-11-28T03:03:00.000Z",
      engineVerdict: "high_risk",
      riskTypes: ["otp_phishing"],
      status: "pending_review",
      isSeed: true,
      decision: null,
    });
    expect(page).toMatchObject({ page: 1, totalPages: 1, hasAnyCase: true });
  });

  it("SO-06-AC02: filters by status and by engine verdict", async () => {
    const waiting = await newCase(1, { verdict: "high_risk" });
    const closed = await newCase(2, { verdict: "high_risk", decision: "confirmed_scam" });
    const other = await newCase(3, { verdict: "no_signal" });

    expect(await codes({ status: "closed" })).toEqual([closed]);
    expect(await codes({ status: "all" })).toEqual([other, closed, waiting]);
    expect(await codes({ verdict: "high_risk" })).toEqual([waiting]);
    expect(await codes({ status: "all", verdict: "high_risk" })).toEqual([closed, waiting]);
    expect((await list({ status: "closed" })).items[0]?.decision).toBe("confirmed_scam");
  });

  it("SO-06-AC02: finds a case by code, closed or not, however it is typed", async () => {
    await newCase(1);
    const closed = await newCase(2, { decision: "not_scam" });
    const digits = String(Number(closed.slice(3)));
    for (const code of [closed, closed.toLowerCase(), digits]) {
      expect(await codes({ code })).toEqual([closed]);
    }
    // The verdict filter still applies.
    expect(await codes({ code: closed, verdict: "high_risk" })).toEqual([]);
  });

  it("SO-06-AC02: matches a code exactly and finds nothing for something else", async () => {
    await newCase(1);
    for (const code of ["SC-9999", "SC-1", "không phải mã", "SC-0101' OR '1'='1"]) {
      expect(await list({ code })).toMatchObject({ items: [], totalPages: 1, hasAnyCase: true });
    }
  });

  it("shows 25 per page and clamps a page past the end", async () => {
    const created: string[] = [];
    for (let minute = 0; minute < CASES_PAGE_SIZE + 2; minute += 1) {
      created.push(await newCase(minute));
    }
    const newestFirst = [...created].reverse();

    const first = await list();
    expect(first).toMatchObject({ page: 1, totalPages: 2 });
    expect(first.items.map((i) => i.caseCode)).toEqual(newestFirst.slice(0, 25));
    expect(await codes({ page: 2 })).toEqual(newestFirst.slice(25));

    const past = await list({ page: Number.MAX_SAFE_INTEGER });
    expect(past).toMatchObject({ page: 2, totalPages: 2 });
    expect(past.items).toHaveLength(2);
  });

  it("neither repeats nor skips cases created at the same instant", async () => {
    for (let n = 0; n < CASES_PAGE_SIZE + 5; n += 1) await newCase(0);
    const seen = [...(await codes()), ...(await codes({ page: 2 }))];
    expect(new Set(seen).size).toBe(CASES_PAGE_SIZE + 5);
  });

  it("tells an empty queue from an empty database", async () => {
    expect(await list()).toEqual({ items: [], page: 1, totalPages: 1, hasAnyCase: false });
    await newCase(1, { decision: "not_scam" });
    expect(await list()).toMatchObject({ items: [], hasAnyCase: true });
  });
});
