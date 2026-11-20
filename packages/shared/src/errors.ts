import { z } from "zod";

/** Error codes shared by every API route (architecture/contracts §8). */
export const ErrorCode = z.enum([
  "validation_failed",
  "rate_limited",
  "unauthorized",
  "invalid_credentials",
  "forbidden_origin",
  "not_found",
  "conflict",
  "internal",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  rate_limited: 429,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden_origin: 403,
  not_found: 404,
  conflict: 409,
  internal: 500,
};

/**
 * Default Vietnamese message per code. Sole source for error text (conventions/contracts §4).
 * `validation_failed` and `not_found` have per-field / per-context wording in the contract;
 * the entries here are generic fallbacks.
 */
export const ERROR_MESSAGE_VI: Record<ErrorCode, string> = {
  validation_failed: "Dữ liệu gửi lên chưa hợp lệ.",
  rate_limited: "Bạn đang gửi quá nhanh, thử lại sau ít phút",
  unauthorized: "Bạn cần đăng nhập để tiếp tục.",
  invalid_credentials: "Sai tên đăng nhập hoặc mật khẩu.",
  forbidden_origin: "Yêu cầu không hợp lệ.",
  not_found: "Không tìm thấy nội dung yêu cầu.",
  conflict: "Hồ sơ đã được kết luận trước đó.",
  internal: "Đã có lỗi xảy ra. Hãy thử lại.",
};
