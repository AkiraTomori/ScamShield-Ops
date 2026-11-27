import type {
  CheckStatus,
  CheckType,
  InconclusiveReason,
  RedactionCounts,
  SignalSource,
  SignalType,
  Verdict,
} from "@scamshield/shared";

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
  // The result block: design-system §3 and the wireframe in design/pages §2.2.
  result: {
    explanationHeading: "Vì sao",
    signalsHeading: "Dấu hiệu phát hiện",
    indicatorsHeading: "Đường dẫn, số điện thoại, tài khoản",
    recommendationsHeading: "Nên làm gì",
    /** P-01: hard evidence decided while the model step failed. */
    llmSkippedNote:
      "Bước phân tích bằng AI chưa chạy được; kết quả dựa trên kiểm tra của hệ thống.",
    redactionNotice: (kinds: string[]) =>
      `Đã che ${kinds.join(" / ")} trong nội dung trước khi phân tích.`,
    redactionKind: {
      otp: "mã OTP",
      password: "mật khẩu",
      card: "số thẻ",
    } satisfies Record<keyof RedactionCounts, string>,
  },
  inconclusiveReason: {
    insufficient_evidence:
      "Nội dung chưa đủ để đánh giá. Hãy thận trọng và xác minh qua kênh chính thức.",
    timeout: "Hệ thống phân tích quá lâu. Hãy thử lại sau ít phút.",
    llm_invalid_output: "Bước phân tích bằng AI đang gặp sự cố. Hãy thử lại sau ít phút.",
    llm_unavailable: "Bước phân tích bằng AI đang gặp sự cố. Hãy thử lại sau ít phút.",
  } satisfies Record<InconclusiveReason, string>,
  signalType: {
    claims_organization: "Tin xưng danh một tổ chức",
    urgency: "Tạo áp lực thời gian",
    threat: "Đe doạ khoá tài khoản, phạt hoặc kiện",
    credential_request: "Đòi mã OTP, mật khẩu hoặc thông tin thẻ",
    payment_request: "Yêu cầu chuyển tiền hoặc đóng phí",
    reward_promise: "Hứa trúng thưởng, hoàn tiền hoặc lợi nhuận",
    ai_directed_instruction: "Có câu tìm cách điều khiển hệ thống kiểm tra",
    brand_domain_mismatch: "Tên miền không thuộc thương hiệu được nhắc tới",
    lookalike_domain: "Tên miền giống tên miền chính thức",
    brand_in_subdomain: "Tên thương hiệu nằm trong tên miền phụ",
    shortened_url: "Dùng đường dẫn rút gọn",
    ip_url: "Đường dẫn dùng địa chỉ IP",
    risky_tld: "Đuôi tên miền hay bị lạm dụng",
    new_domain: "Tên miền mới đăng ký gần đây",
    blocklisted_url: "Đường dẫn có trong danh sách đen đã biết",
    verified_indicator: "Chỉ dấu này đã được đội vận hành xác minh là lừa đảo",
  } satisfies Record<SignalType, string>,
  checkType: {
    official_domain: "Tên miền chính thức của thương hiệu",
    lookalike: "Tên miền nhái",
    punycode: "Ký tự ngụy trang (punycode)",
    subdomain_brand: "Tên thương hiệu nằm trong tên miền phụ",
    shortener: "Đường dẫn rút gọn",
    ip_host: "Đường dẫn dùng địa chỉ IP",
    risky_tld: "Đuôi tên miền hay bị lạm dụng",
    domain_age: "Tuổi tên miền",
    blocklist: "Danh sách đen đã biết",
    verified_indicator: "Đã được đội vận hành xác minh",
  } satisfies Record<CheckType, string>,
  /** Sentences for the short codes in `Check.detail`. */
  checkDetail: {
    officialDomainWarn: (brand: string) => `Không thuộc tên miền chính thức của ${brand}`,
    officialDomainPass: (brand: string) => `Thuộc tên miền chính thức của ${brand}`,
    nearest: (domain: string, distance: string) => `Gần giống ${domain}, khác ${distance} ký tự`,
    containsAlias: (alias: string) => `Chứa tên thương hiệu “${alias}”`,
    decoded: (unicode: string) => `Hiển thị thành: ${unicode}`,
    ageDays: (days: string) => `Đăng ký ${days} ngày trước`,
  },
} as const;
