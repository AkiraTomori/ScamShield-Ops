import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEMO_MESSAGES } from "@scamshield/shared";
import { vi } from "../../src/copy/vi";
import HomePage from "../../src/app/page";

// Spec §9, verbatim.
const SPEC_DISCLAIMER =
  "Kết quả mang tính tham khảo. Hãy xác minh qua kênh chính thức của tổ chức trước khi chuyển tiền hoặc cung cấp thông tin.";

describe("analysis page", () => {
  it("shows the spec §9 disclaimer verbatim", () => {
    expect(vi.disclaimer).toBe(SPEC_DISCLAIMER);
    expect(renderToStaticMarkup(<HomePage />)).toContain(SPEC_DISCLAIMER);
  });

  it("never presents 'an toàn' as a verdict", () => {
    const text = renderToStaticMarkup(<HomePage />).toLowerCase();
    expect(text).not.toContain("an toàn");
  });

  it("SO-01-AC01: has a labelled text box and a check button", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toMatch(/<label for="message"[^>]*>Dán tin nhắn bạn nhận được<\/label>/);
    expect(html).toMatch(/<textarea[^>]*id="message"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Kiểm tra<\/button>/);
  });

  it("SO-10-AC05: offers the sample messages as buttons", () => {
    const html = renderToStaticMarkup(<HomePage />);
    const chips = DEMO_MESSAGES.flatMap((m) => (m.chip === null ? [] : [m.chip]));
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.length).toBeLessThanOrEqual(4);
    for (const chip of chips) {
      expect(html).toMatch(new RegExp(`<button[^>]*type="button"[^>]*>${chip}</button>`));
    }
  });

  // P5: nothing a user could have typed ever becomes a link.
  it("P5: its only link is our own lookup page", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect([...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual(["/tra-cuu"]);
  });
});
