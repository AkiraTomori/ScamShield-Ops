# ScamShield Ops — Agent Context

**Trạng thái (27/11/2026)** — chi tiết ở [docs/README.md § Trạng thái](docs/README.md#trạng-thái):
- **Đã merge vào `main`:** nền móng + walking skeleton (PR #2), schema 8 bảng P0 (PR #3), S2 thử model (PR #4), proposal cho vòng loại (PR #5), S3 pipeline (PR #46), runner eval tập dev (PR #47). `npm run verify` xanh ở local. **Chưa deploy**, migration chưa chạy trên DB deploy.
- **S3 pipeline phân tích** (owner duyệt [thiết kế](docs/design/analysis-pipeline.md) 24/11; T-031…T-039), cập nhật 27/11, đã merge vào `main` (PR #46, 26/11), chưa deploy: đã có mã cho T-031…T-034, T-036…T-038, T-045 và route `POST /api/analyses`. **Chưa làm:** T-035 (RDAP, Safe Browsing; P1). T-039 xong ở local 27/11: eval tập dev đã chạy ([research B.4](docs/research/result.md#b4-nhật-ký-chạy): 15/20 câu có verdict trong nhãn); runner (phần tối thiểu của T-101, owner đồng ý 27/11) đã merge vào `main` (PR #47, 27/11). S3 trễ so với lịch 22–23/11, owner chưa yêu cầu cắt việc. [Thiết kế §13](docs/design/analysis-pipeline.md#13-ghi-chú-cài-đặt-26112026) ghi các chỗ cài đặt khác bản duyệt, chờ owner xác nhận. **Rủi ro đã thấy khi chạy thật:** Groq gói đang dùng trả 429 khi gửi nhiều tin liên tiếp; ở eval 27/11 chỉ 26/60 lượt có giải thích.
- **Được viết mã (owner duyệt 26/11, nhận mọi phương án đề xuất):** S4 [giao diện ScamShield](docs/design/scamshield-ui.md), S5 [báo cáo](docs/design/report-flow.md), S6 [FraudOps](docs/design/fraudops.md), S7 [hồ sơ liên quan](docs/design/related-cases.md), S8 [chỉ dấu đã xác minh](docs/design/verified-indicators.md) (chưa cắt; xem lại P1 ngày 27/11), S9 [dữ liệu demo](docs/design/demo-data.md), S10 [eval](docs/design/eval-suite.md), S11 [nộp bài](docs/design/submission.md). Chưa có mã cho các slice này, trừ runner dev của S10 nói trên. Thứ tự phụ thuộc: S5, S10 runner dùng `analyzeMessage`/T-038 của S3 (đã có trên `main`); T-060, T-093, T-100 làm được ngay.
- **Quyết định:** Q-01…Q-11 đã chốt ([spec §7](docs/spec/ScamShield-v1.md#7-quyết-định-mở-owner-chốt)); model Groq chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b` (Q-08, số đo ở [research A.6](docs/research/result.md)). D-04 (Supabase tạm dừng) còn mở.
- **Hạn:** đóng băng tính năng 30/11; nộp vòng loại trước **03/12/2026**; chung kết 11/12 (slide không sửa được sau khi nộp).

**Mục tiêu:** một web app công khai giúp người dùng kiểm tra tin nhắn nghi lừa đảo, và giúp đội vận hành fintech biến báo cáo thành hồ sơ điều tra có bằng chứng. Giới thiệu ngắn: [docs/product/pitch.md](docs/product/pitch.md).

## Đọc trước khi làm bất cứ việc gì
1. [docs/README.md](docs/README.md): mục lục, thứ tự đọc, **thứ tự ưu tiên khi các file lệch nhau**.
2. [docs/spec/ScamShield-v1.md](docs/spec/ScamShield-v1.md): hành vi, nguyên tắc P1–P5 và tiêu chí chấp nhận `SO-xx-ACnn`. **Spec đã duyệt là quyền cao nhất về hành vi.**
3. [docs/architecture/system-design.md](docs/architecture/system-design.md): kiến trúc; sơ đồ toàn hệ thống ở §11.
4. [docs/conventions/](docs/conventions/README.md): cách viết code và thư viện được phép.
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
  - Hình dạng request/response và đầu ra của LLM: zod schema trong `packages/shared`. Không có tài liệu API viết tay lệch với schema.
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
| Ý tưởng còn mơ hồ, cần hỏi kỹ trước | `/sdlc:grill <ý tưởng>` | Tóm tắt quyết định đã chốt (ghi vào spec khi owner yêu cầu) |
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
| Bug khó, test chập chờn, chạy chậm | `/sdlc:diagnose <triệu chứng>` | Lệnh tái hiện + nguyên nhân; sửa khi owner cho phép |
| Chuyển việc sang phiên mới | `/sdlc:handoff <việc phiên sau>` | Tài liệu bàn giao ở thư mục tạm |

**Luồng gợi ý:**
- Ý tưởng mơ hồ: `grill` → `spec` → …
- Sửa bug: `diagnose` → `implement` (+`tdd`) → `verify` → `pr`.
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
- `npm run verify` xanh: format, lint, typecheck, Vitest.
- Mỗi tiêu chí chấp nhận của slice có test ghi ID `SO-xx-ACnn` hoặc một bước kiểm tay có bằng chứng.
- Thay đổi prompt hoặc quy tắc verdict thì chạy lại eval tập dev và ghi kết quả.
- Tài liệu đã đồng bộ với mã và quyết định (mục "Đồng bộ tài liệu").
- Báo đúng những gì **thật sự đã chạy**. Tách rõ kiểm tra local, kiểm tra trên bản deploy, và phần chưa kiểm.

## Ngôn ngữ
- Tài liệu, spec, mô tả PR, chữ trên UI: tiếng Việt.
- Mã, comment, commit (`type(scope): description`): tiếng Anh.
