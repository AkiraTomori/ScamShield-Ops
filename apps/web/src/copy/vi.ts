import type { CheckStatus, SignalSource, Verdict } from "@scamshield/shared";

/** All user-facing Vietnamese text (conventions/frontend §4). Wording: design-system §3. */
export const vi = {
  productName: "ScamShield",
  tagline: "Kiểm tra tin nhắn đáng ngờ trước khi bạn chuyển tiền hoặc đưa thông tin.",
  // Verbatim from spec §9; covered by a string-comparison test.
  disclaimer:
    "Kết quả mang tính tham khảo. Hãy xác minh qua kênh chính thức của tổ chức trước khi chuyển tiền hoặc cung cấp thông tin.",
  verdict: {
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
  } satisfies Record<Verdict, { label: string; explanation: string }>,
  signalSource: {
    deterministic: "Kiểm tra",
    ai: "AI nhận định",
  } satisfies Record<SignalSource, string>,
  checkStatus: {
    warn: "Cảnh báo",
    pass: "Không phát hiện vấn đề",
    unavailable: "Không tra được",
  } satisfies Record<CheckStatus, string>,
  checkUnavailableNote: "Không tra được kết quả. Điều này không có nghĩa là không có vấn đề.",
  retry: "Thử lại",
  // ui-pages §2.1–§2.2 and the wireframe in design/pages §2.1.
  analysis: {
    heading: "Tin nhắn này có đáng ngờ không?",
    intro: "Dán tin bạn nhận được, hệ thống chỉ ra dấu hiệu và nên làm gì.",
    inputLabel: "Dán tin nhắn bạn nhận được",
    privacyHint: "Đừng dán mật khẩu hay mã OTP. Nếu có, hệ thống sẽ tự che trước khi phân tích.",
    samplesLabel: "Thử tin mẫu:",
    submit: "Kiểm tra",
    submitting: "Đang kiểm tra…",
    slow: "Vẫn đang phân tích, thường mất dưới 10 giây",
    failed: "Chưa kiểm tra được do lỗi kết nối. Nội dung của bạn vẫn còn, hãy thử lại.",
    another: "Kiểm tra tin khác",
  },
} as const;
