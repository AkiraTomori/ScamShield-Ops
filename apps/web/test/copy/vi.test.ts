import { describe, expect, it } from "vitest";
import { CheckStatus, SignalSource, Verdict } from "@scamshield/shared";
import { vi } from "../../src/copy/vi";

// docs/product/design-system.md §3, word for word.
describe("standard wording", () => {
  it("SO-03-AC03: labels and explains the four verdicts", () => {
    expect(vi.verdict).toEqual({
      high_risk: {
        label: "Nguy cơ cao",
        explanation:
          "Tin nhắn có nhiều dấu hiệu lừa đảo. Đừng bấm đường dẫn, đừng chuyển tiền hay cung cấp mã OTP.",
      },
      suspicious: {
        label: "Đáng ngờ",
        explanation:
          "Tin nhắn có dấu hiệu bất thường. Hãy xác minh qua kênh chính thức trước khi làm theo.",
      },
      no_signal: {
        label: "Chưa phát hiện dấu hiệu lừa đảo",
        explanation:
          "Hệ thống chưa thấy dấu hiệu lừa đảo, nhưng điều này không đảm bảo tin nhắn là thật. Hãy tự kiểm tra qua kênh chính thức.",
      },
      inconclusive: {
        label: "Chưa đủ thông tin để kết luận",
        explanation:
          "Hệ thống chưa đủ bằng chứng để đánh giá. Hãy thận trọng và xác minh qua kênh chính thức.",
      },
    });
    expect(Object.keys(vi.verdict)).toEqual(Verdict.options);
  });

  it("SO-03-AC04: names both signal sources", () => {
    expect(vi.signalSource).toEqual({ deterministic: "Kiểm tra", ai: "AI nhận định" });
    expect(Object.keys(vi.signalSource)).toEqual(SignalSource.options);
  });

  it("SO-02-AC03: names check states and never reads 'unavailable' as no problem", () => {
    expect(vi.checkStatus).toEqual({
      warn: "Cảnh báo",
      pass: "Không phát hiện vấn đề",
      unavailable: "Không tra được",
    });
    expect(Object.keys(vi.checkStatus)).toEqual(CheckStatus.options);
    expect(vi.checkUnavailableNote).toBe(
      "Không tra được kết quả. Điều này không có nghĩa là không có vấn đề.",
    );
  });

  // docs/product/ui-pages.md §2.1 and §2.2, word for word.
  it("SO-01-AC02, SO-10-AC05: words the input panel", () => {
    expect(vi.analysis.inputLabel).toBe("Dán tin nhắn bạn nhận được");
    expect(vi.analysis.privacyHint).toBe(
      "Đừng dán mật khẩu hay mã OTP. Nếu có, hệ thống sẽ tự che trước khi phân tích.",
    );
    expect(vi.analysis.samplesLabel).toBe("Thử tin mẫu:");
    expect(vi.analysis.submit).toBe("Kiểm tra");
    expect(vi.analysis.another).toBe("Kiểm tra tin khác");
  });

  it("SO-03-AC06: words the waiting and connection-error states", () => {
    expect(vi.analysis.submitting).toBe("Đang kiểm tra…");
    expect(vi.analysis.slow).toBe("Vẫn đang phân tích, thường mất dưới 10 giây");
    expect(vi.analysis.failed).toBe(
      "Chưa kiểm tra được do lỗi kết nối. Nội dung của bạn vẫn còn, hãy thử lại.",
    );
  });

  // docs/product/ui-pages.md §2.3, word for word.
  it("SO-02-AC04: words the empty signal and indicator sections", () => {
    expect(vi.result.noSignals).toBe("Chưa phát hiện tín hiệu nào");
    expect(vi.result.noIndicators).toBe("Không tìm thấy đường dẫn, số điện thoại hay số tài khoản");
  });

  it("SO-03-AC03, AC04: has no 'an toàn' and no percentage anywhere", () => {
    const text = JSON.stringify(vi).toLowerCase();
    expect(text).not.toContain("an toàn");
    expect(text).not.toContain("%");
  });
});
