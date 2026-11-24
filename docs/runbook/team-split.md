# Phân công ba thành viên

**Trạng thái (24/11/2026):** đề xuất phân công theo yêu cầu owner, dựa trên [`tasks.csv`](./tasks.csv) (cột `assignee`) và lộ trình ở [plan §6](./plan.md#6-lộ-trình). **Chưa điền tên thật**: nhóm tự gán người vào vai A, B, C ở bảng dưới. Ngày ở đây là mục tiêu để kịp đóng băng 30/11; cột `planned_day` trong `tasks.csv` giữ nguyên tới khi owner đổi lịch.

## 1. Ba vai

| Vai | Người | Phụ trách | Thư mục chính |
|---|---|---|---|
| **A — AI / Engine / Eval** | *(điền tên)* | Pipeline phân tích: che dữ liệu, trích chỉ dấu, kiểm URL, quy tắc verdict, gọi LLM; bộ eval SO-09 | `packages/core/src/{redaction,indicators,url-checks,verdict,llm,lookup}`, `packages/shared/data/`, `eval/` |
| **B — Giao diện** | *(điền tên)* | ScamShield (nhập tin, kết quả, báo cáo), giao diện FraudOps, design system; slide và video | `apps/web/src/{app,components,features,copy,styles}` |
| **C — Backend / Dữ liệu / Deploy** | *(điền tên; nên là owner)* | Điều phối analysis, rate limit, lưu DB, API, báo cáo và hồ sơ, đăng nhập, seed, deploy, E2E; README, hướng dẫn A4 | `packages/core/src/{analysis,rate-limit,reports,cases,auth,demo,db}`, `apps/web/src/app/api/`, `apps/web/src/server/` |

**Owner** (người được deploy, merge, chạy migration trên DB thật) nên là C, hoặc C làm cùng owner. Theo [AGENTS.md](../../AGENTS.md), agent không làm thay các việc này.

## 2. Việc của từng người

Kích cỡ: S ≈ nửa ngày, M ≈ 1 ngày, L ≈ 2 ngày. P1 là việc cắt được (plan §7).

### A — AI / Engine / Eval (≈ 8 ngày P0 + dẫn dắt T-100)

| Ngày mục tiêu | Việc | Cỡ |
|---|---|---|
| 24/11 | T-033 `brands.json` từ spec Phụ lục A; T-031 kiểm đầu vào + che OTP/mật khẩu/số thẻ (TDD) | S, M |
| 25/11 | T-032 trích + chuẩn hoá chỉ dấu (TDD); bắt đầu T-034 phép kiểm URL | M, L |
| 26/11 | Xong T-034; T-036 quy tắc verdict + khuyến nghị (TDD) | L, M |
| 27/11 | T-037 LLM trích signal + giải thích; bàn giao hàm cho C ghép vào T-038 | M |
| 28/11 | T-101 runner eval đủ chỉ số (result.md B.3) | M |
| 29/11 | Chỉnh prompt/quy tắc theo **tập dev**; nếu còn giờ: T-035 tra cứu ngoài (P1), T-080 chỉ dấu xác minh phía engine (P1) | — |
| 01/12 | T-103 chạy held-out **một lần** cùng owner, điền result.md B.4/B.5 | S |
| Cả tuần | **T-100 dẫn dắt soạn 60–100 câu eval** (B, C cùng soạn; A duyệt nhãn cuối) | L |

### B — Giao diện (≈ 9 ngày P0)

| Ngày mục tiêu | Việc | Cỡ |
|---|---|---|
| 24/11 | T-040 Tailwind + token + component nền (design-system §2, §4) | M |
| 25/11 | T-041 trang nhập tin; T-093 soạn tin mẫu M1/M2/M3 | M, S |
| 26/11 | T-042 khối kết quả (dùng JSON giả theo [api.md](../architecture/api.md) tới khi có T-039) | M |
| 27/11 | T-051 form gửi báo cáo + màn có mã; T-061 danh sách hồ sơ (UI) | S, M |
| 28/11 | T-062 chi tiết hồ sơ (UI); T-063 kết luận (UI) | M, M |
| 29–30/11 | Trau chuốt mobile ≥ 360px, a11y, trạng thái lỗi; nếu còn giờ: T-052 tra trạng thái (P1), T-081 trang chỉ dấu (P1) | — |
| 26/11 → 02/12 | Viết kịch bản video từ 26/11; T-112 slide ≤ 10 trang, T-113 video ≤ 3 phút | M, M |

### C — Backend / Dữ liệu / Deploy (≈ 9–10 ngày P0)

| Ngày mục tiêu | Việc | Cỡ |
|---|---|---|
| **24/11 (ngay)** | T-003 Supabase, T-004 Vercel, T-005 `/api/health` trên production, T-012 migration lên Supabase (**owner**) | S ×4 |
| 25/11 | T-060 đăng nhập nhân viên, phiên cookie, guard `/ops` | M |
| 26/11 | T-038 điều phối analysis + trần 20 giây + lưu DB + rate limit (ghép hàm của A) | M |
| 27/11 | T-039 `POST /api/analyses` + chạy eval dev; T-050 báo cáo + case + tóm tắt AI | S, M |
| 28/11 | API cho T-061…T-063 (danh sách, chi tiết, kết luận có 409); T-090 seed 20–40 case + `judge1…judge5` | M, M |
| 29/11 | T-092 Playwright luồng 6 bước; T-091 seed + tài khoản thử trên production (**owner**); nếu còn giờ: T-070 hồ sơ liên quan (P1) | M, S |
| 30/11 | T-102 đóng băng tính năng, chạy end-to-end trên production | S |
| 01–02/12 | T-110 README; T-111 hướng dẫn 1 trang A4 | S, S |

### Cả ba

- **T-100:** mỗi người soạn khoảng 15–25 câu theo bốn nhóm (`clear_scam`, `legit_lookalike`, `ambiguous`, `prompt_injection`). Theo [dataset-catalog](../research/dataset-catalog.md): viết mới, không chép từ D1, chỉ dùng tên miền `*.example`/`*.test`. A duyệt cuối và chia dev/held-out trước 29/11.
- **T-114 (03/12):** đóng gói mã nguồn, kiểm không có `.env`/key, mở link ẩn danh trên máy tính và điện thoại, nộp.

## 3. Chỗ giao nhau giữa các vai

| Chỗ giao | Ai làm gì | Luật |
|---|---|---|
| Schema request/response (`packages/shared`) | C giữ; A, B đọc | Đổi schema phải báo cả nhóm **trước** khi merge |
| Hàm pipeline → điều phối | A viết hàm thuần trong `packages/core`; C gọi trong `analysis/` | A không sửa `analysis/`, C không sửa `verdict/` |
| FraudOps (T-061…T-063) | B làm trang, C làm route + core | Thống nhất JSON theo api.md trước khi bắt đầu |
| Tin mẫu và seed | B soạn tin mẫu (T-093), C nạp seed (T-090), A kiểm verdict của tin mẫu | Tin M2 (OTP thật) phải ra `no_signal` |

Không để hai người sửa cùng một file trong cùng lúc. Mỗi người làm trên nhánh `feat/…` riêng, PR nhỏ.

## 4. Nhịp làm việc

- **Mỗi sáng 10 phút:** việc nào xong, việc nào bị chặn, hợp đồng nào cần đổi.
- **27/11:** owner quyết có cắt P1 hay không (thứ tự SO-08 → SO-07 → tra cứu ngoài, plan §7).
- **29/11:** luồng P0 phải chạy trọn trên production; nếu chưa, bỏ hết P1.
- **Chất lượng là việc chung:** B thử giao diện bằng tin khó (OTP thật, tin injection); A xem câu chữ giải thích hiển thị; C chạy eval trên production.

## 5. Tải việc

| Vai | P0 (ngày-người, ước) | P1 nếu còn giờ |
|---|---|---|
| A | ≈ 8 + dẫn dắt T-100 | T-035, T-080 |
| B | ≈ 9 | T-052, T-081 |
| C | ≈ 9–10 | T-070 |

Tổng P0 còn lại khoảng 29 ngày-người, so với khoảng 27 ngày-người của ba người từ 24/11 tới 02/12. Lịch đã kín: không thêm tính năng ngoài `tasks.csv`.
