import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi as mock } from "vitest";
import { PublicCaseStatus } from "@scamshield/shared";
import CaseStatusPage from "../../src/app/tra-cuu/page";
import { vi } from "../../src/copy/vi";
import { formatUpdatedAt } from "../../src/features/lookup/format-time";
import { StatusResult } from "../../src/features/lookup/StatusResult";
import { submitStatus } from "../../src/features/lookup/submit-status";

const FOUND = {
  caseCode: "SC-0101",
  status: "pending_review",
  updatedAt: "2026-11-22T07:05:00.000Z",
} as const;

describe("case status page", () => {
  // SO-04-AC04 and design-system §3, word for word.
  it("SO-04-AC04: names the four states", () => {
    expect(PublicCaseStatus.options.map((s) => vi.publicStatus[s].label)).toEqual([
      "Đang chờ xem xét",
      "Đã xác nhận lừa đảo",
      "Không phát hiện lừa đảo",
      "Chưa đủ bằng chứng",
    ]);
  });

  it.each(PublicCaseStatus.options)("SO-03-AC03, AC04: %s keeps the display rules", (status) => {
    const html = renderToStaticMarkup(<StatusResult result={{ ...FOUND, status }} />);
    expect(html).toContain(vi.publicStatus[status].label);
    expect(html.toLowerCase()).not.toContain("an toàn");
    expect(html).not.toContain("%");
    expect(html).not.toContain("href=");
  });

  it("shows the update time in Vietnam time", () => {
    expect(formatUpdatedAt(FOUND.updatedAt)).toBe("22/11/2026 14:05");
    expect(formatUpdatedAt("2026-11-22T17:00:00.000Z")).toBe("23/11/2026 00:00");
  });

  it("has two labelled fields, a button, the disclaimer and no way to FraudOps", () => {
    const html = renderToStaticMarkup(<CaseStatusPage />);
    expect(html).toMatch(/<label for="case-code"[^>]*>Mã hồ sơ<\/label>/);
    expect(html).toMatch(/<label for="secret-code"[^>]*>Mã bí mật<\/label>/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Tra cứu<\/button>/);
    expect(html).toContain('method="post"');
    expect(html).toContain(vi.disclaimer);
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/"]);
  });

  it("SO-04-AC04: sends both codes in the body, never in the URL", async () => {
    const fetchImpl = mock.fn<typeof fetch>(async () => Response.json(FOUND));
    const req = { caseCode: "SC-0101", secretCode: "K7QX-2M9P" };
    expect(await submitStatus(req, { fetchImpl })).toEqual({ kind: "found", result: FOUND });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("/api/case-status");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(req);
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "failed"],
  ])("maps %i to %s", async (status, kind) => {
    const fetchImpl = mock.fn<typeof fetch>(async () => Response.json({}, { status }));
    expect(await submitStatus({ caseCode: "1", secretCode: "2" }, { fetchImpl })).toEqual({
      kind,
    });
  });
});
