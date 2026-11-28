import type {
  CaseStatus,
  CheckStatus,
  CheckType,
  Decision,
  InconclusiveReason,
  PublicCaseStatus,
  RedactionCounts,
  ReportChannel,
  RiskType,
  RuleCode,
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
    // ui-pages §2.3, word for word (SO-02-AC04).
    noSignals: "Chưa phát hiện tín hiệu nào",
    noIndicators: "Không tìm thấy đường dẫn, số điện thoại hay số tài khoản",
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
  // ui-pages §2.4, report-flow §2.2 and §5, wireframe design/pages §2.3.
  report: {
    open: "Gửi báo cáo cho đội vận hành",
    channelLegend: "Bạn nhận tin qua đâu?",
    channel: {
      sms: "SMS",
      zalo: "Zalo",
      messenger: "Messenger",
      email: "Email",
      other: "Khác",
    } satisfies Record<ReportChannel, string>,
    noteLabel: "Ghi chú (không bắt buộc)",
    submit: "Gửi báo cáo",
    submitting: "Đang gửi…",
    failed: "Chưa gửi được báo cáo. Hãy thử lại.",
    analysisGone:
      "Không tìm thấy kết quả phân tích này. Hãy kiểm tra lại tin nhắn rồi gửi báo cáo.",
    sent: "Đã gửi báo cáo.",
    caseCode: "Mã hồ sơ",
    secretCode: "Mã bí mật",
    keepCodes: "Lưu lại cả hai mã để tra cứu. Mã bí mật sẽ không hiển thị lại.",
    lookupLink: "Tra cứu trạng thái",
    newTab: "(mở tab mới)",
    alreadySent: "Báo cáo này đã được gửi trước đó",
    useSavedSecret: "Dùng mã bí mật bạn đã lưu để tra cứu.",
    secretLost: "Nếu bạn chưa kịp lưu mã bí mật, đội vận hành vẫn nhận được báo cáo này.",
    locked: "Đã gửi báo cáo cho tin này. Bấm Kiểm tra tin khác để kiểm tin mới.",
    confirmLeave: "Bạn đã lưu mã hồ sơ và mã bí mật chưa? Mã bí mật sẽ không hiển thị lại.",
    confirmAnother: "Đã lưu, kiểm tin khác",
    confirmBack: "Quay lại",
  },
  // FraudOps: ui-pages §4, fraudops §3.
  ops: {
    productName: "FraudOps",
    description: "Trang xử lý hồ sơ của đội vận hành.",
    cases: "Hồ sơ",
    // The case list: ui-pages §5, fraudops §4, design-system §3.
    list: {
      filtersLabel: "Lọc hồ sơ",
      statusLabel: "Trạng thái",
      verdictLabel: "Đánh giá của engine",
      codeLabel: "Tìm mã hồ sơ",
      codeHint: "Khi tìm theo mã, bộ lọc trạng thái được bỏ qua.",
      all: "Tất cả",
      apply: "Lọc",
      columnCode: "Mã hồ sơ",
      columnTime: "Thời điểm",
      columnRisks: "Loại rủi ro",
      status: {
        pending_review: "Chờ xem xét",
        closed: "Đã đóng",
      } satisfies Record<CaseStatus, string>,
      decision: {
        confirmed_scam: "Xác nhận lừa đảo",
        not_scam: "Không phải lừa đảo",
        insufficient_evidence: "Chưa đủ bằng chứng",
      } satisfies Record<Decision, string>,
      riskType: {
        brand_impersonation: "Mạo danh thương hiệu",
        otp_phishing: "Lừa lấy OTP",
        payment_request: "Yêu cầu chuyển tiền",
        fake_prize: "Trúng thưởng giả",
        other: "Khác",
      } satisfies Record<RiskType, string>,
      seed: "Dữ liệu mẫu",
      empty: "Chưa có hồ sơ nào.",
      noMatch: "Không có hồ sơ khớp bộ lọc.",
      clear: "Xoá bộ lọc",
      pagesLabel: "Phân trang",
      previous: "‹ Trước",
      next: "Sau ›",
      pageOf: (page: number, total: number) => `Trang ${page}/${total}`,
      loading: "Đang tải danh sách…",
      failed: "Không tải được danh sách.",
    },
    // The case page: ui-pages §6, fraudops §5, wireframe design/pages §6.
    detail: {
      back: "‹ Danh sách",
      source: "Báo cáo từ người dùng",
      via: {
        sms: "qua SMS",
        zalo: "qua Zalo",
        messenger: "qua Messenger",
        email: "qua email",
        other: "qua kênh khác",
      } satisfies Record<ReportChannel, string>,
      evidenceHeading: "Bằng chứng",
      contentHeading: "Nội dung (đã che dữ liệu nhạy cảm)",
      noteHeading: "Ghi chú của người báo cáo",
      noNote: "Không có ghi chú.",
      engineHeading: "Đánh giá của engine",
      risks: "Loại rủi ro",
      rule: "Quy tắc kích hoạt",
      // design-system §3.
      rules: {
        R0: "AI không chạy được",
        R1: "Bằng chứng đã xác minh hoặc danh sách đen",
        R2: "Câu lệnh nhắm vào AI kèm dấu hiệu khác",
        R3: "Tên miền đánh lừa + đòi thông tin hoặc tiền",
        R4: "Đòi thông tin bảo mật kèm đe doạ/gấp/đường dẫn",
        R5: "Từ hai dấu hiệu mạnh",
        R6: "Một dấu hiệu mạnh",
        R7: "Nhiều dấu hiệu vừa/yếu",
        R8: "Thiếu bằng chứng",
        R9: "Không có dấu hiệu",
      } satisfies Record<RuleCode, string>,
      indicatorsHeading: "Chỉ dấu và phép kiểm",
      checkSignalsHeading: "Dấu hiệu do kiểm tra",
      brands: "Thương hiệu được nhắc tới",
      aiHeading: "Nhận định của AI",
      summaryHeading: "Tóm tắt điều tra",
      // design-system §3, contracts A-02.
      noSummary: "Chưa có tóm tắt AI cho hồ sơ này. Hãy kết luận dựa trên bằng chứng.",
      nextStepsHeading: "Đề xuất bước tiếp theo",
      aiSignalsHeading: "Dấu hiệu do AI nhận định",
      explanationHeading: "Giải thích đã hiện cho người dùng",
      notFound: (code: string | null) =>
        code ? `Không tìm thấy hồ sơ ${code}.` : "Không tìm thấy hồ sơ.",
      backToList: "Về danh sách hồ sơ",
      failed: "Không tải được hồ sơ.",
    },
    // The conclusion: ui-pages §6.2, fraudops §5.4, design-system §3.
    decision: {
      heading: "Kết luận",
      choiceLegend: "Chọn kết luận",
      reasonLabel: "Lý do *",
      submit: "Lưu kết luận và đóng hồ sơ",
      submitting: "Đang lưu…",
      failed: "Chưa lưu được kết luận. Hãy thử lại.",
      takenPending: "Hồ sơ đã được người khác kết luận.",
      takenBy: (name: string, time: string) => `Hồ sơ đã được ${name} kết luận lúc ${time}.`,
      unsavedReason: "Lý do bạn đang viết (chưa lưu)",
      expired: "Phiên đăng nhập đã hết hạn.",
      notFound: "Không tìm thấy hồ sơ.",
      closedWithoutDecision: "Hồ sơ đã đóng nhưng không có kết luận được lưu.",
      reason: "Lý do",
      // Verbatim from SO-06-AC04.
      disagrees: "Nhân viên không đồng ý với đánh giá AI",
    },
    logout: "Đăng xuất",
    loggingOut: "Đang đăng xuất…",
    logoutFailed: "Chưa đăng xuất được. Hãy thử lại.",
    login: {
      heading: "Đăng nhập",
      username: "Tên đăng nhập",
      password: "Mật khẩu",
      submit: "Đăng nhập",
      submitting: "Đang đăng nhập…",
      missing: "Hãy nhập tên đăng nhập và mật khẩu.",
      failed: "Chưa đăng nhập được do lỗi kết nối. Hãy thử lại.",
      accountHint: "Tài khoản thử có trong hướng dẫn sử dụng.",
    },
  },
  copyCode: {
    action: "Sao chép",
    done: "Đã sao chép",
    manual: "Hãy tự sao chép mã",
  },
  // ui-pages §3 and the wireframe in design/pages §3.
  caseStatus: {
    nav: "Tra cứu báo cáo",
    heading: "Tra cứu báo cáo của bạn",
    codeLabel: "Mã hồ sơ",
    codePlaceholder: "SC-0007",
    secretLabel: "Mã bí mật",
    submit: "Tra cứu",
    submitting: "Đang tra cứu…",
    missing: "Hãy nhập cả mã hồ sơ và mã bí mật.",
    failed: "Chưa tra cứu được do lỗi kết nối. Hãy thử lại.",
    caseTitle: (code: string) => `Hồ sơ ${code}`,
    updatedAt: (time: string) => `Cập nhật: ${time}`,
  },
  // Labels verbatim from SO-04-AC04; design-system §3.
  publicStatus: {
    pending_review: {
      label: "Đang chờ xem xét",
      explanation: "Đội vận hành đã nhận báo cáo và chưa có kết luận.",
    },
    confirmed_scam: {
      label: "Đã xác nhận lừa đảo",
      explanation: "Đội vận hành đã xem xét và xác nhận tin nhắn này là lừa đảo.",
    },
    not_scam: {
      label: "Không phát hiện lừa đảo",
      explanation:
        "Đội vận hành đã xem xét và không phát hiện lừa đảo. Hãy vẫn xác minh qua kênh chính thức.",
    },
    insufficient_evidence: {
      label: "Chưa đủ bằng chứng",
      explanation: "Đội vận hành đã xem xét nhưng chưa đủ bằng chứng để kết luận. Hãy thận trọng.",
    },
  } satisfies Record<PublicCaseStatus, { label: string; explanation: string }>,
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
