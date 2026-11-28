import type { ConfirmedIndicatorPage } from "@scamshield/shared";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vitest } from "vitest";
import StaffLayout from "../../src/app/ops/(staff)/layout";
import { vi } from "../../src/copy/vi";
import { ConfirmedList } from "../../src/features/indicators/ConfirmedList";
import { RemoveDialog } from "../../src/features/indicators/RemoveDialog";
import { indicatorsHref, parseIndicatorsPage } from "../../src/features/indicators/url";

vitest.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
  unstable_rethrow: () => {},
}));
vitest.mock("../../src/server/ops-session", () => ({
  getStaffSession: async () => ({ displayName: "Giám khảo 1" }),
}));

const PAGE: ConfirmedIndicatorPage = {
  items: [
    {
      id: "3f1c2b7e-8a4d-4f0b-9c21-6e5d4a3b2c10",
      type: "domain",
      normalized: "vi-xac-minh.example",
      sourceCaseCode: "SC-0101",
      confirmedAt: "2026-11-22T07:10:00.000Z",
      confirmedBy: "Giám khảo 1",
    },
    {
      id: "5b0f3c1e-9a52-4c64-9d0e-7b1f2a3c4d5e",
      type: "phone",
      normalized: "+84900000001",
      sourceCaseCode: "SC-0102",
      confirmedAt: "2026-11-22T07:00:00.000Z",
      confirmedBy: "Giám khảo 2",
    },
  ],
  page: 1,
  totalPages: 1,
};

const render = (page: ConfirmedIndicatorPage = PAGE) =>
  renderToStaticMarkup(<ConfirmedList page={page} />);

describe("confirmed indicators page (SO-08-AC03)", () => {
  it("shows each indicator with its type, case, time and who confirmed it", () => {
    const html = render();
    for (const text of [
      "vi-xac-minh.example",
      "Tên miền",
      "SC-0101",
      "22/11 14:10",
      "Giám khảo 1",
      "+84900000001",
      "Số điện thoại",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("P5: links to the source case only, never to an indicator", () => {
    const hrefs = [...render().matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/ops/ho-so/SC-0101", "/ops/ho-so/SC-0102"]);
  });

  it("names the indicator on each remove button", () => {
    const html = render();
    for (const { normalized } of PAGE.items) {
      expect(html).toContain(`aria-label="Gỡ ${normalized} khỏi danh sách"`);
    }
  });

  it("says so when the list is empty, keeping the live region", () => {
    const html = render({ items: [], page: 1, totalPages: 1 });
    expect(html).toContain(vi.ops.indicators.empty);
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain("<table");
  });

  it("asks for a reason with a counter, and never submits by GET", () => {
    const html = renderToStaticMarkup(
      <RemoveDialog
        indicator="vi-xac-minh.example"
        reason=""
        sending={false}
        onReason={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(html).toContain("Gỡ vi-xac-minh.example khỏi danh sách?");
    expect(html).toMatch(/<label for="removal-reason"[^>]*>Lý do \*<\/label>/);
    expect(html).toContain("0/500");
    expect(html).toContain('method="post"');
  });

  it("is in the staff navigation, beside the cases", async () => {
    const html = renderToStaticMarkup((await StaffLayout({ children: null })) as ReactNode);
    expect(html).toContain('href="/ops/chi-dau"');
    expect(html).toContain('href="/ops"');
    expect(html).toContain(vi.ops.indicators.heading);
  });

  it("keeps the page number on the address", () => {
    expect(indicatorsHref(1)).toBe("/ops/chi-dau");
    expect(indicatorsHref(3)).toBe("/ops/chi-dau?trang=3");
    for (const [value, page] of [
      ["2", 2],
      ["0", 1],
      ["abc", 1],
      [undefined, 1],
    ] as const) {
      expect(parseIndicatorsPage({ trang: value })).toBe(page);
    }
  });
});
