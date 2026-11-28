import type { CaseListItem, CaseListPage } from "@scamshield/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vitest } from "vitest";
import { vi } from "../../src/copy/vi";
import { CaseList } from "../../src/features/cases/CaseList";
import { caseListHref, parseCaseListQuery } from "../../src/features/cases/list-url";
import { formatShortTime } from "../../src/features/lookup/format-time";

vitest.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const DEFAULT = { status: "pending_review", verdict: null, code: "", page: 1 } as const;

describe("case list address", () => {
  it("starts with the waiting cases on page 1", () => {
    expect(parseCaseListQuery({})).toEqual(DEFAULT);
    expect(caseListHref(DEFAULT)).toBe("/ops");
  });

  it("SO-06-AC05: keeps every filter through the URL", () => {
    const query = { status: "closed", verdict: "high_risk", code: "SC-0101", page: 3 } as const;
    const href = caseListHref(query);
    expect(href).toBe("/ops?trang-thai=closed&verdict=high_risk&ma=SC-0101&trang=3");
    const params = Object.fromEntries(new URL(href, "http://app.invalid").searchParams);
    expect(parseCaseListQuery(params)).toEqual(query);
  });

  it.each([
    { "trang-thai": "deleted", verdict: "safe", trang: "0" },
    { "trang-thai": "", verdict: "", ma: "  ", trang: "-2" },
    { "trang-thai": ["closed", "all"], verdict: ["high_risk", "all"], trang: "1.5" },
    { trang: "abc" },
    { trang: "1e999" },
  ])("falls back to the defaults for %j", (params) => {
    expect(parseCaseListQuery(params)).toEqual(DEFAULT);
  });
});

const ITEM: CaseListItem = {
  caseCode: "SC-0101",
  createdAt: "2026-11-22T07:05:00.000Z",
  engineVerdict: "high_risk",
  riskTypes: ["brand_impersonation", "otp_phishing"],
  status: "pending_review",
  isSeed: false,
  decision: null,
  relatedCount: 0,
};

const page = (overrides: Partial<CaseListPage> = {}): CaseListPage => ({
  items: [ITEM],
  page: 1,
  totalPages: 1,
  hasAnyCase: true,
  ...overrides,
});

const render = (data: CaseListPage, query = parseCaseListQuery({})) =>
  renderToStaticMarkup(<CaseList page={data} query={query} />);

describe("case list", () => {
  it("shows the row in Vietnam time with a real link to the case", () => {
    const html = render(page());
    expect(formatShortTime(ITEM.createdAt)).toBe("22/11 14:05");
    expect(html).toContain("22/11 14:05");
    expect(html).toContain('href="/ops/ho-so/SC-0101"');
    expect(html).toContain("Nguy cơ cao");
    expect(html).toContain("Mạo danh thương hiệu, Lừa lấy OTP");
    expect(html).toContain("Chờ xem xét");
    expect(html).not.toContain(vi.ops.list.seed);
  });

  it("SO-10-AC03: marks seeded cases, and shows the decision of a closed one", () => {
    const html = render(
      page({ items: [{ ...ITEM, isSeed: true, status: "closed", decision: "not_scam" }] }),
    );
    expect(html).toContain("Dữ liệu mẫu");
    expect(html).toContain("Đã đóng");
    expect(html).toContain("Không phải lừa đảo");
  });

  it("SO-03-AC03, AC04: has no safe verdict and no percentage", () => {
    for (const engineVerdict of ["high_risk", "suspicious", "no_signal", "inconclusive"] as const) {
      const html = render(page({ items: [{ ...ITEM, engineVerdict, riskTypes: [] }] }));
      expect(html.toLowerCase()).not.toContain("an toàn");
      // Tailwind classes carry no % here either, so any one would be text.
      expect(html).not.toContain("%");
    }
  });

  it("SO-07-AC01: counts related cases in their own column, with a dash for none", () => {
    expect(render(page())).toMatch(/>Liên quan<\/th>/);
    expect(render(page())).toMatch(/<td[^>]*>—<\/td><\/tr>/);
    expect(render(page({ items: [{ ...ITEM, relatedCount: 3 }] }))).toMatch(
      /<td[^>]*>3<\/td><\/tr>/,
    );
  });

  it("keeps the filters in the page links", () => {
    const query = parseCaseListQuery({ "trang-thai": "all", trang: "2" });
    const html = render(page({ page: 2, totalPages: 3 }), query);
    expect(html).toContain("Trang 2/3");
    expect(html).toContain('href="/ops?trang-thai=all"');
    expect(html).toContain('href="/ops?trang-thai=all&amp;trang=3"');
  });

  it("tells an empty database from filters that match nothing", () => {
    expect(render(page({ items: [], hasAnyCase: false }))).toBe("<p>Chưa có hồ sơ nào.</p>");
    const filtered = render(page({ items: [] }));
    expect(filtered).toContain("Không có hồ sơ khớp bộ lọc.");
    expect(filtered).toContain("Xoá bộ lọc");
    expect(filtered).toContain('href="/ops?trang-thai=all"');
  });
});
