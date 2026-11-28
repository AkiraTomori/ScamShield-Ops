# Thiết kế slice S9: dữ liệu demo, seed/reset, E2E (T-090…T-093)

**Trạng thái (28/11/2026):** **OWNER ĐÃ DUYỆT SLICE S9 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. Agent được viết mã cho slice này. Trước T-090 đã có `upsertDemoStaff` và `npm run demo:seed` phần tài khoản (làm sớm trong T-060 theo OP-04, đã merge, PR #51) và `demo-messages.json` bản tạm và schema của nó (§2; T-041, đã merge, PR #48). **T-090 xong ở local 28/11** (seed, reset, `demo:reset`; [§10](#10-ghi-chú-cài-đặt-t-090-28112026)). **T-092 xong ở local 28/11; T-093 đã soạn tin, chờ đội đọc lại** ([§11](#11-ghi-chú-cài-đặt-t-092-t-093-28112026)). Cả ba ở PR #54 (nhánh `feat/s9-demo-seed`), chưa merge, chưa deploy. Mọi việc của S9 đều là **P0**. T-090 phụ thuộc T-063 (S6), T-092 phụ thuộc T-063 và T-051 (S5). T-093 chỉ cần T-033 (`brands.json`). T-091 là việc của owner trên DB deploy.

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5). Nó chỉ bổ sung phần các file dưới còn để ngỏ:
- [spec SO-10](../spec/ScamShield-v1.md): AC01…AC05, Q-07, spec §8 (kịch bản demo).
- [data-model §5, §7](../architecture/data-model.md) (đã duyệt): mã seed `SC-0001…0040`; định nghĩa `demo:seed` và `demo:reset`.
- [demo.md](../runbook/demo.md): kịch bản video, dữ liệu M1/M2/M3/S1/S2, checklist.
- [plan §1](../runbook/plan.md#1-mục-tiêu): luồng 6 bước.
- [conventions/frontend §8](../conventions/frontend.md#8-test-giao-diện) (C-01): Playwright cho E2E.
- Thiết kế cùng ngày duyệt (26/11), phần liên quan: [scamshield-ui §7](./scamshield-ui.md) (tin mẫu), [report-flow §9](./report-flow.md) (mã bí mật của case seed), [related-cases §5](./related-cases.md) (seed phải có chỉ dấu), [verified-indicators §4, §7](./verified-indicators.md) (reset và S2).

## 1. Kết quả cần có

- Giám khảo mở FraudOps và thấy 20–40 hồ sơ mẫu ở nhiều trạng thái, có badge "Dữ liệu mẫu". Đăng nhập được ngay bằng `judge1…judge5`.
- Owner chạy **một** lệnh để đưa dữ liệu demo về trạng thái ban đầu, không mất hồ sơ do giám khảo tạo.
- Mỗi tin dùng trong video và trên trang có một nguồn duy nhất, ra đúng verdict mong đợi một cách ổn định.
- Một kịch bản Playwright đi hết 6 bước của plan §1.

## 2. Tin demo: một nguồn duy nhất (T-093)

*(28/11, T-093: file có đủ 5 tin chính thức; M1 và M3 mạo danh Vietcombank. Chỗ khác bản này và kết quả chạy thử ở [§11](#11-ghi-chú-cài-đặt-t-092-t-093-28112026).)*

**File:** `packages/shared/data/demo-messages.json`. Trang `/` (thay cho `samples.ts` ở scamshield-ui §7), seed, E2E và eval cùng đọc file này. Không chép nội dung tin ra chỗ khác.

| id | Vai trò | Trên trang (chip) | Verdict mong đợi | Ràng buộc |
|---|---|---|---|---|
| `M1` | Tin lừa đảo chính trong video | "Khoá tài khoản" | `high_risk` | Mạo danh một thương hiệu thật có trong `brands.json` (R-01); tên miền `vi-xac-minh.example`; đòi OTP; áp lực thời gian |
| `M2` | Tin OTP thật | "Tin OTP thật" | `no_signal` | Không có đường dẫn lạ; nếu có thì chỉ là tên miền chính thức. Không viết "trả lời / đánh giá / kết luận … an toàn" trong 30 ký tự, kể cả cách nhau bởi dấu chấm: bị bắt là chèn lệnh AI ([analysis-pipeline §13](./analysis-pipeline.md#13-ghi-chú-cài-đặt-26112026)) |
| `M3` | Tin lừa đảo thứ hai | **Không** có chip; dán tay | `high_risk` | Nội dung khác M1 (ví dụ "hoàn tiền"), **cùng** tên miền `vi-xac-minh.example` |
| `prize` | Trúng thưởng | "Trúng thưởng" | `high_risk` hoặc `suspicious` | Tên miền `*.example` khác `vi-xac-minh.example` |
| `urgent` | Chuyển tiền gấp | "Chuyển tiền gấp" | `suspicious` | Không có URL; "người thân cấp cứu" kèm số tài khoản |

- Chỉ dùng tên miền `*.example` hoặc `*.test` (AGENTS.md). Không dùng logo; tên thương hiệu thật chỉ xuất hiện như nội dung tin (spec §9).
- Mỗi tin có trường `expectedVerdict`, để test và E2E đọc cùng một chỗ.
- **Chống rò rỉ eval:** năm tin này **không** được có trong tập held-out, vì chúng công khai trên trang. Chúng **được** đưa vào tập dev, để runner eval (T-101) chạy mỗi tin 3 lần và đo độ ổn định. Như vậy không cần một lệnh kiểm riêng cho mục "chạy thử M1, M2, M3 ít nhất 3 lần" ở checklist demo.md §3.
- A kiểm verdict của các tin này (team-split §3). Lệch verdict mong đợi thì sửa nội dung tin. **Không** chỉnh quy tắc cho vừa tin demo.

## 3. Seed và reset (T-090)

### 3.1 Một đường code cho cả hai lệnh

```ts
// packages/core/src/demo — vai C
upsertDemoStaff(passwords: string[], deps): Promise<void>        // judge1…judge5
resetDemoData(deps, opts: { lookupSecret?: string }): Promise<DemoSummary>   // một giao dịch
```

- `npm run demo:seed` = `upsertDemoStaff` + `resetDemoData`.
- `npm run demo:reset` = chỉ `resetDemoData`, không đụng `staff_users` (data-model §7).
- **Chạy nhiều lần vẫn ra cùng một kết quả.** `demo:seed` lần hai không tạo trùng, vì `resetDemoData` luôn xoá rồi chèn lại phần seed.
- Script ở `packages/core/scripts/demo-seed.ts` và `demo-reset.ts`, chạy bằng `tsx` giống `eval:q08`. Thêm vào `package.json` gốc và codebase.md §3.

### 3.2 Thứ tự trong giao dịch reset

1. Xoá `confirmed_indicators` có `source_case_id` thuộc case seed. Chỉ làm khi bảng này tồn tại (S8).
2. Xoá `decisions` của case seed.
3. Xoá case seed.
4. Xoá analysis seed. `analysis_indicators` tự xoá theo cascade.
5. Chèn lại analysis, chỉ dấu, case, kết luận và (nếu có S8) chỉ dấu đã xác minh của seed.

Mọi câu `DELETE` đều có điều kiện `is_seed = true`, hoặc join tới case/analysis có `is_seed = true`. Test tích hợp (§6) kiểm rằng dữ liệu không phải seed không bị đụng tới.

### 3.3 Nội dung seed

Nằm trong `packages/core/src/demo/seed-data.ts`. Đây là dữ liệu soạn tay, **không** gọi LLM hay pipeline (data-model §7).

| Nhóm | Số case | Trạng thái | Mục đích |
|---|---|---|---|
| S1: chung `vi-xac-minh.example` | 3 | 1 `pending_review`, 1 đóng `insufficient_evidence`, 1 đóng `not_scam` (để có một nhãn "không đồng ý với AI") | Cảnh SO-07 "3 hồ sơ khác có cùng chỉ dấu". **Không** case nào là `confirmed_scam`, để đúng S2 |
| Chờ xem xét, đủ 4 verdict | 14 | `pending_review` | Hàng đợi mặc định không trống |
| Đã đóng | 7 | Trộn ba kết luận của `judge1`; ít nhất 2 case không đồng ý với AI | Danh sách và thẻ kết luận |
| Không có tóm tắt AI | 1 (trong 14) | `pending_review`, `ai_summary = null` | Câu A-02 |
| Có chung SĐT hoặc số tài khoản | 2 (trong 14) | `pending_review` | SO-07 với loại chỉ dấu khác tên miền |

Tổng: **24 case**, mã `SC-0001…SC-0024`.

- **Ràng buộc cho mỗi case seed:**
  - `details` qua được zod schema `AnalysisResult` (DB-02).
  - `verdict`, `rule` và `riskTypes` **phải khớp** kết quả của `decide()` (rules-v1) trên signal của chính case đó. Có test bắt buộc (§6), để dữ liệu mẫu không mâu thuẫn với quy tắc mà slide trình bày (P4).
  - Có dòng `analysis_indicators` cho mọi chỉ dấu `domain`, `phone`, `bank_account` (S7 cần).
  - Case `closed` luôn có `closed_at` và một dòng `decisions`, chèn trong cùng giao dịch. Thiếu dòng này thì trang hồ sơ chỉ báo "không có kết luận được lưu" ([fraudops §11](./fraudops.md#11-ghi-chú-cài-đặt-28112026)).
  - Chỉ dùng tên miền `*.example` và thương hiệu giả "Ví XYZ", trừ ba case S1 dùng cùng thương hiệu với M1.
  - `disagrees_with_engine` tính bằng hàm `disagreesWithEngine` của S6, không gõ tay.
- **Thời điểm:** `created_at` rải trong 7 ngày trước lúc chạy reset, theo thứ tự mã. Danh sách luôn trông mới, và thứ tự vẫn ổn định.
- **`trace`:** `{ "seed": true }`. Cột này NOT NULL, và eval không đọc analysis seed.

### 3.4 Tài khoản và mã bí mật

- **`DEMO_STAFF_PASSWORDS`:** 5 mật khẩu ngăn bởi dấu phẩy, chỉ có trong `.env` của owner. Mỗi mật khẩu dài ít nhất 12 ký tự; sai định dạng thì lệnh dừng trước khi ghi gì. Mỗi lần upsert ghi lại `password_hash`, nên đổi mật khẩu chỉ cần chạy lại `demo:seed`. `display_name` = "Giám khảo 1…5", `is_demo = true`.
- **Mã bí mật của case seed (DM-01):** đề xuất `SC-0001` dùng mã lấy từ biến `DEMO_LOOKUP_SECRET`. Mã này ghi trong hướng dẫn A4, để giám khảo thử `/tra-cuu`. Các case seed khác dùng mã ngẫu nhiên và bỏ đi; không ai tra được. Chưa đặt biến thì mọi case dùng mã ngẫu nhiên.
- **Log:** lệnh chỉ in số dòng đã xoá và chèn. **Không** in mật khẩu, mã bí mật hay chuỗi kết nối (AGENTS.md).

### 3.5 Chạy trên DB deploy (T-091, owner)

- Agent **không** chạy hai lệnh này trên DB deploy (AGENTS.md, plan §5). Owner chạy sau khi đã chạy migration (T-012, và `0001` nếu có S8).
- Reset trong giờ giám khảo đang dùng: giám khảo đang xem một case seed có thể gặp 404 ngay lúc đó. Kết luận đang lưu dở trên case seed sẽ nhận 404 (S6 `decideCase`). Nên chạy reset ngoài giờ chấm.
- Thêm vào setup-and-bringup.md một mục "Chạy seed trên production": thứ tự lệnh, biến cần có, cách kiểm (đăng nhập `judge1`, đếm 24 case "Dữ liệu mẫu").

## 4. E2E luồng 6 bước (T-092)

**File:** `apps/web/e2e/demo-flow.spec.ts`. Tên test ghi `SO-10-AC01` (frontend §8).

| Bước plan §1 | Thao tác | Kiểm |
|---|---|---|
| 1 | Mở `/` ở khung 390px, bấm chip M1, bấm Kiểm tra | Nút chuyển sang "Đang kiểm tra…" |
| 2 | Chờ kết quả, tối đa 25 giây | Có `VerdictBanner`, có ít nhất một badge nguồn, có disclaimer; **không** có `<a>` nào chứa `vi-xac-minh.example` |
| 3 | Gửi báo cáo, kênh SMS, ghi chú "Kiểm thử E2E" | Có mã hồ sơ `SC-\d{4}` và mã bí mật |
| 4 | Context mới ở khung 1280px, đăng nhập `judge1` | Vào được `/ops` |
| 5 | Tìm theo mã vừa nhận, mở hồ sơ, kết luận **`insufficient_evidence`** kèm lý do | Có thẻ kết luận |
| 6 | Tải lại trang | Thẻ kết luận và trạng thái "Đã đóng" vẫn còn (SO-06-AC05) |

- **Kết luận `insufficient_evidence`, không phải `confirmed_scam`.** Kết luận `confirmed_scam` cho M1 sẽ đưa `vi-xac-minh.example` vào danh sách đã xác minh (S8), làm hỏng trạng thái S2 của video. Case E2E cũng rời hàng đợi mặc định, không làm rối mắt giám khảo.
- **Kiểm verdict (DM-02):** bước 2 chỉ kiểm có **một trong bốn** verdict, không ép đúng `high_risk`. Verdict phụ thuộc LLM thật; độ đúng và độ ổn định do eval đo (§2). Ép đúng verdict sẽ làm E2E chập chờn mỗi khi Groq chậm.
- **LLM thật, không có chế độ giả.** Không thêm biến môi trường kiểu "LLM giả" vào mã production: biến đó có thể bị bật nhầm trên bản deploy. Mỗi lần chạy E2E tốn khoảng 3 lượt gọi Groq.
- **Môi trường:**
  - Mặc định: `next dev` cùng Postgres Docker local, đã chạy `demo:seed` với `.env` local.
  - Bản deploy: đặt `E2E_BASE_URL`, chạy **tay**, tối đa một lần ở mốc đóng băng (T-102). Case E2E sinh ra trên production là case thật (không phải seed), có ghi chú "Kiểm thử E2E", đã đóng. Không xoá bằng tay trong DB.
  - Không đưa vào CI, vì cần DB và Groq (frontend §8).
- Mật khẩu `judge1` đọc từ biến `E2E_JUDGE_PASSWORD`, không ghi trong file test.
- Thêm `@playwright/test` (đã cho phép ở libraries.md, C-01), ghim phiên bản lúc cài, và thêm lệnh `npm run test:e2e` (tên theo [codebase §3](../architecture/codebase.md#3-lệnh); bản duyệt ghi `npm run e2e`).

## 5. Phụ thuộc

| Cần | Ai | Chặn |
|---|---|---|
| `brands.json` (T-033) | A | T-093 (M1, M3 cần thương hiệu thật) |
| `AnalysisResult` schema, `decide()` (S3) | A, C | Seed |
| `disagreesWithEngine`, bảng của S6 | C | Seed có kết luận |
| Bảng `confirmed_indicators` (S8, nếu làm) | C | Bước 1 và 5 của reset |
| T-051 form báo cáo, T-063 kết luận | B, C | E2E |

## 6. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Unit seed data | Mọi case parse được bằng zod; `decide()` trên signal ra đúng `verdict`, `rule`, `riskTypes` đã ghi; mọi chỉ dấu khớp được đều có dòng `analysis_indicators`; ba case S1 không có `confirmed_scam`; tên miền chỉ là `*.example` |
| Unit `demo-messages.json` | Đủ 5 id (`M1`, `M2`, `M3`, `prize`, `urgent`; không dùng `P1`/`P2` để khỏi nhầm với nguyên tắc P1–P5); M1 và M3 cùng chứa `vi-xac-minh.example`; thương hiệu của M1 có trong `brands.json`; không tin nào nằm trong file held-out |
| Int `resetDemoData` (Postgres local) | Chạy hai lần ra cùng 24 case; một case thật, một kết luận thật, một chỉ dấu đã xác minh từ case thật vẫn còn sau reset (SO-10-AC04); một kết luận của giám khảo trên case seed bị xoá (đã chấp nhận) |
| Int `upsertDemoStaff` | Tạo 5 tài khoản; chạy lại với mật khẩu mới thì đăng nhập bằng mật khẩu mới được; `DEMO_STAFF_PASSWORDS` sai định dạng thì không ghi gì |
| E2E | §4 |
| Kiểm tay trên bản deploy | Checklist demo.md §3, cộng mục "gỡ `vi-xac-minh.example` ở `/ops/chi-dau` nếu có" (verified-indicators §7) |

**Ánh xạ AC:**
- SO-10-AC01: E2E local; chạy tay trên bản deploy ở chế độ ẩn danh, trên máy tính và điện thoại (T-114).
- SO-10-AC02: int `upsertDemoStaff`; hướng dẫn A4 (T-111).
- SO-10-AC03: unit seed data; int reset; ảnh danh sách có badge.
- SO-10-AC04: int reset giữ dữ liệu không phải seed.
- SO-10-AC05: unit `demo-messages.json`; kiểm tay chip điền vào ô mà không tự gửi.

## 7. Đồng bộ tài liệu khi viết mã

- codebase.md §3: đổi trạng thái `demo:seed` và `demo:reset`; thêm `npm run test:e2e`.
- `.env.example`: thêm `DEMO_STAFF_PASSWORDS`, `DEMO_LOOKUP_SECRET`, `E2E_BASE_URL`, `E2E_JUDGE_PASSWORD`, chỉ với giá trị giả.
- setup-and-bringup.md: mục chạy seed trên production (§3.5).
- demo.md §3: thêm mục gỡ chỉ dấu; đổi "chạy thử M1, M2, M3 ít nhất 3 lần" thành "xem kết quả eval dev của M1, M2, M3, và chạy tay một lần trên bản deploy".
- scamshield-ui §7: tin mẫu đọc từ `demo-messages.json`.

## 8. Quyết định (owner chốt 26/11/2026)

Tiền tố `DM-` (demo, slice S9), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| DM-01 | Mã bí mật của case seed | (a) `SC-0001` dùng `DEMO_LOOKUP_SECRET`, ghi trong hướng dẫn A4; các case khác dùng mã ngẫu nhiên. Giám khảo thử được `/tra-cuu` mà không phải gửi báo cáo trước. (b) Mọi case seed dùng mã ngẫu nhiên: không ai tra được case mẫu, giám khảo phải tự gửi báo cáo rồi mới tra | (a); không cần nếu cắt T-052 · **Owner chốt 26/11** |
| DM-02 | E2E có ép verdict M1 là `high_risk` không | (a) Chỉ kiểm có verdict: E2E ổn định, độ đúng giao cho eval. (b) Ép `high_risk`: bắt được lỗi quy tắc ngay trong E2E, nhưng chập chờn theo Groq | (a) · **Owner chốt 26/11** |
| DM-03 | Số case seed | 24 (trong khoảng 20–40 của SO-10-AC03): đủ cho 1 trang 25 dòng, và soạn tay kịp. 40 thì danh sách có 2 trang để thấy phân trang, nhưng tốn thêm nửa ngày soạn | 24 · **Owner chốt 26/11** |
| DM-04 | Thương hiệu thật trong M1, M3 và ba case S1 (R-01) | Chọn một thương hiệu trong Phụ lục A **khác MoMo**, để giám khảo MoMo không hiểu nhầm đây là cảnh báo về chính họ. Hoặc dùng MoMo vì gần ngữ cảnh cuộc thi | **Một ngân hàng trong Phụ lục A** (ví dụ Vietcombank), không dùng MoMo, owner chốt 26/11; tên cụ thể chọn khi soạn M1 (T-093) |

## 9. Rủi ro

- **Seed mâu thuẫn quy tắc:** nếu `rules-v1` đổi sau khi chỉnh theo eval dev (P-05, P-06), case seed cũ có thể lệch. Test ở §6 sẽ đỏ; sửa seed trong cùng PR với thay đổi quy tắc.
- **Lịch:** T-090 dự kiến 28/11, T-092 29/11, T-091 29/11 (owner), sát hạn đóng băng 30/11. T-093 đã trễ so với lịch 25/11 và không bị chặn, nên làm sớm nhất có thể.
- **E2E trên production để lại một case thật.** Đã giảm thiểu bằng cách đóng case và gắn ghi chú (§4).

## 10. Ghi chú cài đặt T-090 (28/11/2026)

**PR #54 (nhánh `feat/s9-demo-seed`), chưa merge, chưa deploy.**

**Đã làm:**
- `packages/core/src/demo/{seed-data,reset}.ts`; script `packages/core/scripts/demo-{seed,reset}.ts` dùng chung `scripts/demo.ts`; lệnh `npm run demo:reset`; biến `DEMO_LOOKUP_SECRET` trong `.env.example`. Không cần migration.
- 24 hồ sơ: `SC-0001…0003` là S1, `SC-0004…0017` chờ xem xét (`SC-0007` và `SC-0008` chung số điện thoại, `SC-0016` không có tóm tắt AI), `SC-0018…0024` đã đóng. Ba hồ sơ đã đóng `confirmed_scam` sinh ba chỉ dấu đã xác minh (một tên miền, một số tài khoản, một số điện thoại).

**Chỗ khác hoặc thêm so với bản duyệt, chờ owner xác nhận:**
- **Chỉ dấu và phép kiểm không gõ tay (§3.3).** Nội dung, signal của AI, giải thích, tóm tắt, kết luận và verdict mong đợi được soạn tay. Chỉ dấu, phép kiểm, signal tất định và khuyến nghị tính bằng đúng các hàm tất định của pipeline (`extractIndicators`, `runChecks`, `detectInjection`, `recommend`), nên giá trị chuẩn hoá khớp với hồ sơ thật (SO-07). Không gọi LLM, không gọi `analyzeMessage`, không gọi `decide()` lúc seed. `runChecks` được export thêm từ `analysis/analyze.ts`.
- **Thương hiệu của ba hồ sơ S1 là Vietcombank** (ví dụ ở DM-04), đặt một chỗ ở `seed-data.ts`. T-093 đã soạn M1, M3 cùng thương hiệu này ([§11](#11-ghi-chú-cài-đặt-t-092-t-093-28112026)); đổi thì đổi cả hai.
- Reset khoá các hồ sơ seed (`SELECT … FOR UPDATE`) trước khi xoá. Kết luận đang lưu dở được ghi xong rồi mới bị xoá, nên không sinh chỉ dấu chen giữa các bước làm hỏng giao dịch.
- `demo:reset` khi chưa có `judge1` thì dừng và không ghi gì (kết luận của seed cần người kết luận).
- `DEMO_LOOKUP_SECRET` sai định dạng thì cả hai lệnh dừng trước khi ghi gì, kể cả tài khoản.
- `prompt_version` và `summary_prompt_version` của dữ liệu seed là `seed`; `latency_ms` = 0.
- **Bước gỡ chỉ dấu luôn chạy (§3.2 ghi “chỉ làm khi bảng này tồn tại”).** S8 đã merge, nên DB chưa chạy migration `0001` thì lệnh lỗi và không ghi gì vào hồ sơ.
- `resetDemoData` không export từ `@scamshield/core`, để web app không chạm tới được hàm xoá dữ liệu; script import thẳng từ `src/demo`.
- Một hồ sơ chờ xem xét dùng địa chỉ IP dành cho tài liệu (`192.0.2.10`) để có signal `ip_url`.

**Hạn chế biết trước (khác §3.5):** kết luận được lưu **trước** khi reset khoá hồ sơ thì ghi xong rồi bị xoá. Kết luận gửi tới **trong lúc** reset đang giữ khoá thì có thể trả lỗi 500 (`closed_without_decision`) thay vì 404: `decideCase` không thấy dòng đã xoá, rồi đọc lại thấy hồ sơ mới cùng mã đang chờ. Suy ra từ đọc mã, chưa có test. Không có dữ liệu nào hỏng; tải lại trang là được. Nên chạy reset ngoài giờ chấm.

**Hạn chế biết trước:** nếu một hồ sơ thật được kết luận `confirmed_scam` với chỉ dấu mà hồ sơ seed đang giữ trong danh sách, danh sách vẫn giữ dòng của seed (không thêm dòng thứ hai), nên reset gỡ luôn chỉ dấu đó. Chỉ dấu của seed là dữ liệu giả, nên khó xảy ra.

**Đã kiểm 28/11 ở local:**
- `npm run verify` với `DATABASE_URL` trỏ Postgres tạm (container riêng): 81 file, 1232 test qua, gồm `packages/core/test/demo/{seed-data.test,reset.int.test}.ts`.
- `next build`.
- `demo:reset` và `demo:seed` chạy từ bản sao mã không có `.env`, trên DB tạm: các trường hợp lỗi không ghi gì; chạy lặp ra cùng số dòng.
- `next start` trên DB tạm: đăng nhập `judge1`; `/ops` hiện 24 hồ sơ có badge "Dữ liệu mẫu" (ảnh 1280px, Edge headless); 24 trang chi tiết trả 200 và có badge; `/ops/chi-dau` không có `vi-xac-minh.example`; `/api/case-status` mở được `SC-0001`.

**Chưa kiểm lúc đó:** DB deploy (kiểm sau ở [§12](#12-kiểm-trên-db-supabase-28112026)) và bản deploy; ảnh 360px; cảnh M3 với tin gửi thật qua LLM (test tích hợp chỉ chèn một hồ sơ cùng tên miền); M3 lúc đó chưa soạn (soạn ở T-093, [§11](#11-ghi-chú-cài-đặt-t-092-t-093-28112026)).

## 11. Ghi chú cài đặt T-092, T-093 (28/11/2026)

**PR #54 (nhánh `feat/s9-demo-seed`), chưa merge, chưa deploy.**

**T-093, tin demo:**
- M1 giữ câu cũ, đổi thương hiệu thành **Vietcombank** (DM-04, R-01). M3 mới (hoàn phí), cùng tên miền và thương hiệu, không có chip.
- `prize` đổi `expectedVerdict` từ `high_risk` thành `suspicious` (bảng §2 cho phép cả hai): tín hiệu của tin này chỉ ở mức vừa và yếu, nên `rules-v1` ra R7. Không chỉnh quy tắc.
- M2, `urgent` giữ nguyên.
- `S1_BRAND` được export từ `seed-data.ts` để test giữ M1, M3 và hồ sơ S1 cùng thương hiệu.
- **Chưa làm:** thêm 5 tin vào tập dev của eval (§2, [eval-suite §2.1](./eval-suite.md#21-thành-phần-đề-xuất-80-câu)). Việc này đổi `casesSha256` và cần người gán nhãn, thuộc T-100.
- **Chưa làm:** đổi câu "chạy thử M1, M2, M3" ở demo.md §3 theo §7. Câu mới dựa vào kết quả eval dev của tin demo, nên chờ T-100.
- **Chờ đội xem:** T-093 vốn của cả đội (vai B); năm tin cần đội đọc lại, vai A kiểm verdict (§2).

**T-092, E2E:**
- `apps/web/e2e/demo-flow.spec.ts`, `apps/web/playwright.config.ts`, `@playwright/test` 1.65.1, `npm run test:e2e`, biến `E2E_JUDGE_PASSWORD` và `E2E_BASE_URL`.
- **Owner yêu cầu 28/11:** E2E luôn dùng DB local với file env riêng. `.env.e2e` do `npm run e2e:setup` (`packages/core/scripts/e2e-setup.ts`) viết; chạy local không dùng `DATABASE_URL` trong `.env` (thay câu "với `.env` local" ở §4). Kiểm 28/11: `.env` đang trỏ Supabase, `e2e:setup` và `test:e2e` chạy trên DB local `scamshield_e2e`, E2E qua, số dòng trên Supabase không đổi.
- **Thêm so với bản duyệt, chờ owner xác nhận:** chạy local thì cấu hình từ chối `DATABASE_URL` không trỏ về máy này; server riêng ở cổng 3100, không dùng lại server đang chạy; không ghi trace (trace chứa mật khẩu và mã bí mật).
- Mỗi lần chạy trên bản deploy để lại một hồ sơ thật chứa `vi-xac-minh.example`, nên khối hồ sơ liên quan đếm thêm hồ sơ này; `demo:reset` không xoá nó.

**Đã kiểm 28/11 ở local (Postgres tạm, Groq thật):**
- `npm run verify`: 82 file, 1247 test qua, gồm test tích hợp. `next build` qua.
- `npm run test:e2e`: lần đầu hỏng ở bước 6 do selector của test, sửa xong thì qua (8,6 giây). `DATABASE_URL` trỏ máy khác thì bị từ chối trước khi chạy.
- Năm tin qua `POST /api/analyses`: M1 `high_risk` (R3), M2 `no_signal` (R9), M3 `high_risk` (R3), `prize` và `urgent` `suspicious` (R7). Mỗi tin mới có **một** lượt model chạy được. Lượt đầu của M2 và `urgent` ra `inconclusive` vì Groq trả 429.
- Sau khi xác nhận lừa đảo một hồ sơ M1, M3 ra `high_risk` theo R1.

**Ngoài §7, chờ owner xác nhận:** `apps/web/vercel.json` (lệnh cài từ gốc repo, region `sin1`), chưa có thiết kế nào duyệt; lý do ở [setup-and-bringup §6.4](../runbook/setup-and-bringup.md#64-project-vercel).

**Chưa kiểm:** bản deploy; độ ổn định qua nhiều lượt; khối "hồ sơ liên quan" với tin M3 gửi thật.

**Rủi ro cho video:** Groq trả 429 thì chip M1, M2, `urgent` ra "Chưa đủ thông tin để kết luận". Chỉ lượt đã khớp danh sách xác minh (R1) không phụ thuộc model.

**Sửa theo review (28/11):**
- **Khác §7, chờ owner xác nhận:** `.env.example` không còn dòng `E2E_BASE_URL=`, chỉ còn chú thích cách đặt trong shell.
- `E2E_BASE_URL` chỉ đọc từ shell, để một giá trị bỏ quên trong file env không đưa các lần chạy sau lên bản deploy. Phần chọn site và DB tách ra `apps/web/e2e/env.ts`, có test `apps/web/test/e2e/env.test.ts`.
- Chạy trên bản deploy: `preserveOutput: "never"` và không chụp màn hình. Đã kiểm bằng một test cố ý hỏng khi trang đang hiện mã giả: không file và không dòng terminal nào chứa mã. Chỉ tắt ảnh chụp là chưa đủ, vì `error-context.md` chứa nội dung trang. Chạy local vẫn giữ hai file đó.
- Bước đăng nhập chỉ điền khi form còn sửa được. Đã tái hiện với `/ops` chậm 8 giây: bản cũ hỏng, bản mới qua.
- Sau khi sửa: `npm run verify` 83 file, 1255 test (gồm tích hợp trên Postgres tạm), `next build`, `npm run test:e2e` trên DB local đều qua.

## 12. Kiểm trên DB Supabase (28/11/2026)

Owner đã chạy migration và seed lên Supabase. App chạy **ở local** (`next dev`), `DATABASE_URL` là kết nối trực tiếp của Supabase. **Đây chưa phải bản deploy.**

**Đạt:**
- Đọc DB: 2 migration, RLS bật trên 9 bảng, 24 hồ sơ mẫu (15 chờ, 9 đóng), 18 chỉ dấu, 9 kết luận, `judge1…judge5`, 3 chỉ dấu đã xác minh, không có `vi-xac-minh.example`.
- FraudOps: đăng nhập `judge1`; danh sách 24 hồ sơ "Dữ liệu mẫu"; mở được 24 trang chi tiết; `SC-0001` có 2 hồ sơ liên quan; `/ops/chi-dau` 3 dòng; không cuộn ngang ở 360px.
- Tin M1 (`high_risk`) và M2 (`no_signal`) ở khung 360px, đều có giải thích.
- Luồng ghi với tin trung tính (owner chọn): báo cáo → `SC-0101` → tra cứu "Đang chờ" → kết luận "Chưa đủ bằng chứng" → còn sau khi tải lại.

**Để lại trên DB:** hồ sơ `SC-0101` (đã đóng, không phải mẫu, `demo:reset` không xoá), 3 lượt phân tích không phải mẫu, một phiên `judge1` tự hết hạn.

**Lỗi tìm thấy:** request đầu tiên sau khoảng 20 giây nhàn rỗi hay trả 500 (log `case_status_failed`, mã `rate_limit`). Đo từ máy owner: mở kết nối mới khoảng 800 ms, query trên kết nối sẵn có 100–250 ms, trong khi bước giới hạn tần suất chỉ chờ 1 000 ms. Gọi `/api/case-status` sau mỗi 25 giây nghỉ: 4/6 lượt trả 500, lượt gọi ngay sau đều không lỗi. Các route khác dùng cùng hạn này nên suy ra cũng bị, chưa tái hiện. Chưa sửa mã; chờ owner quyết.

Con số 800 ms đo qua internet từ máy owner. Function ở `sin1` nối tới project cùng khu vực thì kỳ vọng nhanh hơn nhiều, **chưa đo**. Sau lần deploy đầu: nghỉ khoảng 30 giây rồi `POST /api/case-status` với mã giả, lặp 5–6 lần; 404 là ổn, 500 là lỗi có trên production (không tốn lượt Groq, không tạo hồ sơ).

**Chưa kiểm:** bản deploy; tra cứu sau khi đã kết luận (lượt đó trúng lỗi trên); `confirmed_scam` và cảnh M3 trên DB này (cố ý, để giữ S2); E2E; `judge2…judge5`.

**Bổ sung cùng ngày (T-091):** owner đặt `DEMO_LOOKUP_SECRET` rồi yêu cầu chạy `npm run demo:reset` trên Supabase (xoá và chèn lại 24 hồ sơ mẫu, 9 kết luận, 3 chỉ dấu; `SC-0101` được giữ). Sau reset, từ app ở local: `/tra-cuu` mở được `SC-0001` ("Đang chờ xem xét", ngay lượt đầu, không cuộn ngang ở 360px); `judge1` đăng nhập được; danh sách "Tất cả" 25 dòng, 24 "Dữ liệu mẫu"; `/ops/chi-dau` 3 dòng, không có `vi-xac-minh.example`.
