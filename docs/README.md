# 📚 ScamShield Ops — Docs

Một sản phẩm chống lừa đảo với hai giao diện dùng chung một AI engine: **ScamShield** cho người dùng kiểm tra tin nhắn đáng ngờ, **FraudOps** cho nhân viên vận hành xử lý báo cáo thành hồ sơ điều tra. **AI đề xuất, con người quyết định.** MoMo Tech Talent 2026 · vòng loại nộp trước 03/12 · chung kết 11/12.

Docs viết bằng tiếng Việt; định danh kỹ thuật giữ tiếng Anh.

## Đọc theo thứ tự

| # | File | Nội dung | Trạng thái |
|---|---|---|---|
| 0 | [`onboarding/concepts.md`](./onboarding/concepts.md) | Nhập môn: đề bài, thủ đoạn lừa đảo, chỉ dấu, signal, verdict, kiểm URL, vai trò của AI, prompt injection, eval, hạ tầng | Bản nháp |
| 1 | [`product/pitch.md`](./product/pitch.md) | Sản phẩm là gì, vì sao Workspace-first, ví dụ Input→Output, FAQ giám khảo | Bản nháp |
| 2 | [`spec/ScamShield-v1.md`](./spec/ScamShield-v1.md) | **Nguồn sự thật về hành vi.** Nguyên tắc P1–P5, tính năng SO-01…SO-10, tiêu chí chấp nhận, quyết định Q-01…Q-10, kịch bản demo | **Bản nháp; Q-01…Q-10 đã chốt 20/11** |
| 3 | [`architecture/system-design.md`](./architecture/system-design.md) | **Nguồn sự thật về kiến trúc.** Modular monolith, triển khai, ranh giới module, truy cập dữ liệu, health. Thiết kế từng slice ở `design/` (pipeline: [`design/analysis-pipeline.md`](./design/analysis-pipeline.md); thử model S2: [`design/model-spike.md`](./design/model-spike.md)) | **Bản nháp** |
| 3b | [`architecture/data-model.md`](./architecture/data-model.md) | Bảng P0, ràng buộc, giao dịch, đồng thời, quyền riêng tư, seed/reset, kế hoạch migration | **Đã duyệt 21/11** (DB-05 còn là đề xuất) |
| 4 | [`architecture/api.md`](./architecture/api.md) | Endpoint công khai và FraudOps, ví dụ request/response, mã lỗi | Bản nháp |
| 5 | [`architecture/contracts.md`](./architecture/contracts.md) | Hợp đồng dữ liệu: enum, chỉ dấu, signal, kết quả, hồ sơ, đầu ra LLM, mã lỗi | Bản nháp |
| 6 | [`architecture/codebase.md`](./architecture/codebase.md) | Cây thư mục dự kiến, phụ thuộc module, lệnh, test theo tầng | Bản nháp |
| 7 | [`conventions/`](./conventions/README.md) | Cách viết code chung, backend, frontend, hợp đồng dữ liệu; thư viện được phép | Bản nháp |
| 8 | [`product/ui-pages.md`](./product/ui-pages.md) + [`design/pages.md`](./design/pages.md) | `ui-pages.md`: trang, khối giao diện, trạng thái theo AC. `design/pages.md`: wireframe từng trang, sơ đồ luồng, ma trận trang ↔ dữ liệu/API | Bản nháp |
| 9 | [`product/design-system.md`](./product/design-system.md) | Token, component, pattern cho mọi UI | Bản nháp |
| 10 | [`runbook/plan.md`](./runbook/plan.md) + [`tasks.csv`](./runbook/tasks.csv) | Mục tiêu, phạm vi, lộ trình theo ngày, quyền của agent, cắt việc, rủi ro, checklist nộp; tasks.csv: 48 việc theo slice, phụ thuộc, ngày, mức cắt | **Bản nháp** |
| 11 | [`runbook/setup-and-bringup.md`](./runbook/setup-and-bringup.md) | Chạy local, Postgres Docker, đổi key, migration, deploy (owner), lỗi thường gặp | Bản nháp |
| 12 | [`research/result.md`](./research/result.md) | Cách thử chọn model Groq (Q-08), định dạng và chỉ số bộ eval (SO-09), nhật ký kết quả | Bản nháp; A.6 có số liệu 21/11 và điểm tiếng Việt `explain-v3` 22/11, Q-08 đã chốt 22/11 |
| 12a | [`research/project-proposal.md`](./research/project-proposal.md) | Proposal có dẫn chứng: chủ đề, pain points, tài nguyên, giải pháp hiện hữu, stakeholders, kiến trúc/workflow; kết quả S2, giả thuyết và nguồn tham khảo | **Bản đề xuất để review, 24/11/2026** |
| 13 | [`runbook/demo.md`](./runbook/demo.md) | Kịch bản video 3 phút, dữ liệu demo, checklist, xử lý sự cố, giai đoạn chấm | Bản nháp |

## Khi các file lệch nhau

Thứ tự ưu tiên:

1. `spec/ScamShield-v1.md` cho **hành vi**.
2. `architecture/system-design.md` cho **kiến trúc**.
3. `architecture/contracts.md` và `architecture/api.md` cho **hợp đồng dữ liệu và endpoint**. Riêng hình dạng chính xác của request/response thì zod schema trong `packages/shared` thắng.
4. `architecture/codebase.md` và `conventions/`.
5. `product/ui-pages.md`, `design/` và `product/design-system.md`.
6. `product/pitch.md` và `onboarding/concepts.md`. Đây là bản đơn giản hoá, **không dùng làm spec**.

Phát hiện lệch mà thứ tự trên phân xử được thì sửa file cấp thấp cho khớp file cấp cao và báo owner trong bàn giao; không phân xử được (cùng cấp, hoặc cần đổi hành vi) thì **dừng và báo owner** ([AGENTS.md](../AGENTS.md)). Sửa tài liệu trước khi sửa code. Nguyên tắc P1–P5 ở spec §1 chỉ được đổi khi owner đồng ý.

Mỗi lần đổi mã, hợp đồng, quyết định hoặc trạng thái slice thì tài liệu phải được đồng bộ trong cùng nhánh. Danh sách việc cần rà nằm ở mục "Đồng bộ tài liệu" của [AGENTS.md](../AGENTS.md).

## Trạng thái

Giai đoạn **đặc tả, thiết kế và dựng nền** (24/11/2026): owner đã chốt Q-01…Q-10; spec v1, kế hoạch và thiết kế pipeline là bản nháp. Slice nền móng (PR #2) và slice dữ liệu P0 (schema 8 bảng, migration `0000_p0_tables`, PR #3) đã merge vào `main`; migration chưa chạy trên DB deploy. Slice S2 thử model ([design/model-spike](./design/model-spike.md)) đã merge vào `main` (PR #4, 23/11/2026): client HTTP có allowlist, client Groq, `extractSignals`, `writeExplanation`, runner `eval/`; test xanh ở local; đã chạy Groq thật 21/11 trên 3 model ([research A.6](./research/result.md)), owner chốt Q-08 22/11; sau review, prompt giải thích đã đổi sang `explain-v3` và đã chạy lại bước giải thích 22/11 (3 model; điểm tiếng Việt AI chấm, owner duyệt: qwen 2,75, gpt-oss-120b 2,40, gpt-oss-20b 1,95; cột còn lại của A.6 giữ số 21/11 vì tái dùng signal). Chưa có pipeline phân tích đầy đủ (S3), seed, FraudOps. D-01…D-03 đã chốt; D-04 còn chờ kiểm, xem system-design §9.
