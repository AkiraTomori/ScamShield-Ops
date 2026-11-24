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
| [`design/analysis-pipeline.md`](./design/analysis-pipeline.md) | Slice S3: 6 bước phân tích, phép kiểm URL, quy tắc verdict, prompt | **Owner duyệt 24/11**, chưa có mã | 5 |
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
| [`runbook/plan.md`](./runbook/plan.md) + [`tasks.csv`](./runbook/tasks.csv) | Lộ trình theo ngày, quyền của agent (§5), cắt việc khi trễ (§7), rủi ro, checklist nộp; 48 việc theo slice | Bản nháp |
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

Cập nhật 24/11/2026.

| Phần | Trạng thái |
|---|---|
| Nền móng + walking skeleton (monorepo, `/api/health`, trang skeleton, Postgres Docker, CI) | Đã merge (PR #2); `npm run verify` xanh ở local; **chưa deploy** |
| Dữ liệu P0 (schema 8 bảng, migration `0000_p0_tables`) | Đã merge (PR #3); migration chưa chạy trên DB deploy; chưa có seed/reset |
| S2 thử model ([design](./design/model-spike.md)) | Đã merge (PR #4): HTTP client có allowlist, client Groq, `extractSignals`, `writeExplanation`, runner `npm run eval:q08`, 20 câu dev nháp. Chạy Groq thật 21–23/11, số ở [research A.6](./research/result.md) |
| Proposal cho vòng loại | Đã merge (PR #5), bản đề xuất để review |
| S3 pipeline phân tích ([design](./design/analysis-pipeline.md)) | Owner duyệt thiết kế 24/11, **chưa có mã**; trễ so với lịch 22–23/11, owner chưa yêu cầu cắt việc |
| Giao diện ScamShield, báo cáo, FraudOps, seed | Chưa làm |
| Bộ eval SO-09 | 20/60–100 câu; held-out chưa tạo |

**Quyết định:** Q-01…Q-11 đã chốt (spec §7). Model chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b` (Q-08, 22/11). Danh sách thương hiệu Q-10 và vai trò dataset Q-11 chốt 24/11. D-01…D-03 đã chốt; D-04 (Supabase tạm dừng) còn chờ kiểm, xem system-design §9.
