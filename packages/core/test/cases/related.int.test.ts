import { randomUUID } from "node:crypto";
import type { MatchableIndicatorType, RelatedCases } from "@scamshield/shared";
import { BRANDS, URL_LISTS } from "@scamshield/shared";
import { eq } from "drizzle-orm";
import { parse as parseDomain } from "tldts";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { analyzeMessage, saveAnalysis } from "../../src/analysis";
import type { StaffSession } from "../../src/auth";
import { findRelatedCases, getCaseDetail, listCases, UNMATCHED_DOMAINS } from "../../src/cases";
import { analyses, analysisIndicators, cases, decisions } from "../../src/db/schema";
import {
  createTestDatabase,
  insertAnalysis,
  insertCase,
  insertCaseWith,
  insertStaff,
  type TestDatabase,
} from "../db/helpers";
import { okText } from "../llm/helpers";

// Integration: needs a local Postgres. Skipped when DATABASE_URL is not in the environment.
const url = process.env.DATABASE_URL;
const SESSION = {
  staffUserId: "u",
  username: "judge1",
  displayName: "Giám khảo 1",
} as StaffSession;

const key = (type: MatchableIndicatorType, normalized: string) => ({ type, normalized });
const DOMAIN = key("domain", "vi-xac-minh.example");
const PHONE = key("phone", "+84901234567");
const ACCOUNT = key("bank_account", "0123456789");
const NOTHING: RelatedCases = { total: 0, items: [] };

describe("domains left out of matching", () => {
  // Indicators hold registrable domains: a deeper entry in a data file would never be excluded.
  it.each(UNMATCHED_DOMAINS)("%s is a registrable domain", (domain) => {
    expect(parseDomain(domain, { allowPrivateDomains: true }).domain).toBe(domain);
  });
});

describe.skipIf(!url)("related cases", () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase(url ?? "");
  });
  beforeEach(async () => {
    await t.db.delete(cases);
  });
  afterAll(async () => {
    await t?.drop();
  });

  /** `minute` orders the cases. */
  const newCase = (minute: number, indicators: ReturnType<typeof key>[], isSeed = false) =>
    insertCaseWith(t.db, indicators, {
      createdAt: new Date(Date.UTC(2026, 10, 28, 3, minute)),
      isSeed,
    });
  const related = (caseId: string) => findRelatedCases(SESSION, caseId, { db: t.db });
  const relatedCodes = async (caseId: string) =>
    (await related(caseId)).items.map((item) => item.caseCode);
  const list = () =>
    listCases(SESSION, { status: "all", verdict: null, code: "", page: 1 }, { db: t.db });
  const counts = async () =>
    Object.fromEntries((await list()).items.map((i) => [i.caseCode, i.relatedCount]));

  it("SO-07-AC01: two cases sharing an indicator see each other and not themselves", async () => {
    const first = await newCase(1, [DOMAIN, PHONE]);
    const second = await newCase(2, [DOMAIN], true);

    expect(await related(first.id)).toEqual({
      total: 1,
      items: [
        {
          caseCode: second.code,
          status: "pending_review",
          decision: null,
          isSeed: true,
          createdAt: "2026-11-28T03:02:00.000Z",
          sharedIndicators: [DOMAIN],
        },
      ],
    });
    expect(await relatedCodes(second.id)).toEqual([first.code]);
    expect(await counts()).toEqual({ [first.code]: 1, [second.code]: 1 });
  });

  it("SO-07-AC01: finds nothing without a shared (type, value) pair", async () => {
    const alone = await newCase(1, [DOMAIN, key("phone", "0123456789")]);
    const other = await newCase(2, [ACCOUNT, PHONE]);
    const empty = await newCase(3, []);

    for (const id of [alone.id, other.id, empty.id]) expect(await related(id)).toEqual(NOTHING);
    expect(await counts()).toEqual({ [alone.code]: 0, [other.code]: 0, [empty.code]: 0 });
  });

  it("ranks more shared indicators first, then the newest, counting each case once", async () => {
    const current = await newCase(1, [DOMAIN, PHONE, ACCOUNT]);
    const two = await newCase(2, [DOMAIN, ACCOUNT]);
    const olderOne = await newCase(3, [PHONE]);
    const newerOne = await newCase(4, [DOMAIN]);

    const result = await related(current.id);
    expect(result.total).toBe(3);
    expect(result.items.map((i) => i.caseCode)).toEqual([two.code, newerOne.code, olderOne.code]);
    expect(result.items[0]?.sharedIndicators).toEqual([ACCOUNT, DOMAIN]);
    expect((await counts())[current.code]).toBe(3);
  });

  it("leaves out an analysis nobody reported", async () => {
    const current = await newCase(1, [DOMAIN]);
    const unreported = await insertAnalysis(t.db);
    await t.db.insert(analysisIndicators).values({ analysisId: unreported, ...DOMAIN });
    expect(await related(current.id)).toEqual(NOTHING);
  });

  it("SO-07-AC01: does not match official brand domains or URL shorteners (ST-01)", async () => {
    const ignored = [
      ...BRANDS.flatMap((brand) => brand.domains),
      ...URL_LISTS.shorteners.map((entry) => entry.value),
    ].map((domain) => key("domain", domain));
    const first = await newCase(1, ignored);
    const second = await newCase(2, ignored);

    expect(await related(first.id)).toEqual(NOTHING);
    expect(await counts()).toEqual({ [first.code]: 0, [second.code]: 0 });

    // Another shared indicator still links them, and the ignored domains stay out of it.
    const third = await newCase(3, [...ignored, PHONE]);
    const fourth = await newCase(4, [...ignored, PHONE]);
    expect((await related(third.id)).items).toMatchObject([
      { caseCode: fourth.code, sharedIndicators: [PHONE] },
    ]);
  });

  it("matches hotline numbers", async () => {
    const hotline = key("phone", "19001234");
    const first = await newCase(1, [hotline]);
    const second = await newCase(2, [hotline]);
    expect(await relatedCodes(first.id)).toEqual([second.code]);
  });

  it("returns 20 rows of 25 matches and the full count", async () => {
    const current = await newCase(0, [DOMAIN]);
    const others: string[] = [];
    for (let minute = 1; minute <= 25; minute += 1) {
      others.push((await newCase(minute, [DOMAIN])).code);
    }

    const result = await related(current.id);
    expect(result.total).toBe(25);
    expect(result.items.map((i) => i.caseCode)).toEqual([...others].reverse().slice(0, 20));
    expect((await counts())[others[24]!]).toBe(25);
  });

  it("keeps a closed case, with its conclusion", async () => {
    const current = await newCase(1, [DOMAIN]);
    const closed = await newCase(2, [DOMAIN]);
    const at = new Date("2026-11-28T04:00:00.000Z");
    await t.db.update(cases).set({ status: "closed", closedAt: at }).where(eq(cases.id, closed.id));
    await t.db.insert(decisions).values({
      caseId: closed.id,
      decision: "confirmed_scam",
      reason: "Tên miền giả mạo thương hiệu.",
      decidedBy: await insertStaff(t.db),
      engineVerdict: "suspicious",
      disagreesWithEngine: false,
    });

    expect((await related(current.id)).items).toMatchObject([
      { caseCode: closed.code, status: "closed", decision: "confirmed_scam" },
    ]);
  });

  it("SO-07-AC01: the case page carries the related cases", async () => {
    const current = await newCase(1, [DOMAIN]);
    const other = await newCase(2, [DOMAIN]);
    // getCaseDetail parses the stored analysis, which the bare fixture does not satisfy.
    await t.db.update(analyses).set({
      details: { signals: [], indicators: [], explanation: null, recommendations: ["a", "b"] },
    });

    const detail = await getCaseDetail(SESSION, current.code, { db: t.db });
    expect(detail?.relatedCases).toMatchObject({ total: 1, items: [{ caseCode: other.code }] });
  });

  /** Runs the pipeline with a model that adds nothing, then reports the result. */
  async function report(message: string) {
    const outcome = await analyzeMessage(message, {
      llm: { chatJson: async () => okText('{"signals":[],"mentionedBrands":[]}') },
      models: { signals: "m", explain: "m" },
      brands: BRANDS,
      urlLists: URL_LISTS,
      now: () => new Date("2026-11-28T03:00:00.000Z"),
      random: () => "0123456789abcdef",
      newId: randomUUID,
    });
    await saveAnalysis(outcome, { db: t.db });
    return insertCase(t.db, outcome.result.analysisId);
  }

  it.each([
    ["domain", "Xem tại WWW.Vi-Xac-Minh.example/a ngay", "Vào vi-xac-minh.example", DOMAIN],
    ["subdomain", "Xem a.vi-xac-minh.example", "Vào vi-xac-minh.example", DOMAIN],
    ["phone", "Liên hệ 0901 234 567", "Gọi số +84901234567", PHONE],
    ["account", "Chuyển vào STK 0123 456 789", "Số tài khoản 0123456789", ACCOUNT],
  ])("SO-07-AC02: matches a %s written two ways", async (_name, one, two, shared) => {
    const first = await report(one);
    const second = await report(two);
    expect((await related(first.id)).items).toMatchObject([
      { caseCode: second.code, sharedIndicators: [shared] },
    ]);
  });
});
