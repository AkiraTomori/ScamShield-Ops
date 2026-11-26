import type { Decision, DecisionInput } from "./index";

/** Fixed Vietnamese advice chosen by code, never written by the model (A-01, §8). */
export const RECOMMENDATIONS = {
  noSecrets:
    "Không cung cấp mã OTP, mật khẩu hay số thẻ cho bất kỳ ai, kể cả người xưng là nhân viên.",
  noClick: "Không bấm vào đường dẫn trong tin nhắn.",
  noTransfer:
    "Không chuyển tiền theo yêu cầu trong tin. Hãy gọi lại cho người quen bằng số bạn đã lưu để xác minh.",
  noFee: "Chương trình thật không yêu cầu bạn nộp phí để nhận thưởng.",
  contactBrand: (brand: string) =>
    `Liên hệ ${brand} qua ứng dụng chính thức hoặc số tổng đài trên website chính thức.`,
  report: "Gửi báo cáo để đội vận hành xem xét.",
  noSignalVerify: "Vẫn xác minh qua kênh chính thức trước khi chuyển tiền hoặc cung cấp thông tin.",
  noSignalStop: "Nếu có người yêu cầu OTP, mật khẩu hay chuyển tiền gấp, hãy dừng lại và kiểm tra.",
  caution: "Hãy thận trọng và chưa làm theo yêu cầu trong tin.",
  retry: "Thử kiểm tra lại sau ít phút.",
  fallback: "Xác minh qua kênh chính thức của tổ chức trước khi làm theo.",
} as const;

/** 2 to 4 lines, in priority order (SO-03-AC04). */
export function recommend(input: DecisionInput, decision: Decision): string[] {
  const { verdict, inconclusiveReason } = decision;
  const risky = verdict === "high_risk" || verdict === "suspicious";
  const has = (type: string) => input.signals.some((s) => s.type === type);
  const brandId = input.indicators.find((i) => i.type === "brand")?.normalized;
  const brand = input.brands.find((b) => b.id === brandId);
  const systemFailure =
    inconclusiveReason !== null && inconclusiveReason !== "insufficient_evidence";

  const chosen: (string | false)[] = [
    risky && has("credential_request") && RECOMMENDATIONS.noSecrets,
    risky && input.indicators.some((i) => i.type === "url") && RECOMMENDATIONS.noClick,
    risky && has("payment_request") && RECOMMENDATIONS.noTransfer,
    risky && has("reward_promise") && RECOMMENDATIONS.noFee,
    brand !== undefined && RECOMMENDATIONS.contactBrand(brand.name),
    verdict === "high_risk" && RECOMMENDATIONS.report,
    verdict === "no_signal" && RECOMMENDATIONS.noSignalVerify,
    verdict === "no_signal" && RECOMMENDATIONS.noSignalStop,
    verdict === "inconclusive" && RECOMMENDATIONS.caution,
    verdict === "inconclusive" && systemFailure && RECOMMENDATIONS.retry,
  ];

  const lines = chosen.filter((line): line is string => line !== false);
  if (lines.length < 2) lines.push(RECOMMENDATIONS.fallback);
  // A suspicious message with nothing specific to say still needs a second line.
  if (lines.length < 2) lines.push(RECOMMENDATIONS.caution);
  return lines.slice(0, 4);
}
