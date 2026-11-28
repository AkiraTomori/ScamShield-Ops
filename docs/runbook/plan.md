# Kế hoạch ScamShield Ops (v1)

> MoMo Tech Talent 2026 · Chủ đề **Imagine the Future Workspace (Human Centered. AI Powered)** · Nhóm chủ đề: **Chống lừa đảo**, **Trợ lý AI**
> Vòng loại 20/11 – **03/12/2026** · AWS Training 25/11 · Chung kết **11/12/2026** · TypeScript, Next.js, Node.js, PostgreSQL
>
> File này chỉ gồm **mục tiêu, phạm vi, lộ trình, cắt việc, rủi ro, checklist nộp**. Hành vi ở [`../spec/ScamShield-v1.md`](../spec/ScamShield-v1.md); kiến trúc sẽ ở [`../architecture/system-design.md`](../architecture/system-design.md). Task chi tiết sẽ ở [`tasks.csv`](./tasks.csv) (sinh bằng `/sdlc:to-tickets`).

## 1. Mục tiêu

- **Nộp đủ 4 thành phần trước 03/12** (§9): hướng dẫn 1 trang A4 (PDF), mã nguồn `.zip` + README, slide ≤ 10 trang (PDF), video ≤ 3 phút (MP4).
- **Một vertical slice hoàn chỉnh.** Một giám khảo chưa từng dùng hệ thống phải làm được:
  1. Mở website công khai và nhập một tin nhắn đáng ngờ.
  2. Nhận kết quả phân tích có giải thích và bằng chứng.
  3. Gửi báo cáo thành công.
  4. Đăng nhập FraudOps bằng tài khoản thử.
  5. Tìm đúng báo cáo vừa gửi, xem kết quả AI và đưa ra kết luận.
  6. Tải lại trang mà dữ liệu, kết luận và trạng thái vẫn còn.
- **Có số liệu kiểm chứng** từ bộ eval (SO-09), không chỉ vài ví dụ đẹp trong video.
- **Link không chết** từ 03/12 đến hết 11/12.

## 2. Phạm vi MVP (chốt, không mở rộng)

| Có trong MVP | Để sau (chỉ nhắc trong slide "Roadmap") |
|---|---|
| Phân tích tin nhắn văn bản (SO-01, SO-03) | OCR ảnh chụp màn hình |
| URL dưới dạng chuỗi và metadata, không mở trang (SO-02) | Sandbox mở URL, phân tích nội dung trang |
| Gửi báo cáo, case management đơn giản (SO-04…SO-06) | Phân công, SLA, nhiều cấp duyệt |
| Tóm tắt điều tra do LLM tạo (SO-05) | Multi-agent investigation |
| *(Q-02, mức P1)* Liên kết case theo chỉ dấu, vòng phản hồi chỉ dấu đã xác minh (SO-07, SO-08) | Đồ thị chiến dịch lừa đảo, chia sẻ chỉ dấu giữa các tổ chức |
| Bộ eval 60–100 tình huống (SO-09) | Benchmark lớn, học từ dữ liệu thật |
| Seed và tài khoản thử cho giám khảo (SO-10) | Đăng ký tài khoản, SSO |
| — | Cuộc gọi/giọng nói, giám sát giao dịch, tích hợp API ngân hàng/MoMo, tự khoá tài khoản, dashboard thống kê phức tạp |

## 3. Hiện trạng (27/11)

- **Tài liệu:** spec, system-design, api, contracts, codebase, conventions, product, design, research, onboarding đều đã có bản nháp. Owner đã chốt Q-01…Q-10 (danh sách Phụ lục A của Q-10 và Q-11 vai trò dataset SO-09 chốt 24/11; Q-08 đã chốt 22/11), D-01…D-03, O-01…O-03, O-05, A-01, A-02, C-01.
- **Mã:** slice nền móng đã merge vào `main` (PR #2). Slice dữ liệu P0 (schema 8 bảng + migration `0000_p0_tables`) đã merge vào `main` (PR #3); test tích hợp trên Postgres local đã chạy xanh ngày 21/11 (12 file, 77 test, không test nào bị bỏ qua; owner chạy tay), gồm CHECK `analyses_inconclusive_has_reason`. Chưa deploy, nên mốc walking skeleton (URL công khai + `/api/health`) chưa đạt.
- **S2 thử model (đã merge vào `main`, PR #4, 24/11/2026):** đã có client HTTP allowlist, client Groq, `extractSignals`, `writeExplanation`, runner `npm run eval:q08` và 20 câu dev nháp; test xanh ở local; **đã chạy Groq thật 21/11** trên 3 model (research A.6): owner chốt Q-08 22/11: chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b`; còn nhập giá. Sau review 22/11: prompt giải thích `explain-v3`, đã chạy lại bước giải thích 22/11 và có điểm tiếng Việt (AI chấm, owner duyệt; gpt-oss-120b dưới ngưỡng A.5, owner giữ làm dự phòng 22/11, chấp nhận rủi ro; xem A.6/A.7), `stripDelimiters` lặp, bảng chấm không bị ghi đè; 22/11: `SIGNALS_MAX_TOKENS` 1200, mục `truncated` trong kết quả (đã đo lại qwen 23/11, 5/60 lượt còn lỗi 429; xem A.6).
- **Thiết kế S4–S11 (26/11/2026):** owner duyệt cả 8 slice, nhận mọi phương án đề xuất (U-, RP-, OP-, ST-, XM-, DM-, EV-, NB-); chưa cắt P1 nào, xem lại ngày 27/11. Chưa có mã cho các slice này, trừ S4 (T-040…T-042, xem dưới), S5 (T-050…T-053, xem dưới), S6 (T-060…T-063, xem dưới) và runner eval tập dev của S10 (27/11).
- **S3 pipeline (27/11, đã merge vào `main` (PR #46, 26/11), chưa deploy):** T-031…T-034, T-036…T-038 xong ở local; T-045 xong (owner xác nhận 27/11 đã báo cả nhóm); T-039 xong ở local 27/11: route đã có, eval tập dev đã chạy (research B.4: 15/20 câu có verdict trong nhãn; 26/60 lượt có giải thích), runner đã merge vào `main` (PR #47, 27/11) (phần tối thiểu của T-101, owner đồng ý 27/11; báo vai A để khỏi làm trùng); T-035 (P1) chưa làm. Chờ owner: xác nhận `url-lists.json` (P-04; PR #46 merge không kèm nhận xét) và các chỗ ở [analysis-pipeline §13](../design/analysis-pipeline.md#13-ghi-chú-cài-đặt-26112026). S3 trễ so với lịch 22–23/11. **GitHub (26/11):** đã đóng #8, #9, #10, #13, #14, #16 (T-031…T-033, T-036…T-038) theo yêu cầu owner khi mở PR #46; #11 (T-034) đóng khi merge vì chờ owner duyệt `url-lists.json` trong PR; ngày 27/11 #11, #15 (T-045), #17 (T-039) đã đóng, còn mở #12 (T-035).
- **S4 giao diện ScamShield (27/11, đã merge vào `main` (PR #48, 27/11), chưa deploy):** T-040 xong ở local: Tailwind v4, token, font, component nền (`npm run verify` và `next build` xanh; đã xem ảnh chụp 360px và 1280px). T-041, T-042: xem hai dòng dưới. CI trên `main` xanh; issue #18, #19, #20 đã đóng 27/11 theo yêu cầu owner (#20 còn việc xoá `/xem-truoc`).
- **T-041 (27/11, đã merge, PR #48, chưa deploy):** đã có mã cho trang `/` (ô nhập, bộ đếm, tin mẫu, chờ/lỗi/giới hạn; khối kết quả làm ở T-042). `npm run verify` và `next build` xanh; đã chạy các trạng thái trên Chromium headless với response giả. **Route thật (27/11, local: Postgres Docker đã migrate `0000_p0_tables`, Groq thật):** M1 ra `high_risk` sau ~2,5 s, không có giải thích (Groq 429 ở bước giải thích); M2 ra `no_signal` kèm giải thích và thông báo che OTP; không cuộn ngang ở 360px. **Điện thoại giả lập (27/11, Playwright, Galaxy S8 360×740, Postgres tạm, Groq thật):** 4 tin mẫu bấm bằng chạm và 1 tin dán từ clipboard (dán hai lần) đều có phản hồi trong 0,4–4,2 s; 6/6 lượt không có giải thích (Groq 429 hoặc JSON bị từ chối); tin dán lần đầu ra `inconclusive` (`llm_unavailable`), lần hai ra `high_risk`. **Xong:** owner chấp nhận 27/11 giả lập là đủ tạm thời cho cột `done_when`; **chưa thử trên điện thoại thật**. Tin mẫu là bản tạm, chờ T-093.
- **T-042 (27/11, đã merge, PR #48, chưa deploy):** khối kết quả đã có đủ (gồm hai câu khi không có tín hiệu hoặc chỉ dấu, sửa 27/11); `npm run verify` và `next build` xanh; ảnh chụp 360px cho 10 mẫu trên `/xem-truoc`, không có link, không cuộn ngang. **Route thật (27/11, local):** M1 hiện `high_risk` với 4 tín hiệu *AI nhận định*, 2 thẻ chỉ dấu, 3 khuyến nghị, không có mục "Vì sao" (Groq 429); M2 hiện `no_signal` với giải thích, thông báo che OTP, 1 tín hiệu và câu không tìm thấy chỉ dấu. Lượt điện thoại giả lập (dòng T-041) thêm `suspicious`, `inconclusive` do AI lỗi và `high_risk` có tín hiệu *Kiểm tra*; các biến thể còn lại mới kiểm bằng mẫu và response giả. **Việc còn lại: xoá `/xem-truoc` trước 30/11** (U-04).
- **S5 báo cáo + tra trạng thái (đã merge, PR #50, 27/11; chưa deploy):** T-053, T-050, T-051, T-052 xong ở local. `npm run verify` (có test tích hợp trên Postgres tạm) và `next build` xanh. Kiểm tay bằng Chromium 360px và 1280px trên route thật, **không có model** (key giả, trần LLM đã hết), nên lúc đó tóm tắt AI chưa chạy với Groq thật. **Kiểm lại cùng ngày với Groq thật:** luồng báo cáo và tra cứu đạt, nhưng tóm tắt AI thường thiếu do 429 (0/3 khi gửi sau khoảng 20 giây, 3/4 khi nghỉ khoảng 90 giây; [report-flow §13](../design/report-flow.md#13-kết-quả-kiểm-27112026)). Chi tiết và chỗ khác bản duyệt ở [report-flow §12](../design/report-flow.md#12-ghi-chú-cài-đặt-27112026), **owner xác nhận 27/11**. RP-06 (che thêm mã số trong ghi chú) owner chốt 27/11, đã có mã.
- **S6 FraudOps: đăng nhập, danh sách, chi tiết, kết luận (28/11, nhánh `feat/s6-auth`, chưa merge, chưa deploy):** T-060…T-063 xong ở local; `npm run verify` (có test tích hợp trên Postgres tạm) và `next build` xanh; route và UI kiểm tay trên DB tạm ([fraudops §11](../design/fraudops.md#11-ghi-chú-cài-đặt-28112026)). Owner cần đặt `DEMO_STAFF_PASSWORDS` rồi chạy `npm run demo:seed` mới đăng nhập được.
- **Chưa có:** seed/reset demo, phần còn lại của bộ eval (60–100 tình huống; runner còn thiếu tập held-out và chặn đóng băng, kiểm chéo tập, `--ids`, bảng chấm giải thích).

## 4. Quyết định cần chốt

| Loại | Ở đâu | Hạn | Trạng thái |
|---|---|---|---|
| Quyết định sản phẩm Q-01…Q-07, Q-10 | [spec §7](../spec/ScamShield-v1.md#7-quyết-định-mở-owner-chốt) | 21/11 | Đã chốt 20/11; danh sách thương hiệu Q-10 chốt 24/11 |
| Q-08 model Groq (sau khi thử 20 câu dev) | spec §7, [`../research/result.md`](../research/result.md) | 22/11 | Đã chốt 22/11: chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b` (giữ sau khi có điểm tiếng Việt, dưới ngưỡng, owner chấp nhận rủi ro); còn nhập giá |
| Q-09 hạ tầng | spec §7 | 21/11 | Đã chốt: Vercel + Supabase (có thể xem lại sau 25/11) |
| Kiến trúc, API contract | [`../architecture/`](../architecture/system-design.md) | 21/11 | Bản nháp |
| Schema DB | `/sdlc:database` | 21/11 | Chưa làm |
| D-04 Supabase Free tạm dừng project | [system-design §9](../architecture/system-design.md#9-quyết-định-cần-owner-chốt) | trước 03/12 | Chờ owner kiểm |
| O-04 giới hạn độ dài ghi chú, lý do | [ui-pages §8](../product/ui-pages.md#8-quyết-định-mở-cho-giao-diện) | trước slice báo cáo (26/11) | Chờ owner |
| Ngưỡng chọn model, định dạng eval | [research A.5, B.2](../research/result.md) | 21/11 | Ngưỡng A.5 và nhãn 20 câu dev đã duyệt 21/11 |

## 5. Charter: coding agent được tự quyết tới đâu

| Được tự làm | Phải hỏi owner |
|---|---|
| Sửa tài liệu cho khớp với code đã duyệt | Đổi bất kỳ nguyên tắc P1–P5 hay quyết định Q-xx nào |
| Viết code và test trong slice đã duyệt | Thêm thư viện ngoài [libraries.md](../conventions/libraries.md) |
| Chạy `npm run verify`, Postgres local, eval trên vài tình huống | Chạy toàn bộ eval nhiều lần (tốn tiền LLM); gọi tra cứu ngoài quy mô lớn |
| Mở PR khi owner yêu cầu | Merge, deploy, migrate/seed DB trên bản deploy |
| Đề xuất cắt việc theo §7 | Thực hiện cắt việc |

## 6. Lộ trình

| Ngày | Việc | Xong khi |
|---|---|---|
| **20–21/11** | Chốt Q-01…Q-10. Design + schema + API contract. Scaffold monorepo, **walking skeleton deploy lên URL công khai** kèm CI. Bắt đầu gom dữ liệu eval | URL công khai trả trang trống + API `/health` nối được DB |
| **22–23/11** | Pipeline: kiểm tra đầu vào, che dữ liệu, trích chỉ dấu, kiểm URL, LLM trích signal, quy tắc verdict, giải thích (SO-01…SO-03). Thử LLM trên tập dev | `curl` một tin mẫu ra JSON đúng schema; test quy tắc verdict xanh |
| **24–25/11** | Giao diện ScamShield: ô nhập, tin mẫu, kết quả, trạng thái lỗi/chờ. AWS Training 25/11 | Dán tin trên điện thoại ra kết quả |
| **26–27/11** | Gửi báo cáo, tạo case, đăng nhập FraudOps, danh sách và chi tiết case (SO-04…SO-06). **Viết kịch bản video** | Báo cáo gửi từ ScamShield hiện trong FraudOps |
| **28–29/11** | Kết luận và đóng case; seed + reset demo (SO-10); SO-07, SO-08 (Q-02); tích hợp toàn hệ thống | Đi hết 6 bước ở §1 trên bản deploy |
| **30/11** | **Đóng băng tính năng.** Chạy end-to-end | Không còn lỗi chặn luồng demo |
| **01–02/12** | Eval tập held-out, sửa lỗi, README, hướng dẫn 1 trang, slide, quay video | Đủ 4 thành phần ở §9 |
| **03/12** | Dự phòng. Kiểm mọi link ở chế độ ẩn danh. **Nộp sớm trong ngày** | Đã nộp |
| 04–11/12 | Giữ link chạy, tập trình bày, chuẩn bị câu hỏi của giám khảo. **Không sửa slide** | — |

**Phân công:** việc của từng thành viên (vai A/B/C) và mốc ngày để kịp đóng băng 30/11 ở [team-split.md](./team-split.md); cột `assignee` trong `tasks.csv`.

## 7. Cắt việc khi trễ (theo thứ tự)

1. SO-08 vòng phản hồi chỉ dấu đã xác minh.
2. SO-07 liên kết case (giữ lại nếu SO-08 đã cắt mà còn nửa ngày).
3. Tra cứu ngoài RDAP / Safe Browsing (SO-02-AC03).
4. Tra trạng thái case phía người dùng (SO-04-AC04).
5. Lọc và tìm kiếm trong danh sách case (giữ sắp xếp mới nhất trước).
6. Độ trau chuốt giao diện FraudOps.

**Không bao giờ cắt:** pipeline đủ 6 bước, verdict `inconclusive`, tách *Kiểm tra* / *AI nhận định*, gửi báo cáo → case → kết luận lưu bền, đăng nhập FraudOps, bộ eval có số liệu, disclaimer.

## 8. Rủi ro

| Rủi ro | Dấu hiệu | Xử lý |
|---|---|---|
| Prompt injection trong tin nhắn làm sai kết quả | Tình huống injection trong eval bị đánh giá thấp | Nội dung là dữ liệu có phân tách; verdict do quy tắc (P4); coi injection là signal |
| LLM bịa sự kiện trong phần giải thích | Eval thấy giải thích nêu điều không có trong signal | Chỉ truyền signal + kết quả kiểm vào bước giải thích; test SO-03-AC05 |
| Dương tính giả cao với tin hợp lệ (OTP, khuyến mãi thật) | Tỉ lệ FP trên tập dev cao | Bổ sung tin hợp lệ vào dev; chỉnh trọng số quy tắc; nói rõ giới hạn trong slide |
| Chi phí LLM tăng vì website công khai bị spam | Hoá đơn hoặc số request tăng bất thường | Rate limit (Q-06), trần ngân sách ở provider, giới hạn độ dài |
| Provider LLM chậm hoặc lỗi lúc giám khảo chấm | Timeout, 5xx | Timeout + `inconclusive`; cấu hình được model dự phòng |
| Deploy hỏng sát hạn | Lỗi build/biến môi trường phát hiện muộn | Deploy từ 21/11 và deploy mỗi lần merge |
| Giám khảo dùng chung tài khoản làm rối dữ liệu của nhau | Case mẫu bị đóng hết | Nhiều tài khoản thử (Q-07); lệnh reset seed (SO-10-AC04) |
| Workspace trông trống | FraudOps chỉ có 1 case khi giám khảo vào | Seed 20–40 case (SO-10-AC03) |
| Trễ lịch quá 1 ngày | Mốc 28–29/11 chưa đi hết 6 bước | Cắt theo §7, báo sớm |

## 9. Checklist nộp bài

- [ ] **Sản phẩm:** hướng dẫn sử dụng ≤ 1 trang A4, PDF, có link sản phẩm và tài khoản thử FraudOps
- [ ] **Mã nguồn:** `.zip` toàn bộ mã nguồn (kèm nội dung submodule `tools/sdlc-kit`, vì zip không tự kéo submodule). README có: cách chạy, công nghệ, danh sách tài sản có sẵn, thư viện mã nguồn mở, công cụ AI đã dùng
- [ ] **Tài liệu mô tả:** slide ≤ 10 trang, PDF, nêu rõ vấn đề, giải pháp, đối tượng người dùng. **Không sửa được sau khi nộp**: kiểm kỹ
- [ ] **Video:** ≤ 3 phút, MP4, quay sản phẩm chạy thật theo [`demo.md`](./demo.md)
- [ ] Mở thử link sản phẩm ở chế độ ẩn danh, trên máy tính và điện thoại
- [ ] Không có secret trong `.zip` (`.env`, key) — kiểm trước khi nén
