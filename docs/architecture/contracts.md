# ScamShield Ops — Hợp đồng dữ liệu

**Trạng thái (28/11/2026):** BẢN NHÁP; sửa theo quyết định S4–S11 owner chốt 26/11 (U-03, ST-02); `SignalType`, `SignalSource` và schema đầu ra LLM đã có trong `packages/shared` (slice S2); slice S3 (PR #46, đã merge 26/11) thêm `CheckType`, `CheckStatus`, `AnalysisResult`, `CreateAnalysisRequest`, `BrandList`, `UrlLists`; slice S5 (PR #50, đã merge 27/11) thêm `PublicCaseStatus`, `LlmCaseSummaryOutput`, `ReportRequest`, `ReportResponse`, `CaseStatusRequest`, `CaseStatusResponse` (`report.ts`); T-060 (28/11, nhánh `feat/s6-auth`) thêm `LoginRequest` (`ops.ts`); T-061 thêm `CaseStatusFilter`, `CaseListQuery`, `CaseListItem`, `CaseListPage` (cùng file); T-062 thêm `CaseDetail`, `DecisionRecord`, `RelatedCases` (`case.ts`). Mô tả các khái niệm dữ liệu đi qua ranh giới (API, LLM, file dữ liệu) ở mức đủ để viết zod schema. Mục ghi *(đề xuất, chờ owner)* chưa được duyệt.

**Thứ bậc:** khi `packages/shared` đã có schema, **schema thắng** file này; lệch thì sửa file này trong cùng PR ([conventions/contracts.md](../conventions/contracts.md)). Endpoint dùng các hình dạng này ở [api.md](./api.md). Quy tắc tính verdict **không** nằm ở đây; nó thuộc thiết kế slice pipeline (system-design §10).

## 1. Enum

| Schema | Giá trị | Nguồn |
|---|---|---|
| `Verdict` | `high_risk`, `suspicious`, `no_signal`, `inconclusive` | Spec §3 |
| `InconclusiveReason` | `insufficient_evidence`, `timeout`, `llm_invalid_output`, `llm_unavailable` | SO-03-AC01, AC03, AC06 |
| `SignalSource` | `deterministic`, `ai` | P2 |
| `SignalType` | xem §3 | SO-03-AC01, SO-02-AC02, SO-08-AC02 |
| `IndicatorType` | `url`, `domain`, `phone`, `bank_account`, `brand` | Spec §3 |
| `CheckType` | xem §4 | SO-02-AC02, AC03 |
| `CheckStatus` | `warn`, `pass`, `unavailable` | SO-02-AC03 |
| `RiskType` | `brand_impersonation`, `otp_phishing`, `payment_request`, `fake_prize`, `other` | SO-05-AC01 |
| `ReportChannel` | `sms`, `zalo`, `messenger`, `email`, `other` | SO-04-AC02 |
| `CaseStatus` | `pending_review`, `closed` | SO-04-AC01, SO-06-AC03 |
| `Decision` | `confirmed_scam`, `not_scam`, `insufficient_evidence` | Spec §3 |
| `PublicCaseStatus` | `pending_review`, `confirmed_scam`, `not_scam`, `insufficient_evidence` | SO-04-AC04: trạng thái + kết luận gộp lại cho phía người dùng |
| `ErrorCode` | xem §8 | conventions/contracts §4 |

`pass` chỉ nghĩa là **một phép kiểm** không thấy vấn đề, không bao giờ là verdict. `unavailable` không được quy tắc verdict coi như `pass`.

`brand` là thương hiệu được nhắc tới trong tin (spec §3 coi tên ví/ngân hàng là chỉ dấu). Nó dùng để chọn danh sách tên miền chính thức khi kiểm URL, **không** dùng để liên kết hồ sơ (SO-07-AC01 chỉ so tên miền, SĐT, số tài khoản).

## 2. Chỉ dấu (`Indicator`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `type` | `IndicatorType` | |
| `value` | string | Dạng hiển thị, đúng như trong nội dung đã che |
| `normalized` | string | Dạng chuẩn hoá để so khớp (SO-07-AC02): tên miền chữ thường, bỏ `www.`, chuyển punycode về dạng `xn--`; SĐT về `+84…`; số tài khoản bỏ khoảng trắng và dấu chấm; thương hiệu là `brandId` trong file dữ liệu |
| `checks` | `Check[]` | Rỗng với `phone`, `bank_account` trừ phép `verified_indicator` |

Mỗi URL sinh thêm một chỉ dấu `domain` (tên miền đăng ký). Trích bằng code tất định (SO-02-AC01): cùng nội dung → cùng danh sách, cùng thứ tự (theo vị trí xuất hiện).

## 3. Tín hiệu (`Signal`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `type` | `SignalType` | |
| `source` | `SignalSource` | |
| `evidence` | string \| null | Trích đoạn ≤ 200 ký tự **từ nội dung đã che**, hoặc giá trị chỉ dấu liên quan |
| `indicator` | string \| null | `normalized` của chỉ dấu sinh ra tín hiệu (với tín hiệu tất định) |

**`SignalType`** *(đề xuất, sẽ chốt cùng quy tắc verdict ở slice pipeline)*:

| Giá trị | Nguồn | Nghĩa |
|---|---|---|
| `claims_organization` | ai | Tin tự xưng là của một tổ chức. Signal yếu, trung tính; "mạo danh" chỉ kết luận qua loại rủi ro khi có bằng chứng tên miền (P-07) |
| `urgency` | ai | Tạo áp lực thời gian |
| `threat` | ai | Đe doạ khoá tài khoản, phạt, pháp lý |
| `credential_request` | ai | Đòi OTP, mật khẩu, số thẻ, thông tin đăng nhập |
| `payment_request` | ai | Đòi chuyển tiền, nạp tiền, đóng phí |
| `reward_promise` | ai | Hứa trúng thưởng, hoàn tiền, lợi nhuận |
| `ai_directed_instruction` | ai **hoặc** deterministic | Câu lệnh nhắm vào hệ thống AI (SO-01-AC05). Code tất định bắt mẫu rõ ràng; LLM bắt phần còn lại |
| `brand_domain_mismatch` | deterministic | Nhắc thương hiệu nhưng tên miền không thuộc danh sách chính thức |
| `lookalike_domain` | deterministic | Tên miền giống tên miền chính thức (edit distance, ký tự đồng dạng, punycode) |
| `brand_in_subdomain` | deterministic | Tên thương hiệu nằm ở subdomain của tên miền khác |
| `shortened_url`, `ip_url`, `risky_tld` | deterministic | Theo tên |
| `new_domain` | deterministic | Tên miền đăng ký gần đây (RDAP) |
| `blocklisted_url` | deterministic | Có trong danh sách đen (Safe Browsing) |
| `verified_indicator` | deterministic | Chỉ dấu đã được đội vận hành xác minh (SO-08-AC02); câu hiển thị nguyên văn spec |

## 4. Phép kiểm (`Check`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `type` | `CheckType` | `official_domain`, `lookalike`, `punycode`, `subdomain_brand`, `shortener`, `ip_host`, `risky_tld`, `domain_age`, `blocklist`, `verified_indicator` |
| `status` | `CheckStatus` | |
| `detail` | string \| null | Mã ngắn để UI dịch ra câu tiếng Việt (ví dụ `nearest:<tên miền chính thức>:distance_1`, `age_days:3`; U-03, owner chốt 26/11). Không chứa văn bản tự do từ bên thứ ba |

Phép `domain_age` và `blocklist` là tra cứu ngoài (Q-03): lỗi, quá thời gian hoặc phản hồi sai hình dạng → `unavailable`.

## 5. Kết quả phân tích (`AnalysisResult`)

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `analysisId` | UUID | |
| `verdict` | `Verdict` | Do quy tắc trong code (P4) |
| `inconclusiveReason` | `InconclusiveReason` \| null | Khác null khi AI không chạy/lỗi (kể cả verdict `high_risk` do bằng chứng cứng, P-01); luôn có khi `verdict = inconclusive` (DB ép bằng CHECK, data-model DB-06) |
| `riskTypes` | `RiskType[]` | Suy từ signal bằng code |
| `signals` | `Signal[]` | |
| `indicators` | `Indicator[]` | |
| `redactions` | `{ otp: number, password: number, card: number }` | Số chỗ đã che (SO-01-AC03); UI hiện thông báo khi tổng > 0 |
| `explanation` | string \| null | Do LLM viết, ≤ 800 ký tự, chỉ dựa trên signal và check (SO-03-AC05). `null` khi LLM lỗi |
| `recommendations` | string[] (2–4) | Câu mẫu do **code** chọn theo verdict và signal (A-01) |
| `rule` | `RuleCode` (`R0`…`R9`) | Mã quy tắc verdict đã kích hoạt (design/analysis-pipeline §7) |
| `promptVersion`, `rulesVersion` | string | Spec §10. `promptVersion` ghép hai prompt: `signals-v1+explain-v3` |
| `createdAt` | ISO 8601 UTC | |

**Không có** trường điểm số hay xác suất (SO-03-AC04). Nội dung tin nhắn đã che **không** trả lại trong response (người dùng đã có nội dung gốc).

## 6. Hồ sơ (`CaseDetail`, dùng ở FraudOps)

| Trường | Ghi chú |
|---|---|
| `caseId` (UUID), `caseCode` (`SC-0007`) | |
| `status`, `createdAt`, `isSeed` | |
| `source` | Luôn `user_report` trong v1 |
| `channel`, `reporterNote` | Từ báo cáo (SO-04-AC02) |
| `redactedContent` | Nội dung đã che (SO-05-AC01) |
| `analysis` | `AnalysisResult` của case (verdict engine, signal, chỉ dấu, check) |
| `aiSummary` | `{ summary: string, nextSteps: string[] }` \| null. `null` khi LLM lỗi lúc tạo case (A-02) |
| `decision` | `{ decision, reason, decidedBy, decidedAt, disagreesWithEngine }` \| null |
| `relatedCases` | `{ total: number, items: { caseCode, status, decision, isSeed, createdAt, sharedIndicators: { type, normalized }[] }[] }`; `items` tối đa 20 (SO-07; ST-02, owner chốt 26/11, [design/related-cases §3](../design/related-cases.md#3-truy-vấn)) |

`disagreesWithEngine` tính theo bảng đồng ý ở SO-06-AC04, lưu lúc kết luận để eval đọc lại.

**Danh sách hồ sơ** (T-061, [design/fraudops §4](../design/fraudops.md#4-danh-sách-hồ-sơ-ops-t-061)): `CaseListItem` = `{ caseCode, createdAt, engineVerdict, riskTypes, status, isSeed, decision | null }`; `CaseListPage` = `{ items, page, totalPages, hasAnyCase }`. Không có API: server component đọc thẳng `packages/core`.

## 7. Đầu ra LLM

Mỗi lời gọi có schema riêng, dạng JSON, parse bằng zod; sai thì thử lại 1 lần (SO-03-AC01). Model không bao giờ trả verdict.

| Schema | Đầu vào cho LLM | Đầu ra |
|---|---|---|
| `LlmSignalOutput` | Nội dung **đã che**, trong khối phân tách | `{ signals: { type: SignalType (chỉ các giá trị nguồn ai), evidence: string }[], mentionedBrands: string[] }` |
| `LlmExplanationOutput` | **Chỉ** verdict + signal + check (không có nội dung gốc) | `{ explanation: string }` |
| `LlmCaseSummaryOutput` | Nội dung đã che + signal + check + ghi chú người báo cáo, trong khối phân tách | `{ summary: string, nextSteps: string[] }` (3–5 câu; 1–3 bước, chỉ là văn bản) |

`evidence` phải là chuỗi con của nội dung đã che; code kiểm lại và bỏ signal nào có `evidence` không khớp (chống bịa).

Trong `packages/shared/src/llm.ts`: `LlmSignalRawOutput` (dạng dây: `type` là chuỗi tuỳ ý, `mentionedBrands` mặc định rỗng) là thứ model phải trả; code bỏ loại không thuộc `AiSignalType` mà **không** coi là sai schema. `LlmSignalOutput` (đúng bảng trên) là dạng sau khi code đã lọc. `LlmExplanationOutput` = `{ explanation }`. Bộ lọc giải thích (≤ 800 ký tự, cấm `an toàn`, `%`, `chắc chắn`, số lạ) nằm ở `packages/core/src/llm/write-explanation.ts`, phần dùng chung ở `output-filters.ts`.

`LlmCaseSummaryOutput` cũng là dạng lưu ở `cases.ai_summary`: `summary` ≤ 1.000 ký tự, mỗi bước ≤ 200 ký tự, kiểm bằng bộ lọc sau khi nhận (report-flow §3.2) cùng các luật của giải thích và hai luật P1 (RP-04).

## 8. Lỗi

Dạng chung ở [conventions/contracts.md §4](../conventions/contracts.md#4-lỗi). Mã:

| `ErrorCode` | HTTP | Câu tiếng Việt |
|---|---|---|
| `validation_failed` | 400 | Theo trường; nội dung rỗng/quá 2.000 ký tự có câu riêng (SO-01-AC02): "Hãy dán nội dung tin nhắn cần kiểm tra." / "Nội dung quá dài. Tối đa 2.000 ký tự." (`packages/shared/src/input.ts`), kèm `fields.content` = `empty` \| `too_long` |
| `rate_limited` | 429 | "Bạn đang gửi quá nhanh, thử lại sau ít phút" (nguyên văn SO-01-AC04) |
| `unauthorized` | 401 | "Bạn cần đăng nhập để tiếp tục." |
| `invalid_credentials` | 401 | "Sai tên đăng nhập hoặc mật khẩu." |
| `forbidden_origin` | 403 | "Yêu cầu không hợp lệ." |
| `not_found` | 404 | Theo ngữ cảnh; tra cứu dùng "Không tìm thấy báo cáo khớp với hai mã này." |
| `conflict` | 409 | "Hồ sơ đã được kết luận trước đó." |
| `internal` | 500 | "Đã có lỗi xảy ra. Hãy thử lại." |

Một analysis quá thời gian **không** là lỗi: trả 200 với `verdict = inconclusive`, `inconclusiveReason = timeout` (SO-03-AC06).

## 9. File dữ liệu thương hiệu (Q-10)

`packages/shared/data/brands.json`, parse bằng schema `BrandList`:

```json
[{ "id": "vi-xyz", "name": "Ví XYZ", "kind": "wallet", "aliases": ["Ví XYZ", "XYZ Pay"], "domains": ["vixyz.example"] }]
```

Schema `BrandList` ở `packages/shared/src/brands.ts`; mỗi thương hiệu có `id` duy nhất. `kind`: `wallet` | `bank`. `domains` là tên miền đăng ký, chữ thường. Ví dụ trên là dữ liệu giả; nội dung thật (18 thương hiệu owner duyệt 24/11) chỉ ở file dữ liệu.

`packages/shared/data/url-lists.json` (schema `UrlLists`): `{ sources: { <id>: { title, url, retrieved } }, shorteners: { value, source }[], riskyTlds: { value, source }[] }`; mỗi mục phải trỏ tới một nguồn đã khai (P-04).

## 10. Quyết định

| ID | Câu hỏi | Quyết định | Trạng thái |
|---|---|---|---|
| A-01 | Khuyến nghị 2–4 dòng (SO-03-AC04) do ai viết? | **Code**: bộ câu mẫu tiếng Việt cố định, chọn theo verdict và signal, nằm ở module `verdict`. LLM chỉ viết phần giải thích | Đã chốt 20/11 |
| A-02 | Tóm tắt AI của hồ sơ (SO-05-AC02) lỗi thì sao? | Tạo đồng bộ lúc gửi báo cáo, có timeout riêng. Lỗi thì **vẫn tạo case**, `aiSummary = null`; FraudOps hiện "Chưa có tóm tắt AI", nhân viên vẫn kết luận từ bằng chứng | Đã chốt 20/11 |
| A-03 | `SignalType` cụ thể (§3) | Theo [design/analysis-pipeline §6.9](../design/analysis-pipeline.md); `brand_impersonation` (signal) đổi thành `claims_organization` (P-07). Loại rủi ro `brand_impersonation` giữ nguyên | Đổi tên đã chốt 20/11; nhóm mạnh/vừa/yếu chờ duyệt slice |
