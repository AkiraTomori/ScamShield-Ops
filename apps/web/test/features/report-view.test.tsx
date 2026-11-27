import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { ReportChannel } from "@scamshield/shared";
import { ConfirmDialog } from "../../src/components/ConfirmDialog";
import { vi } from "../../src/copy/vi";
import { ReportForm, type ReportFormProps } from "../../src/features/report/ReportForm";
import { ReportAlreadySent, ReportSent } from "../../src/features/report/ReportReceipt";

const nothing = () => {};
const form = (over: Partial<ReportFormProps> = {}) => (
  <ReportForm
    channel={null}
    note=""
    sending={false}
    onChannel={nothing}
    onNote={nothing}
    onSubmit={nothing}
    {...over}
  />
);
const sent = <ReportSent caseCode="SC-0101" secretCode="K7QX-2M9P" />;
const already = <ReportAlreadySent caseCode="SC-0101" />;

const everyView: [string, ReactElement][] = [
  ["form", form()],
  ["form with errors", form({ channelError: "Lỗi", noteError: "Lỗi", error: "Lỗi" })],
  ["sent", sent],
  ["already sent", already],
  [
    "confirm",
    <ConfirmDialog
      key="c"
      message={vi.report.confirmLeave}
      confirmLabel={vi.report.confirmAnother}
      cancelLabel={vi.report.confirmBack}
      onConfirm={nothing}
      onCancel={nothing}
    />,
  ],
];

// U-06: static markup is used for invariants only.
describe("report views", () => {
  it.each(everyView)("SO-03-AC03, AC04, P5: %s keeps the display rules", (_, element) => {
    const html = renderToStaticMarkup(element).toLowerCase();
    expect(html).not.toContain("an toàn");
    expect(html).not.toContain("%");
    // The only link any of these may carry is our own lookup page.
    for (const [, href] of html.matchAll(/href="([^"]*)"/g)) expect(href).toBe("/tra-cuu");
  });

  it("SO-04-AC02: offers the five channels and a 500-character note", () => {
    const html = renderToStaticMarkup(form());
    for (const channel of ReportChannel.options) {
      expect(html).toContain(`value="${channel}"`);
      expect(html).toContain(`>${vi.report.channel[channel]}</label>`);
    }
    expect(html).toContain("0/500");
    expect(html).toContain('method="post"');
  });

  it("locks the send button when the analysis is gone", () => {
    expect(renderToStaticMarkup(form({ gone: true }))).toMatch(
      /<button[^>]*type="submit"[^>]*disabled=""/,
    );
  });

  it("SO-04-AC01, AC04: shows both codes, the warning and a lookup link in a new tab", () => {
    const html = renderToStaticMarkup(sent);
    for (const text of ["SC-0101", "K7QX-2M9P", vi.report.sent, vi.report.keepCodes]) {
      expect(html).toContain(text);
    }
    expect(html).toMatch(/<a href="\/tra-cuu" target="_blank"/);
  });

  it("SO-04-AC03: shows no secret code for a report sent before", () => {
    const html = renderToStaticMarkup(already);
    expect(html).toContain("SC-0101");
    expect(html).toContain(vi.report.alreadySent);
    expect(html).toContain(vi.report.secretLost);
    expect(html).not.toContain(vi.report.secretCode + "</p>");
  });

  // docs/product/ui-pages.md §2.4 and report-flow §2.2, §5, word for word.
  it("uses the standard wording", () => {
    expect(vi.report).toMatchObject({
      open: "Gửi báo cáo cho đội vận hành",
      submit: "Gửi báo cáo",
      submitting: "Đang gửi…",
      failed: "Chưa gửi được báo cáo. Hãy thử lại.",
      analysisGone:
        "Không tìm thấy kết quả phân tích này. Hãy kiểm tra lại tin nhắn rồi gửi báo cáo.",
      sent: "Đã gửi báo cáo.",
      keepCodes: "Lưu lại cả hai mã để tra cứu. Mã bí mật sẽ không hiển thị lại.",
      alreadySent: "Báo cáo này đã được gửi trước đó",
      useSavedSecret: "Dùng mã bí mật bạn đã lưu để tra cứu.",
      secretLost: "Nếu bạn chưa kịp lưu mã bí mật, đội vận hành vẫn nhận được báo cáo này.",
      locked: "Đã gửi báo cáo cho tin này. Bấm Kiểm tra tin khác để kiểm tin mới.",
      confirmLeave: "Bạn đã lưu mã hồ sơ và mã bí mật chưa? Mã bí mật sẽ không hiển thị lại.",
      confirmAnother: "Đã lưu, kiểm tin khác",
      confirmBack: "Quay lại",
    });
    expect(vi.copyCode.manual).toBe("Hãy tự sao chép mã");
  });
});
