# ScamShield Ops — API

**Trạng thái (28/11/2026):** BẢN NHÁP; sửa theo quyết định S5, S6 owner chốt 26/11 (RP-05, OP-01, OP-03). `POST /api/analyses` đã có trên `main` (PR #46), chưa deploy; `/report` và `/api/case-status` đã merge (PR #50, 27/11); `POST`/`DELETE /api/ops/session` có trên nhánh `feat/s6-auth` (28/11), chưa merge (danh sách và chi tiết hồ sơ không có endpoint, §1). Danh sách endpoint, quyền, ví dụ và mã lỗi. Hình dạng dữ liệu ở [contracts.md](./contracts.md); khi đã có zod schema trong `packages/shared` thì schema thắng.

## 1. Nguyên tắc chung

- Mọi endpoint nằm dưới `/api`, là route handler của `apps/web` chạy Node.js runtime (system-design §2). JSON vào, JSON ra, UTF-8.
- Response động có `Cache-Control: no-store`.
- Lỗi theo dạng `{ "error": { "code", "message" } }` (contracts §8).
- **Chỉ có API cho thao tác ghi và cho phía công khai.** Trang FraudOps đọc danh sách và chi tiết hồ sơ bằng server component gọi thẳng `packages/core` sau khi kiểm phiên ([conventions/frontend.md §2](../conventions/frontend.md#2-server-và-client-component)). Không có endpoint `GET` danh sách hồ sơ trong v1.
- **Không có** endpoint nào khoá tài khoản, chặn giao dịch hay liên hệ bên thứ ba (P1, SO-06-AC06).
- Không có endpoint nào nhận một URL để "kiểm tra bằng cách mở" (P5).

## 2. Bảng endpoint

| Phương thức | Đường dẫn | Quyền | Giới hạn tần suất | AC |
|---|---|---|---|---|
| `GET` | `/api/health` | Công khai | — | system-design §5 |
| `POST` | `/api/analyses` | Công khai | 10 lượt/phút/IP | SO-01…SO-03 |
| `POST` | `/api/analyses/{analysisId}/report` | Công khai (biết `analysisId`) | 10 lượt/phút/IP | SO-04-AC01…AC03 |
| `POST` | `/api/case-status` | Công khai (mã hồ sơ + mã bí mật) | 10 lượt/phút/IP | SO-04-AC04 |
| `POST` | `/api/ops/session` | Công khai | 5 lượt/phút/IP (OP-01, owner chốt 26/11) | SO-06-AC01, SO-10-AC02 |
| `DELETE` | `/api/ops/session` | Nhân viên | — | — |
| `POST` | `/api/ops/cases/{caseCode}/decision` | Nhân viên | — | SO-06-AC03, AC04, SO-08-AC01 |
| `POST` | `/api/ops/confirmed-indicators/{id}/removal` | Nhân viên | — | SO-08-AC03 |

Các thao tác của owner (migrate, seed, reset demo, tạo tài khoản thử) là **lệnh dòng lệnh**, không phải endpoint ([codebase.md §3](./codebase.md#3-lệnh)).

## 3. Phía công khai

### `POST /api/analyses`

```http
POST /api/analyses
Content-Type: application/json

{ "content": "[Ví XYZ] Tài khoản của bạn sẽ bị khoá trong 2 giờ. Xác minh tại vi-xac-minh.example và nhập mã OTP 482913." }
```

**200** — `AnalysisResult` (contracts §5), rút gọn:

```json
{
  "analysisId": "6f1c…",
  "verdict": "high_risk",
  "inconclusiveReason": null,
  "riskTypes": ["brand_impersonation", "otp_phishing"],
  "signals": [
    { "type": "brand_domain_mismatch", "source": "deterministic", "evidence": "vi-xac-minh.example", "indicator": "vi-xac-minh.example" },
    { "type": "urgency", "source": "ai", "evidence": "sẽ bị khoá trong 2 giờ", "indicator": null },
    { "type": "credential_request", "source": "ai", "evidence": "nhập mã OTP", "indicator": null }
  ],
  "indicators": [
    { "type": "domain", "value": "vi-xac-minh.example", "normalized": "vi-xac-minh.example",
      "checks": [{ "type": "official_domain", "status": "warn", "detail": "brand:vi-xyz" },
                 { "type": "domain_age", "status": "unavailable", "detail": null }] }
  ],
  "redactions": { "otp": 1, "password": 0, "card": 0 },
  "explanation": "…",
  "recommendations": ["…", "…", "…"],
  "rule": "R3",
  "promptVersion": "signals-v1+explain-v3", "rulesVersion": "rules-v1",
  "createdAt": "2026-11-22T03:10:00Z"
}
```

**Thứ tự xử lý** (chi tiết thuộc thiết kế slice pipeline):
1. Kiểm giới hạn tần suất → 429, **không** gọi LLM (SO-01-AC04).
2. Parse body; rỗng, chỉ khoảng trắng hay > 2.000 ký tự → 400, **không** gọi LLM (SO-01-AC02).
3. Che dữ liệu nạn nhân (SO-01-AC03); từ đây chỉ dùng bản đã che.
4. Trích chỉ dấu, chạy phép kiểm tất định và tra cứu ngoài (song song, có timeout); gọi LLM trích signal.
5. Quy tắc tính verdict (P4) → LLM viết giải thích → chọn khuyến nghị.
6. Lưu analysis, trả 200.

Hết trần 20 giây ở bất kỳ bước nào sau bước 3 → vẫn **200** với `verdict: "inconclusive"`, `inconclusiveReason: "timeout"` (SO-03-AC06).

| Lỗi | Khi nào |
|---|---|
| 400 `validation_failed` | Bước 2, kể cả body không phải JSON, có trường lạ hoặc lớn hơn 64 KB |
| 429 `rate_limited` | Bước 1 |
| 500 `internal` | Lỗi không dự đoán được (ví dụ không ghi được DB), bộ đếm tần suất lỗi hoặc quá 1 s, thiếu biến môi trường của pipeline |

### `POST /api/analyses/{analysisId}/report`

```json
{ "channel": "sms", "note": "Nhận lúc 9h sáng" }
```

| Kết quả | Body |
|---|---|
| **201** tạo mới | `{ "caseCode": "SC-0007", "secretCode": "K7QX-2M9P", "alreadyReported": false }` |
| **200** đã gửi trước đó (SO-04-AC03) | `{ "caseCode": "SC-0007", "secretCode": null, "alreadyReported": true }`. Mã bí mật không hiển thị lại |
| 400 `validation_failed` | `analysisId` không phải UUID, body sai dạng, thiếu hoặc sai kênh, ghi chú quá 500 ký tự (`fields.channel`, `fields.note`) |
| 404 `not_found` | `analysisId` không tồn tại |
| 429 `rate_limited` | |
| 500 `internal` | Lỗi không dự đoán được, thiếu biến môi trường |

- `secretCode` sinh ngẫu nhiên an toàn, 8 ký tự Crockford base32 hiển thị thành hai nhóm 4 (RP-05, owner chốt 26/11), chỉ trả **một lần**, lưu dạng băm.
- Tạo report + case + tóm tắt AI trong một luồng; tóm tắt lỗi thì vẫn tạo case (contracts A-02).
- Hai request đồng thời cho cùng analysis: ràng buộc unique bảo đảm chỉ một case; request thua nhận 200 `alreadyReported: true`.

### `POST /api/case-status`

Dùng `POST` để mã bí mật không nằm trên URL, lịch sử trình duyệt hay log.

```json
{ "caseCode": "SC-0007", "secretCode": "K7QX-2M9P" }
```

| Kết quả | Body |
|---|---|
| **200** | `{ "caseCode": "SC-0007", "status": "confirmed_scam", "updatedAt": "…" }` (`PublicCaseStatus`) |
| 400 `validation_failed` | Thiếu trường, rỗng, dài hơn 32 ký tự, trường lạ |
| 404 `not_found` | Sai mã, sai mã bí mật hoặc không tồn tại: **cùng** một phản hồi |
| 429 `rate_limited` | |
| 500 `internal` | Lỗi không dự đoán được, thiếu `DATABASE_URL` hoặc `RATE_LIMIT_SALT` |

Mã hồ sơ nhận cả chữ thường và chỉ phần số (`101` là `SC-0101`); mã bí mật bỏ qua khoảng trắng, gạch ngang, chữ hoa thường.

Không trả lý do kết luận, tên nhân viên, nội dung tin.

## 4. Phía FraudOps

**Phiên:** cookie `ops_session`: `HttpOnly`, `Secure` (trừ `next dev`, OP-02), `SameSite=Lax`, đường dẫn `/`, hết hạn cố định 12 giờ. Mọi route `/api/ops/*` (trừ đăng nhập) không có phiên hợp lệ → 401 `unauthorized` (SO-06-AC01).

**Chống CSRF:** ngoài `SameSite=Lax`, mọi request thay đổi dữ liệu dưới `/api/ops/*` phải có header `Origin` trùng origin của app; thiếu hoặc sai → 403 `forbidden_origin`. Đăng nhập cũng kiểm.

### `POST /api/ops/session` — đăng nhập

```json
{ "username": "judge1", "password": "…" }
```

**204** + `Set-Cookie`. Sai → 401 `invalid_credentials` (không nói sai phần nào). Thời gian phản hồi khi sai tên đăng nhập và khi sai mật khẩu phải tương đương (vẫn chạy băm mật khẩu giả).

| Lỗi | Khi nào |
|---|---|
| 403 `forbidden_origin` | Thiếu hoặc sai `Origin` (kiểm đầu tiên) |
| 429 `rate_limited` | Quá 5 lượt/phút/IP |
| 400 `validation_failed` | Body sai dạng; `username` (bỏ khoảng trắng đầu cuối, viết thường) rỗng hoặc quá 64 ký tự; `password` rỗng hoặc quá 200 ký tự |
| 401 `invalid_credentials` | Sai tên, sai mật khẩu hoặc tài khoản bị khoá |
| 500 `internal` | Lỗi không dự đoán được, thiếu `DATABASE_URL` hoặc `RATE_LIMIT_SALT` |

### `DELETE /api/ops/session` — đăng xuất

**204**, xoá phiên phía server và cookie. Sai `Origin` → 403; không có phiên hợp lệ → 401 `unauthorized`.

### `POST /api/ops/cases/{caseCode}/decision`

```json
{ "decision": "confirmed_scam", "reason": "Tên miền giả mạo, đã có 3 báo cáo cùng tên miền." }
```

| Kết quả | Body |
|---|---|
| **200** | `CaseDetail.decision` (contracts §6), có `disagreesWithEngine` |
| 400 `validation_failed` | Thiếu lý do, lý do quá ngắn/dài, kết luận không hợp lệ |
| 404 `not_found` | Không có hồ sơ |
| 409 `conflict` | Hồ sơ đã đóng (người khác kết luận trước). Body là dạng lỗi chung, **không** kèm kết luận; UI tải lại trang để hiện kết luận hiện có (OP-03, owner chốt 26/11) |

Trong **một transaction**: cập nhật case có điều kiện `status = pending_review`, ghi decision, và nếu `confirmed_scam` thì thêm các chỉ dấu `domain`/`phone`/`bank_account` vào danh sách đã xác minh (SO-08-AC01). `not_scam` và `insufficient_evidence` không thêm gì (SO-08-AC03).

### `POST /api/ops/confirmed-indicators/{id}/removal`

```json
{ "reason": "Tên miền đã được chủ sở hữu thật thu hồi." }
```

**200** `{ "removed": true }`. Gỡ là xoá mềm (giữ lịch sử, người gỡ, lý do, thời điểm). Đã gỡ trước đó → 409 `conflict`. Không tồn tại → 404.

## 5. Giới hạn tần suất

- Khoá đếm là **băm của IP** (có muối từ biến môi trường), không lưu IP thô (spec §9). Bộ đếm cửa sổ 1 phút lưu trong Postgres, dọn bản ghi cũ định kỳ (thiết kế chi tiết ở slice pipeline).
- `/api/analyses`, `/report`, `/case-status` dùng **chung** một hạn mức 10 lượt/phút/IP (Q-06).
- Đăng nhập có hạn mức riêng.
