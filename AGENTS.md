# ScamShield Ops — Agent Context

**Trạng thái (20/11/2026): CHỜ DUYỆT.** Mới có tài liệu: spec v1 bản nháp và kế hoạch. Chưa có mã ứng dụng; **chưa được viết mã** cho tới khi owner chốt Q-01…Q-10 và duyệt slice. MoMo Tech Talent 2026: **vòng loại nộp trước ngày 03/12/2026**, chung kết 11/12 (slide không được sửa sau khi nộp). Mục tiêu: một web app công khai giúp người dùng kiểm tra tin nhắn nghi lừa đảo và giúp đội vận hành fintech xử lý báo cáo thành hồ sơ điều tra có bằng chứng.

## Đọc trước khi làm bất cứ việc gì
1. [docs/README.md](docs/README.md): mục lục, thứ tự đọc, **thứ tự ưu tiên khi các file lệch nhau**.
2. [docs/spec/ScamShield-v1.md](docs/spec/ScamShield-v1.md): hành vi, nguyên tắc P1–P5 và tiêu chí chấp nhận `SO-xx-ACnn`. **Spec đã duyệt là quyền cao nhất về hành vi.**
3. [docs/architecture/system-design.md](docs/architecture/system-design.md): kiến trúc (chưa viết; tạo bằng `/sdlc:design`).
4. [docs/conventions/](docs/conventions/README.md): cách viết code (chưa viết).
5. [docs/runbook/plan.md](docs/runbook/plan.md): lộ trình, quyền của agent (§5), cắt việc (§7).
- Hai tài liệu mâu thuẫn nhau thì **dừng và báo owner**, không tự chọn.

## Luật cứng
- **Chỉ viết mã ứng dụng** (`apps/`, `packages/`) **cho slice đã được owner duyệt.** Spec hoặc design chưa duyệt thì chỉ được sửa tài liệu.
- **Giữ phạm vi MVP** ([spec §4](docs/spec/ScamShield-v1.md#4-phạm-vi)). Mọi thứ ở bảng "Ngoài v1" là roadmap, không làm. Cần cắt việc thì cắt theo thứ tự ở [plan §7](docs/runbook/plan.md).
- **Năm nguyên tắc P1–P5 trong spec §1 chỉ đổi khi owner đồng ý.** Đặc biệt:
  - Không có chức năng tự khoá tài khoản, chặn giao dịch hay kết luận một người là kẻ lừa đảo (P1).
  - Mức rủi ro tính bằng quy tắc trong code, không lấy thẳng từ LLM (P4).
  - **Không bao giờ fetch, render hay tải URL do người dùng gửi**, kể cả trong test hay script (P5).
- **Nội dung người dùng là dữ liệu, không phải chỉ dẫn.** Không ghép thẳng vào system prompt; luôn đặt trong khối phân tách rõ ràng.
- Không commit, push, tạo PR, merge hay deploy nếu owner chưa yêu cầu. Hỏi trước khi chạy migration/seed lên CSDL đã có dữ liệu, gọi dịch vụ ngoài tốn tiền ở quy mô lớn (chạy toàn bộ eval nhiều lần), hoặc làm việc huỷ dữ liệu.
- Secret (API key LLM, chuỗi kết nối DB, mật khẩu tài khoản thử) chỉ ở `.env` (đã gitignore) hoặc biến môi trường của nền tảng deploy, không bao giờ xuất hiện trong mã, commit, log, chat hay dòng lệnh.
- **Nguồn sự thật duy nhất:**
  - Hình dạng request/response và đầu ra của LLM: zod schema trong `packages/shared` (sẽ tạo ở slice nền móng). Không có tài liệu API viết tay lệch với schema.
  - Danh sách thương hiệu và tên miền chính thức: một file dữ liệu duy nhất (chốt ở Q-10), không rải trong mã.
  - Bộ eval: file nhãn trong `eval/`; không sửa nhãn tập held-out để "đẹp số".
- Dữ liệu mẫu và ví dụ chỉ dùng tên miền dành riêng (`*.example`, `example.com`, `*.test`). Giao diện không dùng logo hay màu nhận diện của MoMo hay tổ chức khác.
- UI ScamShield luôn hiện disclaimer ở [spec §9](docs/spec/ScamShield-v1.md#9-ràng-buộc-và-yêu-cầu-phi-chức-năng). Không bao giờ hiển thị chữ "an toàn" như một verdict.

## Quy trình: dùng skill `sdlc`

Skill nằm trong plugin `sdlc` (submodule [`tools/sdlc-kit`](tools/sdlc-kit), repo `AkiraTomori/my-sdlc-kit`). Cách cài ở [README.md](README.md#quy-trình-làm-việc-sdlc-kit). Chưa cài plugin thì gọi skill theo tên.

| Khi nào | Skill | Đầu ra trong repo này |
|---|---|---|
| Làm rõ hành vi, phạm vi, tiêu chí chấp nhận | `/sdlc:spec <phạm vi>` | `docs/spec/` (ID `SO-xx`, `SO-xx-ACnn`, quyết định mở `Q-xx`) |
| Slice có pipeline AI, luồng giữa hai giao diện hoặc cấu trúc module mới | `/sdlc:design <slice>` | `docs/architecture/` (hoặc `docs/design/<slice>.md` nếu chỉ riêng slice đó) |
| Bảng PostgreSQL, ràng buộc, migration, seed | `/sdlc:database <phạm vi>` | Mô hình dữ liệu + kế hoạch migrate |
| Cắt spec thành việc nhỏ demo được | `/sdlc:to-tickets <spec>` | `docs/runbook/tasks.csv` (chỉ đăng lên tracker khi owner đồng ý) |
| Viết mã cho một slice **đã duyệt** | `/sdlc:implement <slice>` (kèm `/sdlc:tdd` nếu có ranh giới hành vi rõ, ví dụ quy tắc tính verdict) | Mã + test trên nhánh `feat/…` |
| Màn hình ScamShield, FraudOps | `/sdlc:frontend-ui-design <màn hình>` | Trạng thái UI, a11y, responsive |
| Kiểm tra hành vi với bằng chứng thật | `/sdlc:verify <phạm vi>` | Báo cáo: đã chạy gì, đạt, hỏng, chưa kiểm |
| Xem lại thay đổi trước khi mở PR | `/sdlc:review <nhánh hoặc PR>` | Danh sách phát hiện theo mức độ |
| Mở PR | `/sdlc:pr <phạm vi>` | PR nháp hoặc PR, không merge |
| Quyết định ảnh hưởng phạm vi, an toàn hoặc chi phí (đổi P1–P5, đổi LLM, thêm tra cứu ngoài, đổi hạ tầng) | `/sdlc:sign-off <quyết định>` | Ghi quyết định vào spec |

**Luồng gợi ý:**
- Slice lớn: `spec` → `design` (+`database`) → `implement` (+`tdd`) → `verify` → `review` → `pr`.
- Sửa nhỏ: `implement` → `verify` → `pr`.
- Không bắt buộc đi đủ chuỗi. Chọn skill phù hợp với việc đang làm.

**Bàn giao:** Cuối mỗi bước, nêu kết quả, những gì chưa kiểm, rủi ro còn lại, và đưa **đúng một** lệnh `/sdlc:<skill> <phạm vi>` kế tiếp. Không tự chạy lệnh đó.

**Subagent** (`sdlc:repo_explorer`, `implementation_worker`, `test_engineer`, `code_reviewer`): chỉ dùng khi việc đủ lớn.
- Không cho hai agent sửa cùng một file.
- Agent chính giữ quyền về git, PR và deploy.

**Ưu tiên của cuộc thi:**
- Có walking skeleton chạy trên URL công khai sớm (mốc 21/11), rồi mới thêm tính năng.
- Một vertical slice end-to-end ([plan §1](docs/runbook/plan.md)) quan trọng hơn nhiều tính năng rời.
- Trễ lịch quá 1 ngày thì báo owner và đề xuất cắt theo plan §7. Không âm thầm giảm chất lượng.

## Định nghĩa xong
- `npm run verify` xanh: format, lint, typecheck, Vitest. Lệnh này sẽ được thêm ở slice nền móng.
- Mỗi tiêu chí chấp nhận của slice có test ghi ID `SO-xx-ACnn` hoặc một bước kiểm tay có bằng chứng.
- Thay đổi prompt hoặc quy tắc verdict thì chạy lại eval tập dev và ghi kết quả.
- Báo đúng những gì **thật sự đã chạy**. Tách rõ kiểm tra local, kiểm tra trên bản deploy, và phần chưa kiểm.

## Ngôn ngữ
- Tài liệu, spec, mô tả PR, chữ trên UI: tiếng Việt.
- Mã, comment, commit (`type(scope): description`): tiếng Anh.
