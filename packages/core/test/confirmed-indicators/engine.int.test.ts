import { BRANDS, URL_LISTS } from "@scamshield/shared";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { analyzeMessage, saveAnalysis, type AnalysisDeps } from "../../src/analysis";
import type { StaffSession } from "../../src/auth";
import { decideCase } from "../../src/cases";
import { findVerifiedMatches, removeConfirmedIndicator } from "../../src/confirmed-indicators";
import { confirmedIndicators } from "../../src/db/schema";
import {
  createTestDatabase,
  insertCase,
  insertCaseWith,
  insertStaff,
  type TestDatabase,
} from "../db/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const REASON = "Tên miền giả mạo thương hiệu.";

// Different words, a different host and path, the phone number written differently.
const FIRST =
  "Tài khoản sẽ bị khoá. Xác minh tại https://vi-xac-minh.example/otp, gọi 0900 000 001";
const LATER =
  "Bạn được hoàn tiền 500.000đ, nhận tại http://hoan-tien.vi-xac-minh.example/nhan hoặc gọi +84900000001";

describe.skipIf(!url)("the engine and the confirmed list (SO-08)", () => {
  let t: TestDatabase;
  let staff: StaffSession;

  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    const staffUserId = await insertStaff(t.db);
    staff = { staffUserId, username: "u", displayName: "Nhân viên thử" } as StaffSession;
  });
  afterAll(async () => {
    await t?.drop();
  });
  // Rows of the throwaway database only: each test starts from an empty list.
  beforeEach(async () => {
    await t.db.delete(confirmedIndicators);
  });

  const find = (keys: Parameters<typeof findVerifiedMatches>[0]) =>
    findVerifiedMatches(keys, { db: t.db });

  /** The model is down throughout, so any high_risk below comes from the list alone (P-01). */
  const deps = (): AnalysisDeps => ({
    llm: { chatJson: async () => ({ ok: false, kind: "unavailable", latencyMs: 1 }) },
    models: { signals: "m-signals", explain: "m-explain" },
    brands: BRANDS,
    urlLists: URL_LISTS,
    verifiedIndicators: find,
    now: () => new Date(),
    random: () => "abc123",
    newId: randomUUID,
    log: () => {},
  });

  async function report(content: string) {
    const outcome = await analyzeMessage(content, deps());
    await saveAnalysis(outcome, { db: t.db });
    return insertCase(t.db, outcome.result.analysisId);
  }
  const confirm = (code: string) =>
    decideCase(
      staff,
      code,
      { decision: "confirmed_scam", reason: REASON },
      { db: t.db, now: () => new Date() },
    );

  it("SO-08-AC02: a later message sharing an indicator of a confirmed case is high_risk", async () => {
    expect((await analyzeMessage(LATER, deps())).result.rule).toBe("R0");

    const { code } = await report(FIRST);
    await confirm(code);

    const { result } = await analyzeMessage(LATER, deps());
    expect(result).toMatchObject({
      verdict: "high_risk",
      rule: "R1",
      inconclusiveReason: "llm_unavailable",
    });
    expect(
      result.signals
        .filter((s) => s.type === "verified_indicator")
        .map((s) => s.indicator)
        .sort(),
    ).toEqual(["+84900000001", "vi-xac-minh.example"]);
    // Nothing about the source case reaches the result (verified-indicators §3).
    expect(JSON.stringify(result)).not.toContain(code);
  });

  it("SO-08-AC03: stops warning after removal, and warns again after a new confirmation", async () => {
    const key = { type: "domain", normalized: "go-roi.example" } as const;
    const add = async () => {
      const { code } = await insertCaseWith(t.db, [key]);
      await confirm(code);
    };
    await add();
    expect(await find([key])).toEqual([key]);

    const [row] = await t.db.select().from(confirmedIndicators);
    await removeConfirmedIndicator(staff, row!.id, "Chủ sở hữu thật đã thu hồi.", {
      db: t.db,
      now: () => new Date(),
    });
    expect(await find([key])).toEqual([]);

    await add();
    expect(await find([key])).toEqual([key]);
  });

  it("returns only what was asked for, matching type and value together", async () => {
    const listed = { type: "phone", normalized: "+84900000009" } as const;
    const { code } = await insertCaseWith(t.db, [
      listed,
      { type: "domain", normalized: "khac.example" },
    ]);
    await confirm(code);
    expect(await find([listed, { type: "domain", normalized: "la.example" }])).toEqual([listed]);
    expect(await find([{ type: "bank_account", normalized: listed.normalized }])).toEqual([]);
  });

  it("returns nothing for no keys, not the whole list", async () => {
    const { code } = await insertCaseWith(t.db, [{ type: "domain", normalized: "co-san.example" }]);
    await confirm(code);
    expect(await find([])).toEqual([]);
  });

  it("XM-01: a brand domain that is on the list anyway never matches", async () => {
    // Recording refuses it; this is a row from before the domain joined the brand list.
    const { id } = await insertCaseWith(t.db, []);
    await t.db.insert(confirmedIndicators).values({
      type: "domain",
      normalized: "momo.vn",
      sourceCaseId: id,
      confirmedBy: staff.staffUserId,
    });
    expect(await find([{ type: "domain", normalized: "momo.vn" }])).toEqual([]);
  });

  it("XM-04: a shared platform domain recorded earlier no longer warns", async () => {
    const { id } = await insertCaseWith(t.db, []);
    await t.db.insert(confirmedIndicators).values({
      type: "domain",
      normalized: "zalo.me",
      sourceCaseId: id,
      confirmedBy: staff.staffUserId,
    });

    const { result } = await analyzeMessage("Nhắn mình qua https://zalo.me/g/abc", deps());
    expect(result.rule).toBe("R0");
    expect(result.signals.map((s) => s.type)).not.toContain("verified_indicator");
  });
});
