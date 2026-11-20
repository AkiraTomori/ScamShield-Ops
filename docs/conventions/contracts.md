# Quy ước hợp đồng dữ liệu

**Trạng thái (20/11/2026):** BẢN NHÁP. Quy ước cách viết schema. Danh sách schema cụ thể sẽ ở [architecture/contracts.md](../architecture/contracts.md) và [api.md](../architecture/api.md).

## 1. Một nguồn sự thật

- Mọi hình dạng dữ liệu đi qua ranh giới đều là **zod schema trong `packages/shared`**: request, response, đầu ra LLM, biến môi trường, file dữ liệu thương hiệu (Q-10).
- Kiểu TypeScript lấy bằng `z.infer<typeof X>`. **Không** viết tay `interface` song song với schema.
- `api.md` chỉ mô tả và cho ví dụ; lệch với schema thì schema thắng và `api.md` phải sửa trong cùng PR.

## 2. Parse ở mọi ranh giới

Dữ liệu từ ngoài vào **luôn** được `parse` hoặc `safeParse` trước khi dùng:

| Ranh giới | Ai parse |
|---|---|
| Body, query, params của request | Route handler, trước khi gọi `packages/core` |
| Đầu ra LLM | Module `llm` trong `packages/core`; sai schema thì thử lại 1 lần, vẫn sai thì `inconclusive` (SO-03-AC01) |
| Phản hồi tra cứu ngoài (RDAP, Safe Browsing) | Module gọi ra ngoài; sai hình dạng thì phép kiểm là `unavailable` |
| Biến môi trường | `packages/shared/src/env.ts`, đọc một lần |
| File dữ liệu thương hiệu | Lúc nạp, lỗi thì báo lỗi ngay (không chạy với danh sách hỏng) |
| Form phía client | Dùng **cùng schema** với server để báo lỗi sớm; server vẫn parse lại |

Response do server tạo cũng đi qua schema (`Schema.parse(result)`) trong test, để bắt lệch hợp đồng.

## 3. Đặt tên và định dạng

- Schema: `PascalCase` + hậu tố vai trò: `CreateAnalysisRequest`, `AnalysisResult`, `HealthResponse`, `LlmSignalOutput`.
- Trường JSON: `camelCase` (`analysisId`, `createdAt`). Cột DB `snake_case`; Drizzle ánh xạ, không để tên cột lộ ra API.
- Giá trị enum: `snake_case` tiếng Anh đúng spec (`high_risk`, `pending_review`). Nhãn tiếng Việt chỉ ở tầng hiển thị.
- Thời điểm: chuỗi ISO 8601 UTC (`2026-11-20T07:05:00Z`). Hiển thị theo giờ Việt Nam ở UI.
- ID nội bộ: UUID. Mã hồ sơ hiển thị: `SC-` + 4 chữ số trở lên (`SC-0007`), là trường riêng, không thay cho ID.
- Schema đối tượng mặc định `.strict()` cho request (từ chối trường lạ).

## 4. Lỗi

Mọi lỗi API cùng một dạng:

```json
{ "error": { "code": "rate_limited", "message": "Bạn đang gửi quá nhanh, thử lại sau ít phút" } }
```

- `code` là `z.enum` trong `packages/shared` (`validation_failed`, `rate_limited`, `unauthorized`, `not_found`, `conflict`, `internal`, …). Câu tiếng Việt cho từng mã nằm cùng file, là nguồn duy nhất cho thông báo lỗi.
- Câu nào spec ghi nguyên văn thì dùng nguyên văn và có test so chuỗi.
- `message` không chứa stack trace, câu SQL, tên bảng, host, chuỗi kết nối hay nội dung người dùng gửi.
- Lỗi validate có thể kèm `fields` (tên trường → mã lỗi), không kèm giá trị người dùng nhập.
- Tra cứu sai mã hồ sơ hoặc sai mã bí mật trả **cùng một** mã và câu (`not_found`), không phân biệt (ui-pages §3).

## 5. Phiên bản và thay đổi

- Kết quả analysis lưu kèm `promptVersion` và `rulesVersion` (spec §10). Đổi prompt hoặc quy tắc thì tăng phiên bản.
- Đổi schema theo kiểu phá vỡ (bỏ trường, đổi nghĩa, đổi enum) phải sửa cùng PR: schema, mọi chỗ dùng, `api.md`, và test. Không có phiên bản API song song trong v1.
- Đổi đầu ra LLM schema thì chạy lại eval tập dev.
