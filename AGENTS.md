# ScamShield Ops — Agent Context

**Trạng thái (22/11/2026): ĐANG LÀM SLICE S2 THỬ MODEL** (nhánh `feat/model-spike`, chưa commit, chưa merge). Slice nền móng + walking skeleton (system-design §1–§8: monorepo, `/api/health`, trang skeleton, Postgres local bằng Docker, CI) đã merge vào `main` (PR #2), `npm run verify` xanh ở local; chưa deploy. Slice dữ liệu P0 (schema Drizzle 8 bảng + migration `0000_p0_tables`) đã merge vào `main` (PR #3); chưa chạy trên DB deploy, chưa có seed/reset. Slice S2 (owner yêu cầu `/sdlc:implement` ngày 21/11, design [model-spike](docs/design/model-spike.md)): `packages/core/src/http` + `llm` (client Groq, `extractSignals`, `writeExplanation`), `eval/` (runner `npm run eval:q08`, chấm điểm, 20 câu dev **nháp**); `npm run verify` xanh ở local; đã chạy Groq thật ngày 21/11 trên 3 model (số ở research A.6); owner chốt Q-08 ngày 22/11: `qwen/qwen3.8-27b` chính, `openai/gpt-oss-120b` dự phòng. Sau review 22/11: prompt giải thích đổi `explain-v2` → `explain-v3` (bộ lọc chặn thêm `đảm bảo/bảo đảm/tuyệt đối`; đã chạy lại bước giải thích 22/11 trên 3 model, signal tái dùng từ `explain-v2`; điểm tiếng Việt AI chấm, owner duyệt: qwen 2,75 đạt, gpt-oss-120b 2,40 dưới ngưỡng A.5 nhưng owner giữ làm dự phòng, chấp nhận rủi ro (22/11), gpt-oss-20b 1,95; số ở research A.6), `stripDelimiters` lặp tới khi ổn định, bảng chấm tiếng Việt không bị ghi đè. **Chưa được viết mã** cho phần còn lại (pipeline phân tích S3, seed, FraudOps) cho tới khi owner duyệt slice tương ứng. Owner đã chốt Q-01…Q-10 (spec §7; còn mở danh sách Q-10). D-04 (Supabase tạm dừng) vẫn mở. MoMo Tech Talent 2026: **vòng loại nộp trước ngày 03/12/2026**, chung kết 11/12 (slide không được sửa sau khi nộp). Mục tiêu: một web app công khai giúp người dùng kiểm tra tin nhắn nghi lừa đảo và giúp đội vận hành fintech xử lý báo cáo thành hồ sơ điều tra có bằng chứng.

## Đọc trước khi làm bất cứ việc gì
1. [docs/README.md](docs/README.md): mục lục, thứ tự đọc, **thứ tự ưu tiên khi các file lệch nhau**.
2. [docs/spec/ScamShield-v1.md](docs/spec/ScamShield-v1.md): hành vi, nguyên tắc P1–P5 và tiêu chí chấp nhận `SO-xx-ACnn`. **Spec đã duyệt là quyền cao nhất về hành vi.**
3. [docs/architecture/system-design.md](docs/architecture/system-design.md): kiến trúc (chưa viết; tạo bằng `/sdlc:design`).
4. [docs/conventions/](docs/conventions/README.md): cách viết code (chưa viết).
5. [docs/runbook/plan.md](docs/runbook/plan.md): lộ trình, quyền của agent (§5), cắt việc (§7).
- Hai tài liệu mâu thuẫn nhau mà thứ tự ưu tiên ở README không phân xử được thì **dừng và báo owner**, không tự chọn. Phân xử được (file cấp thấp lạc hậu so với file cấp cao) thì sửa theo mục "Đồng bộ tài liệu" bên dưới.

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

## Đồng bộ tài liệu (tự động, làm trong cùng nhánh)
Mỗi khi đổi mã (`apps/`, `packages/`), đổi hợp đồng dữ liệu, ghi nhận quyết định của owner hoặc đổi trạng thái slice, **tự rà và sửa tài liệu liên quan trước khi bàn giao**, không chờ owner nhắc:
1. **Dòng "Trạng thái (ngày)"** ở AGENTS.md, `docs/README.md` (mục Trạng thái và cột trạng thái) và đầu file tài liệu bị ảnh hưởng: ngày, nhánh, đã merge/deploy hay chưa.
2. **Hợp đồng:** đổi schema, enum, trường, mã lỗi thì sửa `contracts.md`, `api.md` (kể cả ví dụ JSON), `data-model.md`. Đổi tên thì `grep` tên cũ trên `docs/`, `packages/`, `apps/`.
3. **Cấu trúc:** thêm thư mục, module, lệnh hoặc biến môi trường thì sửa `codebase.md`, `setup-and-bringup.md`, `.env.example`.
4. **Tiến độ:** việc xong hoặc đang làm thì sửa cột `status` trong `docs/runbook/tasks.csv` và `docs/runbook/plan.md` §3. Giữ nguyên kiểu xuống dòng của file (`tasks.csv` dùng CRLF).
5. **Quyết định:** ghi vào bảng Q/D/DB/P/A tương ứng, kèm ngày owner chốt.

Khi phát hiện hai tài liệu lệch nhau:
- **Phân xử được theo thứ tự ưu tiên** ở [docs/README.md](docs/README.md): sửa file cấp thấp cho khớp file cấp cao, và nêu trong bàn giao.
- **Cùng cấp, hoặc cần đổi hành vi, P1–P5, phạm vi:** dừng và báo owner.
- Không tự ghi "đã duyệt" hay "xong" khi chưa có bằng chứng (ví dụ test chưa chạy thì ghi "chưa chạy"). Không tự sửa quyết định đã chốt.
- Có hook nhắc trong `.claude/settings.json` khi mã đổi mà tài liệu không đổi; hook chỉ nhắc, không thay việc rà này.

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

**Bàn giao:** Cuối mỗi bước, nêu kết quả, **tài liệu đã đồng bộ**, những gì chưa kiểm, rủi ro còn lại, và đưa **đúng một** lệnh `/sdlc:<skill> <phạm vi>` kế tiếp. Không tự chạy lệnh đó.

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
- Tài liệu đã đồng bộ với mã và quyết định (mục "Đồng bộ tài liệu").
- Báo đúng những gì **thật sự đã chạy**. Tách rõ kiểm tra local, kiểm tra trên bản deploy, và phần chưa kiểm.

## Ngôn ngữ
- Tài liệu, spec, mô tả PR, chữ trên UI: tiếng Việt.
- Mã, comment, commit (`type(scope): description`): tiếng Anh.
