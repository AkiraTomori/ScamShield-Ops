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
| *(Nếu Q-02 chốt)* Liên kết case theo chỉ dấu, vòng phản hồi chỉ dấu đã xác minh (SO-07, SO-08) | Đồ thị chiến dịch lừa đảo, chia sẻ chỉ dấu giữa các tổ chức |
| Bộ eval 60–100 tình huống (SO-09) | Benchmark lớn, học từ dữ liệu thật |
| Seed và tài khoản thử cho giám khảo (SO-10) | Đăng ký tài khoản, SSO |
| — | Cuộc gọi/giọng nói, giám sát giao dịch, tích hợp API ngân hàng/MoMo, tự khoá tài khoản, dashboard thống kê phức tạp |

## 3. Hiện trạng (20/11)

- Repo mới có khung tài liệu và submodule `tools/sdlc-kit`. Chưa có mã ứng dụng.
- Spec v1 ở trạng thái bản nháp; Q-01…Q-10 chờ owner chốt.

## 4. Quyết định cần chốt trước khi code

| Loại | Ở đâu | Hạn |
|---|---|---|
| Quyết định sản phẩm Q-01…Q-07, Q-10 | [spec §7](../spec/ScamShield-v1.md#7-quyết-định-mở-owner-chốt) | 21/11 |
| Q-08 nhà cung cấp LLM (sau khi thử 20 câu dev) | spec §7, kết quả ở [`../research/result.md`](../research/result.md) | 22/11 |
| Q-09 hạ tầng | spec §7 | 21/11 (có thể đổi sau 25/11 nếu có credit AWS) |
| Kiến trúc, schema DB, API contract | `/sdlc:design`, `/sdlc:database` → `../architecture/` | 21/11 |

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
| **28–29/11** | Kết luận và đóng case; seed + reset demo (SO-10); SO-07, SO-08 nếu Q-02 chốt; tích hợp toàn hệ thống | Đi hết 6 bước ở §1 trên bản deploy |
| **30/11** | **Đóng băng tính năng.** Chạy end-to-end | Không còn lỗi chặn luồng demo |
| **01–02/12** | Eval tập held-out, sửa lỗi, README, hướng dẫn 1 trang, slide, quay video | Đủ 4 thành phần ở §9 |
| **03/12** | Dự phòng. Kiểm mọi link ở chế độ ẩn danh. **Nộp sớm trong ngày** | Đã nộp |
| 04–11/12 | Giữ link chạy, tập trình bày, chuẩn bị câu hỏi của giám khảo. **Không sửa slide** | — |

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
