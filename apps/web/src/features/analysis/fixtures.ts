import type { AnalysisResult, Check, Indicator, Signal } from "@scamshield/shared";

/**
 * Hand-made results for the view-model tests and the `/xem-truoc` preview (scamshield-ui §4, U-04).
 * Check shapes follow the pipeline. Only reserved domains and the invented brand "Ví XYZ".
 */

const check = (
  type: Check["type"],
  status: Check["status"],
  detail: string | null = null,
): Check => ({ type, status, detail });

const indicator = (type: Indicator["type"], value: string, checks: Check[] = []): Indicator => ({
  type,
  value,
  normalized: value,
  checks,
});

const url = (value: string): Indicator => indicator("url", value, [check("ip_host", "pass")]);

/** The checks every domain gets; `extra` goes first, as `official_domain` does in the pipeline. */
const domain = (
  value: string,
  extra: Check[] = [],
  lookalike = check("lookalike", "pass"),
  punycode = check("punycode", "pass"),
) =>
  indicator("domain", value, [
    ...extra,
    lookalike,
    punycode,
    check("shortener", "pass"),
    check("risky_tld", "pass"),
  ]);

const rule = (type: Signal["type"], found: string): Signal => ({
  type,
  source: "deterministic",
  evidence: found,
  indicator: found,
});

const ai = (type: Signal["type"], evidence: string | null = null): Signal => ({
  type,
  source: "ai",
  evidence,
  indicator: null,
});

const BASE: AnalysisResult = {
  analysisId: "3f0c2a5e-1c1e-4a57-9a5e-0d6a5a1f2b3c",
  verdict: "no_signal",
  inconclusiveReason: null,
  riskTypes: [],
  signals: [],
  indicators: [],
  explanation: null,
  recommendations: [
    "Vẫn xác minh qua kênh chính thức trước khi chuyển tiền hoặc cung cấp thông tin.",
    "Nếu có người yêu cầu OTP, mật khẩu hay chuyển tiền gấp, hãy dừng lại và kiểm tra.",
  ],
  redactions: { otp: 0, password: 0, card: 0 },
  rule: "R9",
  promptVersion: "signals-v1",
  rulesVersion: "rules-v1",
  createdAt: "2026-11-27T10:00:00.000Z",
};

const CAUTION = "Hãy thận trọng và chưa làm theo yêu cầu trong tin.";
const NO_CLICK = "Không bấm vào đường dẫn trong tin nhắn.";
const RETRY_LATER = "Thử kiểm tra lại sau ít phút.";

const unresolved = (reason: NonNullable<AnalysisResult["inconclusiveReason"]>): AnalysisResult => ({
  ...BASE,
  verdict: "inconclusive",
  inconclusiveReason: reason,
  rule: "R0",
  indicators: [url("http://vi-xac-minh.example/"), domain("vi-xac-minh.example")],
  recommendations: [CAUTION, RETRY_LATER],
});

// Two long labels with nothing a browser could break on.
const LONG_HOST = `${"xacminhtaikhoan".repeat(4)}.${"khancapngaylaptuc".repeat(3)}.example`;

export const FIXTURES: { name: string; result: AnalysisResult }[] = [
  {
    name: "Nguy cơ cao, tên miền giả mạo",
    result: {
      ...BASE,
      verdict: "high_risk",
      rule: "R3",
      riskTypes: ["brand_impersonation", "otp_phishing"],
      signals: [
        rule("brand_domain_mismatch", "vi-xac-minh.example"),
        rule("lookalike_domain", "vi-xac-minh.example"),
        ai("credential_request", "nhập mã OTP để giữ tài khoản"),
        ai("urgency", "bị khoá trong hôm nay"),
        ai("claims_organization"),
      ],
      indicators: [
        url("http://vi-xac-minh.example/"),
        domain(
          "vi-xac-minh.example",
          [check("official_domain", "warn", "brand:vi-xyz")],
          check("lookalike", "warn", "nearest:vi-xyz.example:distance_2"),
        ),
        indicator("brand", "Ví XYZ"),
      ],
      explanation:
        "Tin nhắc tới Ví XYZ nhưng đường dẫn không thuộc tên miền chính thức, đồng thời đòi mã OTP và tạo áp lực thời gian.",
      recommendations: [
        "Không cung cấp mã OTP, mật khẩu hay số thẻ cho bất kỳ ai, kể cả người xưng là nhân viên.",
        NO_CLICK,
        "Liên hệ Ví XYZ qua ứng dụng chính thức hoặc số tổng đài trên website chính thức.",
        "Gửi báo cáo để đội vận hành xem xét.",
      ],
    },
  },
  {
    name: "Đáng ngờ, không có đường dẫn",
    result: {
      ...BASE,
      verdict: "suspicious",
      rule: "R7",
      riskTypes: ["payment_request"],
      signals: [ai("payment_request", "chuyển gấp cho anh 15 triệu"), ai("urgency")],
      indicators: [indicator("phone", "0900000000"), indicator("bank_account", "0000123456789")],
      explanation: "Tin giục chuyển tiền ngay và không cho gọi lại để xác minh.",
      recommendations: [
        "Không chuyển tiền theo yêu cầu trong tin. Hãy gọi lại cho người quen bằng số bạn đã lưu để xác minh.",
        CAUTION,
      ],
    },
  },
  {
    name: "Chưa phát hiện, tin OTP thật",
    result: {
      ...BASE,
      redactions: { otp: 1, password: 0, card: 0 },
      indicators: [
        url("https://vi-xyz.example/"),
        domain("vi-xyz.example", [check("official_domain", "pass", "brand:vi-xyz")]),
      ],
      explanation: "Tin chỉ báo mã và nhắc không chia sẻ mã cho người khác.",
    },
  },
  {
    name: "Chưa kết luận: thiếu bằng chứng",
    result: {
      ...BASE,
      verdict: "inconclusive",
      inconclusiveReason: "insufficient_evidence",
      rule: "R8",
      recommendations: [CAUTION, "Xác minh qua kênh chính thức của tổ chức trước khi làm theo."],
    },
  },
  { name: "Chưa kết luận: quá thời gian", result: unresolved("timeout") },
  { name: "Chưa kết luận: AI trả lời sai dạng", result: unresolved("llm_invalid_output") },
  { name: "Chưa kết luận: AI không dùng được", result: unresolved("llm_unavailable") },
  {
    name: "Nguy cơ cao khi AI không chạy được",
    result: {
      ...BASE,
      verdict: "high_risk",
      inconclusiveReason: "llm_unavailable",
      rule: "R1",
      riskTypes: ["other"],
      signals: [rule("blocklisted_url", "nhan-qua-xyz.example")],
      indicators: [domain("nhan-qua-xyz.example", [check("blocklist", "warn")])],
      recommendations: [NO_CLICK, "Gửi báo cáo để đội vận hành xem xét."],
    },
  },
  {
    name: "Phép kiểm không tra được, mã lạ, che đủ ba loại",
    result: {
      ...BASE,
      verdict: "suspicious",
      rule: "R6",
      riskTypes: ["brand_impersonation"],
      signals: [
        rule("brand_in_subdomain", "xn--v-xyz-r51b.example"),
        rule("lookalike_domain", "xn--v-xyz-r51b.example"),
      ],
      recommendations: [CAUTION, "Xác minh qua kênh chính thức của tổ chức trước khi làm theo."],
      redactions: { otp: 1, password: 2, card: 1 },
      indicators: [
        domain(
          "xn--v-xyz-r51b.example",
          [check("domain_age", "unavailable"), check("subdomain_brand", "warn", "contains:Ví XYZ")],
          check("lookalike", "warn", "unknown:format"),
          check("punycode", "warn", "decoded:v-xyzẹ.example"),
        ),
      ],
    },
  },
  {
    name: "Tên miền rất dài",
    result: {
      ...BASE,
      verdict: "suspicious",
      rule: "R6",
      riskTypes: ["other"],
      signals: [ai("credential_request", "đăng nhập để xác minh")],
      indicators: [url(`http://${LONG_HOST}/dangnhapxacminh`), domain(LONG_HOST)],
      recommendations: [NO_CLICK, CAUTION],
    },
  },
];
