import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vi } from "../../src/copy/vi";
import HomePage from "../../src/app/page";

// Spec §9, verbatim.
const SPEC_DISCLAIMER =
  "Kết quả mang tính tham khảo. Hãy xác minh qua kênh chính thức của tổ chức trước khi chuyển tiền hoặc cung cấp thông tin.";

describe("skeleton page", () => {
  it("shows the spec §9 disclaimer verbatim", () => {
    expect(vi.disclaimer).toBe(SPEC_DISCLAIMER);
    expect(renderToStaticMarkup(<HomePage />)).toContain(SPEC_DISCLAIMER);
  });

  it("never presents 'an toàn' as a verdict", () => {
    const text = renderToStaticMarkup(<HomePage />).toLowerCase();
    expect(text).not.toContain("an toàn");
  });

  it("has no input and no link: no user content and no URL is handled yet", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).not.toMatch(/<(input|textarea|a)\b/);
  });
});
