import type { CaseDetail } from "@scamshield/shared";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vi } from "../../src/copy/vi";
import { CaseDetailView } from "../../src/features/cases/CaseDetailView";

const BAD = "https://vi-xac-minh.example/otp";

const DETAIL: CaseDetail = {
  caseId: "0b7c0a7e-3c1f-4b52-9a77-1f2d3e4a5b6c",
  caseCode: "SC-0101",
  status: "pending_review",
  createdAt: "2026-11-22T07:02:00.000Z",
  isSeed: true,
  source: "user_report",
  channel: "sms",
  reporterNote: `Ghi chú ${BAD}`,
  redactedContent: `Dòng một: xác minh tại ${BAD}\nDòng hai: nhập mã [OTP ĐÃ CHE] <b>ngay</b>`,
  analysis: {
    analysisId: "5b0f3c1e-9a52-4c64-9d0e-7b1f2a3c4d5e",
    verdict: "high_risk",
    inconclusiveReason: null,
    riskTypes: ["brand_impersonation", "otp_phishing"],
    signals: [
      {
        type: "brand_domain_mismatch",
        source: "deterministic",
        evidence: BAD,
        indicator: "vi-xac-minh.example",
      },
      { type: "urgency", source: "ai", evidence: `gấp ${BAD}`, indicator: null },
    ],
    indicators: [
      {
        type: "url",
        value: BAD,
        normalized: BAD,
        checks: [{ type: "domain_age", status: "unavailable", detail: null }],
      },
    ],
    explanation: "Giải thích của AI.",
    recommendations: ["Lời khuyên cho người gửi.", "Lời khuyên thứ hai."],
    redactions: { otp: 1, password: 0, card: 0 },
    rule: "R3",
    promptVersion: "p",
    rulesVersion: "r",
    createdAt: "2026-11-22T07:00:00.000Z",
  },
  aiSummary: { summary: `Tóm tắt ${BAD}`, nextSteps: [`Mở ${BAD}`] },
  decision: null,
  relatedCases: { total: 0, items: [] },
};

const render = (detail: CaseDetail = DETAIL) =>
  renderToStaticMarkup(<CaseDetailView detail={detail} />);

/** The markup of the evidence block and of the AI block. */
function blocks(html: string) {
  const sections = html.split("<section").slice(1);
  expect(sections).toHaveLength(2);
  return { evidence: sections[0]!, ai: sections[1]! };
}

describe("case detail", () => {
  it("SO-05-AC01: shows the case, its source, channel and time", () => {
    const html = render();
    for (const text of [
      "SC-0101",
      "Chờ xem xét",
      "22/11/2026 14:02",
      "Báo cáo từ người dùng · qua SMS",
      "Dữ liệu mẫu",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("SO-05-AC03: keeps evidence first and AI judgement apart", () => {
    const { evidence, ai } = blocks(render());
    for (const text of [
      "Bằng chứng",
      "Dòng hai",
      "Ghi chú",
      "Nguy cơ cao",
      "Mạo danh thương hiệu, Lừa lấy OTP",
      "Tên miền đánh lừa + đòi thông tin hoặc tiền",
      "Tuổi tên miền",
      vi.signalType.brand_domain_mismatch,
      "Đã che mã OTP",
    ]) {
      expect(evidence).toContain(text);
    }
    expect(evidence).not.toContain("Tóm tắt");
    expect(evidence).not.toContain(vi.signalType.urgency);
    expect(evidence).not.toContain(vi.signalSource.ai);

    for (const text of [
      "Nhận định của AI",
      "AI nhận định",
      "Tóm tắt",
      "Đề xuất bước tiếp theo",
      vi.signalType.urgency,
      "Giải thích của AI.",
    ]) {
      expect(ai).toContain(text);
    }
    expect(ai).not.toContain("Dòng hai");
    expect(ai).not.toContain(vi.signalType.brand_domain_mismatch);
    // Advice written for the sender belongs to neither block.
    expect(render()).not.toContain("Lời khuyên");
  });

  it("P5: nothing from the message, the reporter or the model is a link or markup", () => {
    const html = render();
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/ops"]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;ngay&lt;/b&gt;");
    expect(html).not.toMatch(/<(img|iframe)/);
  });

  it("SO-06-AC06, P1: offers no action on the next steps or anywhere else", () => {
    expect(render()).not.toContain("<button");
  });

  it("A-02: says so when there is no AI summary", () => {
    const html = render({
      ...DETAIL,
      aiSummary: null,
      analysis: { ...DETAIL.analysis, signals: [], indicators: [], explanation: null },
    });
    const { evidence, ai } = blocks(html);
    expect(ai).toContain("Chưa có tóm tắt AI cho hồ sơ này. Hãy kết luận dựa trên bằng chứng.");
    expect(ai).not.toContain("Đề xuất bước tiếp theo");
    expect(evidence).toContain("Chưa phát hiện tín hiệu nào");
    expect(evidence).toContain("Không tìm thấy đường dẫn, số điện thoại hay số tài khoản");
  });
});
