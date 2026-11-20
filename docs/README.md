# 📚 ScamShield Ops — Docs

Một sản phẩm chống lừa đảo với hai giao diện dùng chung một AI engine: **ScamShield** cho người dùng kiểm tra tin nhắn đáng ngờ, **FraudOps** cho nhân viên vận hành xử lý báo cáo thành hồ sơ điều tra. **AI đề xuất, con người quyết định.** MoMo Tech Talent 2026 · vòng loại nộp trước 03/12 · chung kết 11/12.

Docs viết bằng tiếng Việt; định danh kỹ thuật giữ tiếng Anh.

## Đọc theo thứ tự

| # | File | Nội dung | Trạng thái |
|---|---|---|---|
| 0 | [`onboarding/concepts.md`](./onboarding/concepts.md) | Nhập môn: đề bài, thủ đoạn lừa đảo, chỉ dấu, signal, verdict, kiểm URL, vai trò của AI, prompt injection, eval, hạ tầng | Bản nháp |
| 1 | [`product/pitch.md`](./product/pitch.md) | Sản phẩm là gì, vì sao Workspace-first, ví dụ Input→Output, FAQ giám khảo | Bản nháp |
| 2 | [`spec/ScamShield-v1.md`](./spec/ScamShield-v1.md) | **Nguồn sự thật về hành vi.** Nguyên tắc P1–P5, tính năng SO-01…SO-10, tiêu chí chấp nhận, quyết định Q-01…Q-10, kịch bản demo | **Bản nháp; Q-01…Q-10 đã chốt 20/11** |
| 3 | [`architecture/system-design.md`](./architecture/system-design.md) | **Nguồn sự thật về kiến trúc.** Modular monolith, pipeline 6 bước, quy tắc verdict, data model, mối đe doạ | **Bản nháp:** mới có slice nền móng |
| 4 | [`architecture/api.md`](./architecture/api.md) | Endpoint công khai và FraudOps, ví dụ request/response, mã lỗi | Bản nháp |
| 5 | [`architecture/contracts.md`](./architecture/contracts.md) | Hợp đồng dữ liệu: enum, chỉ dấu, signal, kết quả, hồ sơ, đầu ra LLM, mã lỗi | Bản nháp |
| 6 | [`architecture/codebase.md`](./architecture/codebase.md) | Cây thư mục dự kiến, phụ thuộc module, lệnh, test theo tầng | Bản nháp |
| 7 | [`conventions/`](./conventions/README.md) | Cách viết code chung, backend, frontend, hợp đồng dữ liệu; thư viện được phép | Bản nháp |
| 8 | [`product/ui-pages.md`](./product/ui-pages.md) + [`design/pages.md`](./design/pages.md) | `ui-pages.md`: trang, khối giao diện, trạng thái theo AC. `design/pages.md`: wireframe từng trang, sơ đồ luồng, ma trận trang ↔ dữ liệu/API | Bản nháp |
| 9 | [`product/design-system.md`](./product/design-system.md) | Token, component, pattern cho mọi UI | Bản nháp |
| 10 | [`runbook/plan.md`](./runbook/plan.md) + [`tasks.csv`](./runbook/tasks.csv) | Mục tiêu, phạm vi, lộ trình theo ngày, quyền của agent, cắt việc, rủi ro, checklist nộp | **Bản nháp** |
| 11 | [`runbook/setup-and-bringup.md`](./runbook/setup-and-bringup.md) | Env, thứ tự bring-up, lỗi thường gặp | Chưa viết |
| 12 | [`research/result.md`](./research/result.md) | Cách thử chọn model Groq (Q-08), định dạng và chỉ số bộ eval (SO-09), nhật ký kết quả | Bản nháp, chưa có số liệu |
| 13 | [`runbook/demo.md`](./runbook/demo.md) | Kịch bản video 3 phút, checklist trước khi quay, xử lý sự cố | Chưa viết |

## Khi các file lệch nhau

Thứ tự ưu tiên:

1. `spec/ScamShield-v1.md` cho **hành vi**.
2. `architecture/system-design.md` cho **kiến trúc**.
3. `architecture/contracts.md` và `architecture/api.md` cho **hợp đồng dữ liệu và endpoint**. Riêng hình dạng chính xác của request/response thì zod schema trong `packages/shared` thắng.
4. `architecture/codebase.md` và `conventions/`.
5. `product/ui-pages.md`, `design/` và `product/design-system.md`.
6. `product/pitch.md` và `onboarding/concepts.md`. Đây là bản đơn giản hoá, **không dùng làm spec**.

Phát hiện lệch thì **dừng và báo owner** ([AGENTS.md](../AGENTS.md)), rồi sửa tài liệu trước khi sửa code. Nguyên tắc P1–P5 ở spec §1 chỉ được đổi khi owner đồng ý.

## Trạng thái

Giai đoạn **đặc tả và thiết kế** (20/11/2026): owner đã chốt Q-01…Q-10; spec v1, kế hoạch và thiết kế slice nền móng là bản nháp. Chưa có mã ứng dụng; D-01…D-03 đã chốt; slice nền móng đã được owner yêu cầu triển khai (20/11, nhánh `feat/foundation`, chưa merge; chỉ phạm vi §1–§8, không gồm pipeline hay bảng nghiệp vụ). D-04 còn chờ kiểm, xem system-design §9.
