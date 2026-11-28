# 📚 ScamShield Ops — Docs

**ScamShield Ops** là một sản phẩm chống lừa đảo có hai giao diện dùng chung một AI engine:

- **ScamShield** cho người dùng: dán tin nhắn đáng ngờ, nhận đánh giá rủi ro có lý do và lời khuyên nên làm gì.
- **FraudOps** cho nhân viên vận hành fintech: mỗi báo cáo của người dùng thành một hồ sơ điều tra có bằng chứng, nhân viên xem và kết luận.

**AI đề xuất, con người quyết định.** MoMo Tech Talent 2026 · vòng loại nộp trước 03/12 · chung kết 11/12.

Docs viết bằng tiếng Việt; định danh kỹ thuật giữ tiếng Anh.

## Bắt đầu từ đâu

| Bạn muốn | Đọc theo thứ tự |
|---|---|
| **Hiểu sản phẩm làm gì** (giám khảo, người mới) | [`../README.md`](../README.md) (sơ đồ + ví dụ) → [`product/pitch.md`](./product/pitch.md) (5 phút) → [`onboarding/concepts.md`](./onboarding/concepts.md) (giải thích thuật ngữ) |
| **Xem lý do, bằng chứng, so sánh** (người review proposal) | [`research/project-proposal.md`](./research/project-proposal.md) → [`research/result.md`](./research/result.md) (số đo thật) |
| **Viết mã hoặc làm agent** | [`../AGENTS.md`](../AGENTS.md) → [`spec/ScamShield-v1.md`](./spec/ScamShield-v1.md) → [`architecture/system-design.md`](./architecture/system-design.md) → thiết kế slice trong [`design/`](./design/) |
| **Chạy dự án** | [`runbook/setup-and-bringup.md`](./runbook/setup-and-bringup.md) |

## Mỗi file làm gì

Mỗi vai trò chỉ có **một** file chính. Cột "Cấp" là thứ tự ưu tiên khi các file lệch nhau (xem mục dưới).

**Giới thiệu và giải thích**

| File | Nội dung | Trạng thái | Cấp |
|---|---|---|---|
| [`product/pitch.md`](./product/pitch.md) | Sản phẩm là gì, ai dùng, ví dụ đầu vào → đầu ra, vì sao tin được, FAQ giám khảo | Bản nháp | 6 |
| [`onboarding/concepts.md`](./onboarding/concepts.md) | Từ điển và nhập môn: thủ đoạn lừa đảo, chỉ dấu, signal, verdict, kiểm URL, vai trò của AI, prompt injection, eval | Bản nháp | 6 |
| [`research/project-proposal.md`](./research/project-proposal.md) | Proposal có dẫn chứng: vấn đề, pain point, giải pháp hiện có, stakeholder, kết quả S2, rủi ro, nguồn tham khảo | Bản đề xuất để review (24/11) | 6 |

**Hành vi và kiến trúc (nguồn sự thật)**

| File | Nội dung | Trạng thái | Cấp |
|---|---|---|---|
| [`spec/ScamShield-v1.md`](./spec/ScamShield-v1.md) | **Hành vi:** nguyên tắc P1–P5, tính năng SO-01…SO-10, tiêu chí chấp nhận, quyết định Q-01…Q-11, danh sách thương hiệu (Phụ lục A) | Bản nháp; Q-01…Q-11 đã chốt | 1 |
| [`architecture/system-design.md`](./architecture/system-design.md) | **Kiến trúc:** modular monolith, triển khai, ranh giới module, truy cập dữ liệu; **§11 sơ đồ toàn hệ thống** | Bản nháp | 2 |
| [`architecture/contracts.md`](./architecture/contracts.md) | Hợp đồng dữ liệu: enum, chỉ dấu, signal, kết quả, hồ sơ, đầu ra LLM, mã lỗi | Bản nháp | 3 |
| [`architecture/api.md`](./architecture/api.md) | Endpoint công khai và FraudOps, ví dụ request/response, mã lỗi | Bản nháp | 3 |
| [`architecture/data-model.md`](./architecture/data-model.md) | Bảng P0, ràng buộc, giao dịch, quyền riêng tư, seed/reset, migration | **Đã duyệt 21/11** (DB-05 còn là đề xuất) | 3 |
| [`architecture/codebase.md`](./architecture/codebase.md) | Cây thư mục, phụ thuộc module, lệnh, test theo tầng | Bản nháp | 4 |
| [`conventions/`](./conventions/README.md) | Cách viết code chung, backend, frontend, hợp đồng dữ liệu; thư viện được phép | Bản nháp | 4 |

**Thiết kế từng slice và giao diện**

| File | Nội dung | Trạng thái | Cấp |
|---|---|---|---|
| [`design/analysis-pipeline.md`](./design/analysis-pipeline.md) | Slice S3: 6 bước phân tích, phép kiểm URL, quy tắc verdict, prompt | **Owner duyệt 24/11**; đã merge (PR #46), còn T-035; eval dev chạy 27/11 | 5 |
| [`design/scamshield-ui.md`](./design/scamshield-ui.md) | Slice S4: module và ranh giới client, state machine, phụ thuộc schema, bảng nhãn signal / mã detail, kiểm thử | **Owner duyệt 26/11**; T-040…T-042 đã merge (PR #48) | 5 |
| [`design/report-flow.md`](./design/report-flow.md) | Slice S5: route báo cáo, tóm tắt AI, mã bí mật, tra trạng thái không lộ hồ sơ, sửa state machine S4; che ghi chú (RP-06) | **Owner duyệt 26/11**; T-050…T-053 đã merge (PR #50, 27/11) | 5 |
| [`design/fraudops.md`](./design/fraudops.md) | Slice S6: kiểm phiên sát dữ liệu, đăng nhập/phiên/Origin, danh sách, chi tiết, kết luận và xung đột | **Owner duyệt 26/11**; T-060…T-063 xong ở local 28/11, chưa merge | 5 |
| [`design/related-cases.md`](./design/related-cases.md) | Slice S7 (P1): hồ sơ liên quan theo chỉ dấu chung, loại tên miền quá phổ biến, truy vấn, khối giao diện | **Owner duyệt 26/11**, chưa có mã | 5 |
| [`design/verified-indicators.md`](./design/verified-indicators.md) | Slice S8 (P1): ghi chỉ dấu khi xác nhận lừa đảo, engine dùng lại, gỡ có lý do, bảng `confirmed_indicators` | **Owner duyệt 26/11**, chưa có mã | 5 |
| [`design/demo-data.md`](./design/demo-data.md) | Slice S9: tin demo một nguồn, seed/reset một đường code, nội dung 24 case mẫu, E2E 6 bước | **Owner duyệt 26/11**, chưa có mã | 5 |
| [`design/eval-suite.md`](./design/eval-suite.md) | Slice S10: thành phần 80 câu, chia tập chống rò rỉ, runner gọi đúng pipeline, chỉ số B.3, đóng băng và chặn chạy held-out | **Owner duyệt 26/11**; có runner tập dev (một phần T-101) | 5 |
| [`design/submission.md`](./design/submission.md) | Slice S11: đường găng nộp bài, nội dung README/slide/A4/video, đóng gói zip có kiểm secret, giữ link sống | **Owner duyệt 26/11**, chưa có mã | 5 |
| [`design/model-spike.md`](./design/model-spike.md) | Slice S2: thử chọn model Groq | Đã cài đặt, đã merge (PR #4) | 5 |
| [`product/ui-pages.md`](./product/ui-pages.md) + [`design/pages.md`](./design/pages.md) | Trang, khối giao diện, trạng thái theo AC; wireframe, sơ đồ luồng, ma trận trang ↔ API | Bản nháp | 5 |
| [`product/design-system.md`](./product/design-system.md) | Token, component, pattern cho mọi UI | Bản nháp | 5 |

**Đo chất lượng**

| File | Nội dung | Trạng thái |
|---|---|---|
| [`research/result.md`](./research/result.md) | Thử model Q-08 (số đo 21–23/11); **định nghĩa chính thức** bộ eval SO-09: tập dev/held-out, định dạng câu, chỉ số, nhật ký chạy | Bản nháp; Q-08 chốt 22/11 |
| [`research/evaluation-protocol.md`](./research/evaluation-protocol.md) | Cách gán nhãn, chống leakage, ma trận test trước release, mẫu báo cáo | Hướng dẫn bổ sung cho result.md |
| [`research/dataset-catalog.md`](./research/dataset-catalog.md) | Dataset public nào dùng vào việc gì, số liệu đã kiểm, luật cho agent | Vai trò dataset chốt 24/11 (Q-11) |

**Kế hoạch và vận hành**

| File | Nội dung | Trạng thái |
|---|---|---|
| [`runbook/plan.md`](./runbook/plan.md) + [`tasks.csv`](./runbook/tasks.csv) | Lộ trình theo ngày, quyền của agent (§5), cắt việc khi trễ (§7), rủi ro, checklist nộp; 51 việc (S3–S11 theo dõi ở GitHub Issues #8–#45, label `role:A/B/C`) theo slice, cột `assignee` theo team-split | Bản nháp |
| [`runbook/team-split.md`](./runbook/team-split.md) | Phân công ba thành viên (vai A/B/C): việc từng người theo ngày, chỗ giao nhau, nhịp làm việc | Đề xuất 24/11, chưa điền tên |
| [`runbook/setup-and-bringup.md`](./runbook/setup-and-bringup.md) | Chạy local, Postgres Docker, đổi key, migration, deploy (owner), lỗi thường gặp | Bản nháp |
| [`runbook/demo.md`](./runbook/demo.md) | Kịch bản video 3 phút, dữ liệu demo, checklist, xử lý sự cố | Bản nháp |

## Khi các file lệch nhau

Thứ tự ưu tiên (cột "Cấp" ở trên):

1. `spec/ScamShield-v1.md` cho **hành vi**.
2. `architecture/system-design.md` cho **kiến trúc**.
3. `architecture/contracts.md`, `architecture/api.md`, `architecture/data-model.md` cho **hợp đồng dữ liệu, endpoint và bảng**. Riêng hình dạng chính xác của request/response thì zod schema trong `packages/shared` thắng.
4. `architecture/codebase.md` và `conventions/`.
5. `design/`, `product/ui-pages.md` và `product/design-system.md`.
6. `product/pitch.md`, `onboarding/concepts.md`, `research/project-proposal.md`. Đây là bản đơn giản hoá hoặc bản đề xuất, **không dùng làm spec**.

Tài liệu `research/` về eval và dataset không nằm trong thứ tự trên: chúng phải khớp spec SO-09 và các quyết định Q-08, Q-11. Giữa chúng với nhau, `research/result.md` Phần B thắng `research/evaluation-protocol.md`.

Phát hiện lệch mà thứ tự trên phân xử được thì sửa file cấp thấp cho khớp file cấp cao và báo owner trong bàn giao; không phân xử được (cùng cấp, hoặc cần đổi hành vi) thì **dừng và báo owner** ([AGENTS.md](../AGENTS.md)). Sửa tài liệu trước khi sửa code. Nguyên tắc P1–P5 ở spec §1 chỉ được đổi khi owner đồng ý.

Mỗi lần đổi mã, hợp đồng, quyết định hoặc trạng thái slice thì tài liệu phải được đồng bộ trong cùng nhánh. Danh sách việc cần rà nằm ở mục "Đồng bộ tài liệu" của [AGENTS.md](../AGENTS.md).

## Trạng thái

Cập nhật 28/11/2026 (S3 đã merge vào `main`, PR #46; runner eval dev đã merge, PR #47; S4 T-040…T-042 đã merge, PR #48; S5 đã merge, PR #50; T-060…T-063 xong ở local trên nhánh `feat/s6-auth`, PR nháp, chưa merge).

| Phần | Trạng thái |
|---|---|
| Nền móng + walking skeleton (monorepo, `/api/health`, trang skeleton, Postgres Docker, CI) | Đã merge (PR #2); `npm run verify` xanh ở local; **chưa deploy** |
| Dữ liệu P0 (schema 8 bảng, migration `0000_p0_tables`) | Đã merge (PR #3); migration chưa chạy trên DB deploy; chưa có seed/reset |
| S2 thử model ([design](./design/model-spike.md)) | Đã merge (PR #4): HTTP client có allowlist, client Groq, `extractSignals`, `writeExplanation`, runner `npm run eval:q08`, 20 câu dev nháp. Chạy Groq thật 21–23/11, số ở [research A.6](./research/result.md) |
| Proposal cho vòng loại | Đã merge (PR #5), bản đề xuất để review |
| S3 pipeline phân tích ([design](./design/analysis-pipeline.md)) | Đã merge (PR #46, 26/11), chưa deploy: T-031…T-034, T-036…T-038, T-045, route `POST /api/analyses`. `npm run verify` xanh, test tích hợp chạy trên Postgres tạm, gọi thử Groq thật ở local. Chưa làm: T-035 (P1). Eval tập dev đã chạy 27/11 (T-039, [research B.4](./research/result.md#b4-nhật-ký-chạy)): 15/20 câu trong nhãn, chỉ 26/60 lượt có giải thích; runner đã merge (PR #47). Trễ so với lịch 22–23/11 |
| S4 giao diện ScamShield ([design](./design/scamshield-ui.md)) | **Owner duyệt thiết kế 26/11** (U-01…U-06 theo đề xuất); T-040 (nền giao diện) xong 27/11; T-041 (trang `/`) xong 27/11 (owner chấp nhận điện thoại giả lập là đủ tạm thời, chưa thử trên máy thật); T-042 (khối kết quả) xong 27/11, còn phải xoá `/xem-truoc` trước 30/11; cả ba đã merge vào `main` (PR #48, 27/11), chưa deploy; trễ so với lịch 24–25/11; schema `AnalysisResult` đã có trên `main` (PR #46) |
| S5 báo cáo + tra trạng thái ([design](./design/report-flow.md)) | **Owner duyệt thiết kế 26/11** (RP-01…RP-05 theo đề xuất); T-050…T-053 đã merge vào `main` (PR #50, 27/11), chưa deploy; đã kiểm ở local 27/11 ([§13](./design/report-flow.md#13-kết-quả-kiểm-27112026)): tóm tắt AI thường thiếu khi Groq trả 429. Chỗ khác bản duyệt và RP-06: owner chốt 27/11 |
| S6 FraudOps ([design](./design/fraudops.md)) | **Owner duyệt thiết kế 26/11** (OP-01…OP-04 theo đề xuất); T-060…T-063 xong ở local 28/11 (nhánh `feat/s6-auth`, PR nháp, chưa merge, chưa deploy, [§11](./design/fraudops.md#11-ghi-chú-cài-đặt-28112026)) |
| S7 hồ sơ liên quan, P1 ([design](./design/related-cases.md)) | **Owner duyệt thiết kế 26/11** (ST-01, ST-02 theo đề xuất); chưa có mã; không cần migration |
| S8 chỉ dấu đã xác minh, P1 ([design](./design/verified-indicators.md)) | **Owner duyệt thiết kế 26/11** (XM-01, XM-02 theo đề xuất; XM-03: chưa cắt); chưa có mã; cần migration mới `0001_confirmed_indicators` |
| S9 dữ liệu demo, seed/reset, E2E ([design](./design/demo-data.md)) | **Owner duyệt thiết kế 26/11** (DM-01…DM-03 theo đề xuất; DM-04: một ngân hàng); chưa có mã; T-093 không bị chặn |
| Bộ eval SO-09 ([design S10](./design/eval-suite.md)) | 20/60–100 câu; held-out chưa tạo; dev chạy một lượt 27/11; **owner duyệt thiết kế S10 26/11** (EV-01…EV-05 theo đề xuất); có runner tối thiểu cho tập dev (một phần T-101, PR #47) |
| S11 nộp bài ([design](./design/submission.md)) | **Owner duyệt thiết kế 26/11** (NB-01…NB-03 theo đề xuất; NB-04: vai A); hạn nộp trước 03/12, mục tiêu 02/12 tối |

**Quyết định:** Q-01…Q-11 đã chốt (spec §7). Model chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b` (Q-08, 22/11). Danh sách thương hiệu Q-10 và vai trò dataset Q-11 chốt 24/11. D-01…D-03 đã chốt; D-04 (Supabase tạm dừng) còn chờ kiểm, xem system-design §9.
