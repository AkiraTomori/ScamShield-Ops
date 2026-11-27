import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Decision } from "@scamshield/shared";
import { cases, decisions } from "../../src/db/schema";
import { hashSecret, lookupPublicStatus, normalizeCaseCode } from "../../src/reports";
import {
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertStaff,
  type TestDatabase,
} from "../db/helpers";

describe("normalizeCaseCode", () => {
  it.each([
    [" sc-0101 ", "SC-0101"],
    ["101", "SC-0101"],
    ["7", "SC-0007"],
    ["SC-12345", "SC-12345"],
  ])("reads %j as %s", (input, code) => {
    expect(normalizeCaseCode(input)).toBe(code);
  });

  it.each(["", "SC-1", "SC0101", "XX-0101", "10101", "SC-0101'--"])("rejects %j", (input) => {
    expect(normalizeCaseCode(input)).toBeNull();
  });
});

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const SECRET = "K7QX2M9P";
const TYPED = "k7qx-2m9p";

describe.skipIf(!url)("lookupPublicStatus", () => {
  let t: TestDatabase;
  let staffId: string;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
    staffId = await insertStaff(t.db);
  });
  afterAll(async () => {
    await t?.drop();
  });

  async function newCase() {
    return insertCase(t.db, await insertAnalysis(t.db), { secretHash: await hashSecret(SECRET) });
  }

  async function close(caseId: string, decision: Decision) {
    const at = new Date("2026-11-27T07:05:00.000Z");
    await t.db
      .update(cases)
      .set({ status: "closed", closedAt: at, updatedAt: at })
      .where(eq(cases.id, caseId));
    await t.db.insert(decisions).values({
      caseId,
      decision,
      reason: "Lý do nội bộ của nhân viên",
      decidedBy: staffId,
      engineVerdict: "suspicious",
      disagreesWithEngine: false,
    });
  }

  it("SO-04-AC04: shows a waiting case as pending_review, forgiving how codes are typed", async () => {
    const { code } = await newCase();
    const digits = String(Number(code.slice(3)));
    for (const caseCode of [code, code.toLowerCase(), digits]) {
      const found = await lookupPublicStatus({ caseCode, secretCode: TYPED }, { db: t.db });
      expect(found).toMatchObject({ caseCode: code, status: "pending_review" });
    }
  });

  it.each(["confirmed_scam", "not_scam", "insufficient_evidence"] as const)(
    "SO-04-AC04: shows a closed case as its decision %s, with nothing internal",
    async (decision) => {
      const { id, code } = await newCase();
      await close(id, decision);
      expect(
        await lookupPublicStatus({ caseCode: code, secretCode: SECRET }, { db: t.db }),
      ).toEqual({ caseCode: code, status: decision, updatedAt: "2026-11-27T07:05:00.000Z" });
    },
  );

  it("SO-04-AC04: answers the same null for every kind of mismatch", async () => {
    const { code } = await newCase();
    for (const req of [
      { caseCode: code, secretCode: "K7QX2M9Q" },
      { caseCode: code, secretCode: "!!" },
      { caseCode: "SC-9999", secretCode: SECRET },
      { caseCode: "không phải mã", secretCode: SECRET },
    ]) {
      expect(await lookupPublicStatus(req, { db: t.db })).toBeNull();
    }
  });
});
