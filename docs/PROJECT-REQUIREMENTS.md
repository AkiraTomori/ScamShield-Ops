# ScamShield Ops — Project Requirements Overview

**Trạng thái:** Bản tổng hợp phục vụ review (24/11/2026), **không thay thế** [Product Spec](spec/ScamShield-v1.md). Nếu có mâu thuẫn, spec và [nguồn sự thật](README.md#khi-các-file-lệch-nhau) được ưu tiên. Không tạo requirements mới bằng tài liệu này.

## 1. Mục đích và giá trị

**Bối cảnh:** MoMo Tech Talent 2026, *Imagine the Future Workspace (Human Centered. AI Powered)*; sản phẩm lai **Chống lừa đảo + Trợ lý AI**. **Định vị đã chốt Q-01:** Workspace-first. ScamShield cho người dùng kiểm tra văn bản đáng ngờ; FraudOps là workspace nơi analyst nhận hồ sơ AI chuẩn bị và quyết định cuối. Một AI Risk Engine phục vụ hai giao diện [Spec §1–2](spec/ScamShield-v1.md) và [Proposal](research/project-proposal.md).

**Giả thuyết giá trị** (chưa đo mức tiết kiệm thời gian): chuẩn hóa tín hiệu/bằng chứng có thể làm quá trình tiếp nhận–xem xét báo cáo nhất quán hơn. Không quảng bá hiệu quả điều tra đã được kiểm chứng khi chưa có thử nghiệm.

## 2. Stakeholders, tác vụ, quyền hạn

| Ai | Tác vụ cần hỗ trợ | Phạm vi quyền hiện tại |
|---|---|---|
| Người dùng ScamShield (primary) | Dán văn bản; xem verdict, signal, khuyến nghị; chủ động gửi report; tra trạng thái | Không cần đăng nhập để phân tích; không xem case nội bộ |
| Fraud Analyst (primary) | Đăng nhập; đọc case, bằng chứng và tóm tắt AI; kết luận kèm lý do | Quyết định và đóng case, kể cả khi khác verdict của AI |
| Owner/Admin (operations) | Cấu hình, seed/reset demo, tài khoản giám khảo | Quy trình quản trị/deploy theo charter |
| Fintech Risk/Compliance (secondary) | Minh bạch nguồn đánh giá, bảo vệ dữ liệu, lịch sử quyết định | Chưa có UI riêng |
| Team Lead (roadmap) | Phân công, SLA, review nhiều cấp | **Ngoài MVP** |
| Giám khảo | Tự thử hai giao diện, dùng tài khoản demo | Không dùng dữ liệu/giao dịch thật |

## 3. Functional requirements và traceability

| Nhóm | Hành vi tối thiểu | Spec/AC làm nguồn sự thật | Ưu tiên |
|---|---|---|---|
| Input | Kiểm tra giới hạn 2.000 ký tự, rate limit, che OTP/mật khẩu/số thẻ | SO-01 | P0 |
| Indicators | Trích URL, tên miền, SĐT, tài khoản; kiểm URL **không mở trang**; metadata lỗi = unavailable | SO-02 | P0 (tra cứu ngoài có thứ tự cắt theo plan) |
| Risk explanation | LLM trích signal, quy tắc trong code tạo verdict, kết quả bám bằng chứng, khuyến nghị và inconclusive | SO-03 | P0 |
| Reports | Người dùng gửi report; mỗi analysis nhiều nhất một case; tra bằng mã và mã bí mật | SO-04 | P0 (tra trạng thái có thể cắt theo plan) |
| FraudOps evidence | Hiện nội dung đã che, signal nguồn, indicator checks, tóm tắt AI và bước tiếp theo | SO-05 | P0 |
| Decisions | Auth, danh sách case; analyst chọn kết luận và lý do; case đóng và lưu bền | SO-06 | P0 |
| Related cases | Liên kết case theo indicator | SO-07 | P1, cắt khi trễ |
| Verified indicators | Chỉ dấu được xác minh quay lại engine | SO-08 | P1, cắt đầu tiên |
| Evaluation | 60–100 tình huống, dev/held-out, 3 lần/case, chỉ số đầy đủ | SO-09 | P0 |
| Judge access | Link public, tài khoản thử, seed/reset demo và mẫu tin | SO-10 | P0 |

**Không trong MVP:** OCR, voice/call monitoring, open-URL browser/sandbox, realtime transaction fraud, MoMo/bank API thật, AI agent tự quyết, multi-agent, assignment/SLA/duyệt nhiều cấp [Spec §4](spec/ScamShield-v1.md).

## 4. Business rules và safety invariants

- **P1 Human decision:** AI chỉ đề xuất; không tự khóa ví, chặn giao dịch hoặc kết luận kẻ lừa đảo.
- **P2 Evidence-grounded:** signal ghi rõ `deterministic` hoặc `ai`; explanation không nói sự kiện ngoài evidence.
- **P3 Uncertainty:** không nói “an toàn”; `no_signal` ≠ safe; thiếu thông tin → `inconclusive`.
- **P4 Deterministic verdict:** rule engine tạo verdict; LLM không tự quyết score.
- **P5 No URL visit:** không gọi tới URL do người dùng cung cấp, kể cả khi evaluation.
- Input là **untrusted data** (chống prompt injection); model hỏng/429/timeout phải có xử lý, không suy ra “sạch”.
- `cases.analysis_id` là UNIQUE và quyết định được ghi cùng dấu vết người/thời điểm; tham chiếu [Data Model](architecture/data-model.md).

## 5. Non-functional requirements từ spec

| Chiều | Mục tiêu/ràng buộc đã có |
|---|---|
| Latency | p95 phân tích ≤10 giây; deadline tối đa 20 giây và fallback theo SO-03 |
| Availability | Website dùng được từ 03/12 đến hết 11/12 (mục tiêu demo) |
| Security | Secrets chỉ ở env; che dữ liệu nạn nhân trước DB/LLM; auth ở FraudOps; hạn chế PII log |
| Device & language | ScamShield tiếng Việt, mobile ≥360px; FraudOps desktop-first |
| Reliability | Rate limit 10 lượt/phút/IP, tối đa 2.000 ký tự; fallback API/LLM và schema validation |
| Explainability | Nguồn signal, check status và các verdict minh bạch; disclaimer luôn hiện |
| Testability | Vitest, Playwright/E2E, bộ eval và kết quả gắn commit/prompt/rules version |

Không biến những mục tiêu trên thành tuyên bố đã đạt trước khi có kết quả chạy thực tế.

## 6. Definition of Done để nộp

1. Người dùng mở link công khai, dán tin, thấy verdict + evidence và khuyến nghị.
2. Gửi report tạo case; analyst đăng nhập, xem cùng case, kết luận + lý do.
3. Reload không mất analysis/case/decision; secrets/PII xử lý theo đặc tả.
4. Có eval chạy trên full pipeline, file kết quả và ghi rõ giới hạn; không sao chép số Q-08 signal thành precision tổng.
5. Có seed 20–40 case, 3–5 tài khoản demo, tin mẫu; hướng dẫn A4, source ZIP + README, slide ≤10 trang, video ≤3 phút.
6. Trước 03/12 kiểm link và file nộp; feature freeze kế hoạch 30/11. Chi tiết/ưu tiên cắt ở [Runbook](runbook/plan.md).

## 7. Những điều cần xác minh, không chặn S3

**Đã có:** PR nền móng #2, schema DB #3, S2 model spike #4 được merge; các phép thử Q-08 trong [Research](research/result.md). **Chưa có bằng chứng:** full pipeline public, đánh giá held-out, reduction in analyst handling time, dữ liệu sản xuất. D-04 (Supabase free pause), giới hạn function, giá/hạn mức Groq, danh sách thương hiệu Q-10 cần xác thực trong nguồn chính thức.

**Đề xuất phương thức làm việc nhóm 3 người:** AI/Risk/Eval; Frontend/UX; Backend/Data/Integration. Phân công này chưa phải quyết định nhân sự, các thay đổi sản phẩm vẫn do owner chốt.

**Đọc tiếp:** [Proposal](research/project-proposal.md) → [Architecture overview](architecture/ARCHITECTURE.md) → [Product Spec](spec/ScamShield-v1.md) → [Data/Eval protocol](research/evaluation-protocol.md).
