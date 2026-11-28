# Thiết kế slice S8: chỉ dấu đã xác minh quay lại engine (T-080, T-081)

**Trạng thái (26/11/2026):** **OWNER ĐÃ DUYỆT SLICE S8 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. Agent được viết mã cho slice này. Chưa có mã. SO-08 là **P1, thứ 1 trong thứ tự cắt** ở plan §7: nếu phải cắt thì cắt slice này trước tiên. Owner chốt 26/11: **chưa cắt**; xem lại cùng các P1 khác ngày 27/11. T-080 phụ thuộc T-063 (kết luận, S6) và T-038 (S3). Slice này **cần một migration mới**, và owner chạy migration đó trên DB deploy.

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5). Nó chỉ bổ sung phần các file dưới còn để ngỏ:
- [spec SO-08](../spec/ScamShield-v1.md): AC01…AC03, P1, P4.
- [data-model §8](../architecture/data-model.md#8-để-sau-p1-migration-riêng) (đã duyệt): phác thảo bảng `confirmed_indicators`; giao dịch kết luận ở §4; seed và reset ở §7.
- [api.md §4](../architecture/api.md#4-phía-fraudops): `POST /api/ops/confirmed-indicators/{id}/removal`.
- [analysis-pipeline](./analysis-pipeline.md) (đã duyệt): §6.10 móc nối, §6.9 nhóm bằng chứng cứng, §7 R1 đứng trước R0 (P-01).
- [fraudops.md](./fraudops.md) (S6): `decideCase`, móc nối `recordConfirmedIndicators`, `StaffSession`.
- [related-cases.md](./related-cases.md) (S7): ST-01 loại tên miền quá phổ biến.
- [ui-pages §7](../product/ui-pages.md) và [pages.md §7](./pages.md): trang `/ops/chi-dau`.
- [demo.md](../runbook/demo.md) S2: trước khi quay, `vi-xac-minh.example` **chưa** được xác minh.

## 1. Kết quả cần có

1. Nhân viên kết luận `confirmed_scam` cho hồ sơ M1.
2. Các chỉ dấu của hồ sơ (tên miền, SĐT, số tài khoản) vào danh sách đã xác minh.
3. Người dùng sau dán tin M3, cùng tên miền. Kết quả có signal *Kiểm tra* "Chỉ dấu này đã được đội vận hành xác minh là lừa đảo" và verdict `high_risk`, kể cả khi LLM lỗi (P-01).
4. Nhân viên gỡ được một chỉ dấu (kèm lý do). Lượt phân tích sau không còn cảnh báo đó.

**Ngoài slice:**
- chia sẻ chỉ dấu giữa các tổ chức (roadmap)
- tự hết hạn chỉ dấu
- danh sách chặn hay hành động tự động (P1)

## 2. Ghi chỉ dấu khi kết luận (SO-08-AC01, AC03)

Thân của `recordConfirmedIndicators(tx, caseId, staffUserId)`, móc nối đã chừa ở S6 §5.3 (28/11: mới là chú thích trong `core/src/cases/decide.ts`, chưa có hàm; [fraudops §11](./fraudops.md#11-ghi-chú-cài-đặt-28112026)). Hàm chạy **trong cùng giao dịch** với kết luận. Lỗi ở đây thì kết luận cũng rollback, để không có case `confirmed_scam` mà thiếu chỉ dấu.

- **Chỉ chạy khi `decision = confirmed_scam`.** `not_scam` và `insufficient_evidence` không gọi hàm này (SO-08-AC03).
- **Nguồn:** các dòng `analysis_indicators` của analysis thuộc case, gồm `domain`, `phone`, `bank_account`. Không dùng `url` hay `brand`.
- **Loại trừ (XM-01):** **không bao giờ** ghi tên miền chính thức trong `brands.json`, và không ghi tên miền dịch vụ rút gọn trong `url-lists.json`. Danh sách loại trừ là cùng danh sách với S7 ST-01. Lý do:
  - Tin lừa đảo hay chèn tên miền thật để trông đáng tin.
  - Nếu tên miền thật vào danh sách, R1 sẽ đẩy **mọi tin thật** của thương hiệu đó (kể cả M2) lên `high_risk`. Đây là lỗi nặng nhất slice này có thể gây ra.
- **Đã có trong danh sách** (dòng chưa gỡ, cùng `type` và `normalized`): `INSERT … ON CONFLICT DO NOTHING` dựa trên UNIQUE một phần. Dòng cũ giữ nguyên hồ sơ nguồn và người xác nhận đầu tiên.
- **Xem trước trên form kết luận:** khi chọn "Xác nhận lừa đảo", form hiện "Sẽ thêm vào danh sách đã xác minh:" kèm danh sách chỉ dấu (đã trừ phần loại trừ). Danh sách này tính bằng **cùng hàm thuần** `selectIndicatorsToConfirm(indicators, exclusions)` mà server dùng khi ghi. Hồ sơ không có chỉ dấu nào để thêm thì hiện "Hồ sơ này không có chỉ dấu nào để thêm." Câu nhắc ở ui-pages §6.2 được thay bằng danh sách này.
- **Không** có ô chọn từng chỉ dấu. Chỉ dấu sai thì gỡ ở `/ops/chi-dau`. Như vậy form giữ đơn giản, và việc gỡ luôn có lý do.

## 3. Engine dùng danh sách (SO-08-AC02)

Theo pipeline §6.10. Phần này thuộc vai A, trong `packages/core/src/analysis`.

- **Thời điểm:** ngay sau khi trích chỉ dấu (§6.1–6.3), trước LLM và tra cứu ngoài.
- **Truy vấn:** một câu `SELECT type, normalized FROM confirmed_indicators WHERE removed_at IS NULL AND (type, normalized) IN (…)`, chỉ với các chỉ dấu của tin hiện tại. Hạn 1 giây, giống rate limit.
- **Khớp:** chỉ dấu đó có thêm check `{ type: "verified_indicator", status: "warn", detail: null }`, và tin có thêm signal `{ type: "verified_indicator", source: "deterministic", evidence: <value>, indicator: <normalized> }`. Signal này thuộc nhóm **bằng chứng cứng**, nên R1 cho ra `high_risk`.
  - `rules-v1` **không đổi**: R1 đã gồm `verified_indicator` (pipeline §6.9).
  - Mã hồ sơ nguồn **không** trả về phía người dùng.
- **Không khớp:** chỉ dấu không có check `verified_indicator`. Không thêm check `pass`, vì "không có trong danh sách" không có nghĩa là đã được kiểm là sạch.
- **Lỗi DB khi tra:** trả 500 `internal`. Bước lưu analysis cũng cần DB, nên cố tiếp tục cũng không ích gì. Ghi `unavailable` sẽ đẩy tin sang `inconclusive` một cách sai.
- **Phụ thuộc truyền vào:** `AnalysisDeps.verifiedIndicators: (keys) => Promise<VerifiedMatch[]>`.
  - **Eval runner (SO-09) truyền hàm luôn trả rỗng**, để số đo không phụ thuộc trạng thái DB demo. Có thêm một ca test riêng cho trường hợp khớp.
  - Chưa có bảng (S8 bị cắt) → deps mặc định cũng trả rỗng, đúng như pipeline §6.10 ("bỏ qua bước này").

## 4. Bảng `confirmed_indicators` (migration `0001_confirmed_indicators`)

Cụ thể hoá phác thảo ở data-model §8. Khi duyệt, chuyển nội dung này vào data-model §2.

| Cột | Kiểu | Ràng buộc / ghi chú |
|---|---|---|
| `id` | uuid | PK |
| `type` | text | NOT NULL, CHECK ∈ `MatchableIndicatorType` |
| `normalized` | text | NOT NULL |
| `source_case_id` | uuid | NOT NULL, FK → `cases.id` **ON DELETE RESTRICT** |
| `confirmed_by` | uuid | NOT NULL, FK → `staff_users.id` ON DELETE RESTRICT |
| `confirmed_at` | timestamptz | NOT NULL |
| `removed_at` | timestamptz | NULL |
| `removed_by` | uuid | NULL, FK → `staff_users.id` |
| `removal_reason` | text | NULL, CHECK `char_length BETWEEN 10 AND 500` |

- CHECK: `removed_at`, `removed_by` và `removal_reason` cùng NULL hoặc cùng khác NULL.
- UNIQUE một phần `(type, normalized) WHERE removed_at IS NULL`. Index này cũng phục vụ truy vấn ở §3.
- `ENABLE ROW LEVEL SECURITY`, không có policy (data-model §6).
- **Reset demo** (data-model §7): trong giao dịch reset, **trước** khi xoá case seed, xoá cứng các dòng có `source_case_id` thuộc case seed. Nhờ vậy FK RESTRICT không chặn reset. Dòng sinh từ case thật không bị đụng tới.
- **Owner chạy migration** trên DB deploy (AGENTS.md). Agent chỉ sinh file migration và đọc lại câu lệnh RLS.

## 5. Gỡ chỉ dấu (SO-08-AC03)

`POST /api/ops/confirmed-indicators/{id}/removal`, body `{ reason }`.

| # | Bước | Khi lỗi |
|---|---|---|
| 1 | Kiểm Origin, `requireStaffApi` (S6 §2, §3.3) | 403, 401 |
| 2 | Parse: `id` là UUID; `reason` trim, độ dài 10–500 ký tự (giống lý do kết luận, O-04) | 400 |
| 3 | `UPDATE … SET removed_at = now(), removed_by = $staff, removal_reason = $r WHERE id = $1 AND removed_at IS NULL RETURNING id` | Không có dòng: `id` tồn tại → 409 `conflict`; không tồn tại → 404 |
| 4 | 200 `{ removed: true }` | — |

- Hai nhân viên gỡ cùng lúc: chỉ một `UPDATE` khớp, người kia nhận 409.
- Sau khi gỡ, chỉ dấu có thể được ghi lại nếu có kết luận `confirmed_scam` mới. UNIQUE một phần cho phép điều này.

```ts
// packages/core/src/confirmed-indicators — vai C
selectIndicatorsToConfirm(indicators: MatchableIndicator[], exclusions: Exclusions): MatchableIndicator[]  // thuần
recordConfirmedIndicators(tx, caseId: string, staffUserId: string, exclusions): Promise<number>
listConfirmedIndicators(session: StaffSession, page: number, deps): Promise<ConfirmedIndicatorPage>
removeConfirmedIndicator(session: StaffSession, id: string, reason: string, deps):
  Promise<{ kind: "removed" } | { kind: "already_removed" } | { kind: "not_found" }>
findVerifiedMatches(keys: MatchableIndicator[], deps): Promise<VerifiedMatch[]>   // engine dùng, không cần session
```

`findVerifiedMatches` không nhận `StaffSession`. Đây là đường đọc nội bộ của engine, chỉ trả cặp `(type, normalized)` khớp, không trả dữ liệu nhân viên.

## 6. Trang `/ops/chi-dau` (T-081)

Theo ui-pages §7 và pages.md §7. Phần bổ sung:
- Server component, gọi `requireStaffPage` rồi `listConfirmedIndicators`.
- Chỉ hiện dòng **chưa gỡ**, mới nhất trước, 50 dòng/trang. Lịch sử gỡ còn trong DB nhưng không có màn hình trong v1.
- Cột: Chỉ dấu (văn bản thuần, font đơn cách, không `href`; P5) · Loại · Từ hồ sơ (link nội bộ) · Thời điểm · Người xác nhận (`displayName`).
- Nút "Gỡ" mở `ConfirmDialog`:
  - Có ô lý do và bộ đếm. Bẫy focus, `Esc` đóng, trả focus về nút gốc.
  - 200 → đóng hộp thoại, `router.refresh()`, báo "Đã gỡ {chỉ dấu}" qua `aria-live`.
  - 409 → "Chỉ dấu này đã được gỡ trước đó.", rồi `router.refresh()`.
  - 401 → về trang đăng nhập.
  - Lỗi mạng → giữ hộp thoại và lý do đang gõ.
- Trống: "Chưa có chỉ dấu nào được xác minh."
- Mục "Chỉ dấu đã xác minh" trên thanh điều hướng FraudOps chỉ có khi S8 được làm. Cắt S8 thì bỏ cả trang và mục này.

## 7. Demo và dữ liệu

- **Kịch bản vòng phản hồi trong video:** kết luận hồ sơ M1 là `confirmed_scam` → dán M3 trên ScamShield → thấy signal đã xác minh. Cảnh này **chỉ chạy đúng** khi `vi-xac-minh.example` chưa nằm trong danh sách lúc bắt đầu (demo.md S2).
- **Rủi ro:** giám khảo dùng `judge1…judge5` kết luận một **case thật** (không phải seed) chứa `vi-xac-minh.example`. Dòng sinh ra không bị `demo:reset` xoá. Trước mỗi lần quay hay buổi chấm, owner mở `/ops/chi-dau` và gỡ tay. Thêm một dòng vào checklist ở demo.md.
- **Seed:** case seed đã đóng `confirmed_scam` có thể sinh chỉ dấu, nhưng **không** được chứa `vi-xac-minh.example`. Chỉ dấu của seed dùng tên miền `*.example` khác.

## 8. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Unit `selectIndicatorsToConfirm` (TDD) | Tên miền chính thức bị loại; tên miền dịch vụ rút gọn bị loại; SĐT và số tài khoản giữ nguyên; danh sách rỗng |
| Unit engine (deps giả) | Khớp một chỉ dấu → check `verified_indicator` `warn` và signal; verdict `high_risk` qua R1; **LLM lỗi + khớp** → `high_risk`, `inconclusiveReason` khác null (P-01); không khớp → không có check `verified_indicator`; deps rỗng (eval) → giống hệt khi chưa có S8 |
| Int `decideCase` + `recordConfirmedIndicators` | `confirmed_scam` ghi đúng số dòng; `not_scam` và `insufficient_evidence` không ghi; chỉ dấu đã có → không thêm dòng, giữ nguồn cũ; lỗi ghi chỉ dấu → kết luận rollback |
| Int `removeConfirmedIndicator` | Gỡ một lần → 200; lần hai → `already_removed`; `id` lạ → `not_found`; sau khi gỡ, `findVerifiedMatches` không còn trả chỉ dấu đó; ghi lại sau khi gỡ được |
| Int reset | `demo:reset` xoá chỉ dấu sinh từ seed, giữ chỉ dấu sinh từ case thật, không vướng FK |
| Route | 401, 403, 400 lý do ngắn, 409 |
| E2E (T-092, nếu S8 có trong bản build) | Kết luận M1 → dán M3 → thấy câu nguyên văn SO-08-AC02 |

**Ánh xạ AC:**
- SO-08-AC01: int `decideCase` + `recordConfirmedIndicators`.
- SO-08-AC02: unit engine; E2E; so chuỗi câu nguyên văn ở design-system §3.
- SO-08-AC03: int `decideCase` với `not_scam`, `insufficient_evidence`; int gỡ; route gỡ.

## 9. Quyết định (owner chốt 26/11/2026)

Tiền tố `XM-` (xác minh, slice S8), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| XM-01 | Có loại tên miền chính thức và dịch vụ rút gọn khi ghi chỉ dấu không (§2) | (a) Loại. Không bao giờ biến tên miền thật thành "đã xác minh lừa đảo"; lệch chữ SO-08-AC01 ("các chỉ dấu của case"), phải sửa spec. (b) Ghi tất cả, đúng chữ spec. Một kết luận có thể đẩy mọi tin thật của một ngân hàng lên `high_risk` cho tới khi có người gỡ | (a). Nên chốt cùng ST-01 của S7 · **Owner chốt 26/11** |
| XM-02 | Số tổng đài `1800`/`1900` của tổ chức thật xuất hiện trong tin lừa đảo | `brands.json` không có số điện thoại, nên chưa loại được. (a) Chấp nhận; nhân viên thấy trước ở form (§2) và gỡ tay khi cần. (b) Thêm số tổng đài chính thức vào `brands.json`: cần nguồn tra cho từng số, tốn thời gian | (a) · **Owner chốt 26/11** |
| XM-03 | Có cắt S8 không | Thứ 1 trong thứ tự cắt (plan §7). Cần một migration mới, đụng vào engine (A), giao dịch kết luận (C) và một trang (B) | **Chưa cắt**, owner chốt 26/11; xem lại cùng các P1 khác ngày 27/11 (team-split §4) |

## 10. Rủi ro

- **Dương tính giả lan rộng:** một chỉ dấu sai làm mọi tin sau có chỉ dấu đó ra `high_risk`. XM-01, phần xem trước ở form và việc gỡ có lý do là ba lớp chặn.
- **Eval lệch:** nếu eval runner gọi engine với DB thật, kết quả thay đổi theo những gì giám khảo đã kết luận. §3 bắt buộc eval dùng deps rỗng.
- **Lịch:** plan đặt S8 ở 29/11, sát hạn đóng băng 30/11, và còn cần owner chạy migration trên DB deploy. Nếu cắt, engine vẫn dùng deps rỗng và không phải sửa gì.
