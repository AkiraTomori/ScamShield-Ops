import { describe, expect, it } from "vitest";
import { SignalType, type AnalysisResult, type Check } from "@scamshield/shared";
import { FIXTURES } from "../../src/features/analysis/fixtures";
import { toViewModel } from "../../src/features/analysis/view-model";

const BRANDS = [{ id: "vi-xyz", name: "Ví XYZ" }];
const base = FIXTURES[0]!.result;

const view = (over: Partial<AnalysisResult>) => toViewModel({ ...base, ...over }, BRANDS);

const detailOf = (type: Check["type"], status: Check["status"], detail: string | null) =>
  view({
    indicators: [
      {
        type: "domain",
        value: "a.example",
        normalized: "a.example",
        checks: [{ type, status, detail }],
      },
    ],
  }).indicators[0]!.checks[0]!.detail;

// scamshield-ui §3.3.
describe("notes under the verdict", () => {
  it.each([
    ["timeout", "Hệ thống phân tích quá lâu. Hãy thử lại sau ít phút."],
    ["llm_invalid_output", "Bước phân tích bằng AI đang gặp sự cố. Hãy thử lại sau ít phút."],
    ["llm_unavailable", "Bước phân tích bằng AI đang gặp sự cố. Hãy thử lại sau ít phút."],
  ] as const)("SO-03-AC06: inconclusive by %s explains why and offers a retry", (reason, note) => {
    expect(view({ verdict: "inconclusive", inconclusiveReason: reason })).toMatchObject({
      note,
      canRetry: true,
    });
  });

  it("SO-03-AC03: not enough evidence explains why, with no retry", () => {
    expect(
      view({ verdict: "inconclusive", inconclusiveReason: "insufficient_evidence" }),
    ).toMatchObject({
      note: "Nội dung chưa đủ để đánh giá. Hãy thận trọng và xác minh qua kênh chính thức.",
      canRetry: false,
    });
  });

  it.each(["timeout", "llm_invalid_output", "llm_unavailable"] as const)(
    "says the AI step did not run when hard evidence wins despite %s (P-01), with no retry",
    (reason) => {
      expect(view({ verdict: "high_risk", inconclusiveReason: reason })).toMatchObject({
        note: "Bước phân tích bằng AI chưa chạy được; kết quả dựa trên kiểm tra của hệ thống.",
        canRetry: false,
      });
    },
  );

  it.each(["high_risk", "suspicious", "no_signal"] as const)(
    "adds nothing to a plain %s",
    (verdict) => {
      expect(view({ verdict, inconclusiveReason: null })).toMatchObject({
        note: null,
        canRetry: false,
      });
    },
  );
});

describe("signals", () => {
  // design-system §3 (from scamshield-ui §5.1), word for word.
  const LABELS: Record<SignalType, string> = {
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
  };

  it.each(SignalType.options)("SO-03-AC04: labels %s", (type) => {
    const signals = [{ type, source: "ai" as const, evidence: null, indicator: null }];
    expect(view({ signals }).signals[0]!.label).toBe(LABELS[type]);
  });

  it("SO-03-AC04: keeps the server's order and source, and quotes only what the AI quoted", () => {
    expect(
      view({
        signals: [
          { type: "urgency", source: "ai", evidence: "trong hôm nay", indicator: null },
          {
            type: "lookalike_domain",
            source: "deterministic",
            evidence: "a.example",
            indicator: "a.example",
          },
        ],
      }).signals,
    ).toEqual([
      { label: LABELS.urgency, source: "ai", evidence: "trong hôm nay" },
      // The domain is already on its own card.
      { label: LABELS.lookalike_domain, source: "deterministic", evidence: null },
    ]);
  });
});

describe("indicators", () => {
  it("shows no card for a brand name, and names each check", () => {
    const { indicators } = view({});
    expect(indicators.map((i) => i.value)).toEqual([
      "http://vi-xac-minh.example/",
      "vi-xac-minh.example",
    ]);
    expect(indicators[0]!.checks).toEqual([
      { name: "Đường dẫn dùng địa chỉ IP", status: "pass", detail: null },
    ]);
  });

  // design-system §3 (from scamshield-ui §5.3): the sentence depends on check, status and code together.
  it.each([
    ["official_domain", "warn", "brand:vi-xyz", "Không thuộc tên miền chính thức của Ví XYZ"],
    ["official_domain", "pass", "brand:vi-xyz", "Thuộc tên miền chính thức của Ví XYZ"],
    [
      "lookalike",
      "warn",
      "nearest:vi-xyz.example:distance_2",
      "Gần giống vi-xyz.example, khác 2 ký tự",
    ],
    ["lookalike", "warn", "contains:vixyz", "Chứa tên thương hiệu “vixyz”"],
    ["punycode", "warn", "decoded:ví.example", "Hiển thị thành: ví.example"],
    ["domain_age", "warn", "age_days:3", "Đăng ký 3 ngày trước"],
    ["domain_age", "pass", "age_days:400", "Đăng ký 400 ngày trước"],
  ] as const)("translates %s %s %s", (type, status, code, sentence) => {
    expect(detailOf(type, status, code)).toBe(sentence);
  });

  it.each([
    ["an unknown brand", "official_domain", "warn", "brand:khong-co"],
    ["a malformed code", "lookalike", "warn", "nearest:a.example:distance_x"],
    ["an unknown code", "lookalike", "warn", "unknown:format"],
    ["a code on the wrong check", "subdomain_brand", "warn", "contains:vixyz"],
    ["a code on the wrong status", "lookalike", "pass", "contains:vixyz"],
    [
      "a zero distance, where the name matches but not the ending",
      "lookalike",
      "warn",
      "nearest:a.example:distance_0",
    ],
    ["no code", "shortener", "warn", null],
  ] as const)("shows no detail for %s, never the raw code", (_, type, status, code) => {
    expect(detailOf(type, status, code)).toBeNull();
  });
});

describe("the rest of the block", () => {
  it("SO-01-AC03: names only what was redacted", () => {
    expect(view({ redactions: { otp: 0, password: 0, card: 0 } }).redactionNotice).toBeNull();
    expect(view({ redactions: { otp: 2, password: 0, card: 0 } }).redactionNotice).toBe(
      "Đã che mã OTP trong nội dung trước khi phân tích.",
    );
    expect(view({ redactions: { otp: 1, password: 1, card: 1 } }).redactionNotice).toBe(
      "Đã che mã OTP / mật khẩu / số thẻ trong nội dung trước khi phân tích.",
    );
  });

  it("SO-03-AC04: passes on the explanation, if any, and the advice", () => {
    expect(view({ explanation: null }).explanation).toBeNull();
    expect(view({}).explanation).toBe(base.explanation);
    expect(view({}).recommendations).toEqual(base.recommendations);
  });

  it("SO-03-AC04: carries no score, risk type, rule or version", () => {
    expect(Object.keys(view({})).sort()).toEqual([
      "canRetry",
      "explanation",
      "indicators",
      "note",
      "recommendations",
      "redactionNotice",
      "signals",
      "verdict",
    ]);
  });
});
