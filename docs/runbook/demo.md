# Kịch bản demo và ngày chấm

**Trạng thái (28/11/2026):** BẢN NHÁP; thêm bước kiểm danh sách đã xác minh (S8) vào §3. Dùng cho video ≤ 3 phút (nộp 03/12), cho giám khảo tự dùng thử (03/12–11/12) và cho phần trình bày chung kết (11/12). Kịch bản gốc ở [spec §8](../spec/ScamShield-v1.md#8-kịch-bản-demo--3-phút-dùng-cho-video); file này thêm lời thoại, dữ liệu cần chuẩn bị, checklist và cách xử lý sự cố.

**Luật:** video quay **sản phẩm chạy thật trên URL công khai** (plan §9). Không dựng cảnh, không chèn kết quả giả. Tính năng nào bị cắt (plan §7) thì bỏ đoạn tương ứng, không quay bản dở.

## 1. Kịch bản video (≤ 3:00)

| Thời gian | Màn hình | Thao tác | Lời thoại (gợi ý) | Cần có |
|---|---|---|---|---|
| 0:00–0:20 | Ảnh tin nhắn mẫu, rồi trang `/` trên khung điện thoại | — | "Mỗi ngày người dùng ví điện tử nhận những tin như thế này. Họ có vài phút để đoán thật hay giả. Còn đội vận hành nhận báo cáo rời rạc và phải đọc tay." | Tin mẫu M1 |
| 0:20–0:45 | ScamShield, 360px | Bấm tin mẫu M1 → "Kiểm tra" | "Dán tin nhắn, vài giây sau có kết quả: Nguy cơ cao. Mỗi dấu hiệu ghi rõ là do code kiểm tra hay do AI nhận định." | SO-01…SO-03 |
| 0:45–1:00 | ScamShield | Cuộn qua chỉ dấu, phép kiểm, khuyến nghị; rồi bấm tin mẫu M2 (tin OTP thật) | "Hệ thống không mở đường dẫn, chỉ phân tích chuỗi. Với tin OTP thật, kết quả là *Chưa phát hiện dấu hiệu lừa đảo*, kèm lời nhắc. Hệ thống không bao giờ nói 'an toàn'." | Tin mẫu M2 |
| 1:00–1:15 | ScamShield | Quay lại M1 → "Gửi báo cáo" → chọn SMS → gửi | "Người dùng gửi báo cáo, nhận mã hồ sơ." | SO-04 |
| 1:15–1:45 | FraudOps, máy tính | Đăng nhập `judge1` → hàng đợi → mở hồ sơ vừa gửi | "Bên đội vận hành, báo cáo đã thành hồ sơ: bằng chứng bên trái, nhận định của AI bên phải, tách riêng." | SO-05, SO-06 |
| 1:45–2:15 | FraudOps | Chỉ vào khối "3 hồ sơ khác có cùng chỉ dấu" → chọn *Xác nhận lừa đảo* → nhập lý do → lưu | "Ba báo cáo khác dùng cùng tên miền: đây là một chiến dịch. Nhân viên kết luận và ghi lý do. AI đề xuất, con người quyết định." | SO-07, dữ liệu seed S1 |
| 2:15–2:40 | ScamShield, tab ẩn danh | Dán tin M3 (nội dung khác, cùng tên miền) → "Kiểm tra" | "Người dùng khác nhận một tin khác với cùng tên miền: hệ thống cảnh báo ngay, chỉ dấu đã được đội vận hành xác minh." | SO-08 |
| 2:40–3:00 | Slide số liệu | — | "Trên bộ đánh giá tự soạn, kết quả là [số liệu held-out]. Bộ dữ liệu nhỏ, không chứng minh bắt được mọi kiểu lừa đảo. ScamShield Ops: AI chuẩn bị, con người quyết định." | research B.5 |

**Nếu cắt SO-07/SO-08:** bỏ đoạn 1:45 phần "ba báo cáo khác" và cả đoạn 2:15–2:40; dành thời gian cho phần bằng chứng và số liệu.

## 2. Dữ liệu cần chuẩn bị

| Mã | Là gì | Yêu cầu |
|---|---|---|
| M1 | Tin lừa đảo chính | Mạo danh thương hiệu, tên miền `vi-xac-minh.example`, đòi OTP, áp lực thời gian. Là một trong 3–4 tin mẫu trên trang (SO-10-AC05) |
| M2 | Tin OTP hợp lệ | Thông báo mã, dặn không chia sẻ, không có đường dẫn lạ. Phải ra `no_signal` ổn định trong eval |
| M3 | Tin lừa đảo thứ hai | Nội dung khác M1 (ví dụ "hoàn tiền"), **cùng** tên miền `vi-xac-minh.example`. Không phải tin mẫu trên trang; dán tay |
| S1 | Seed | 3 hồ sơ `is_seed` chứa `vi-xac-minh.example`, trạng thái khác nhau, để SO-07 hiện "3 hồ sơ khác" |
| S2 | Trạng thái trước khi quay | `vi-xac-minh.example` **chưa** nằm trong danh sách đã xác minh (nếu không M1 đã ra cảnh báo SO-08 từ đầu). Chạy `npm run demo:reset` trước khi quay |

Thương hiệu được mạo danh trong M1, M3 là một thương hiệu thật trong `brands.json` (R-01, §6), nên phép kiểm "tên miền chính thức" chạy được.

## 3. Checklist trước khi quay

- [ ] Bản deploy production đúng commit sẽ nộp; `/api/health` trả 200.
- [ ] `npm run demo:reset` đã chạy (owner); FraudOps có 20–40 hồ sơ mẫu.
- [ ] (Có S8) `vi-xac-minh.example` **không** còn dòng chưa gỡ trong danh sách đã xác minh; `demo:reset` không xoá dòng sinh từ hồ sơ thật. Làm lại trước mỗi buổi chấm: đăng nhập FraudOps, mở `/ops/chi-dau`, nếu có dòng này thì gỡ (kèm lý do).
- [ ] Chạy thử M1, M2, M3 trên bản deploy **ít nhất 3 lần**, verdict ổn định.
- [ ] Trình duyệt ẩn danh, không tiện ích, zoom 100%; tắt thông báo hệ điều hành.
- [ ] ScamShield quay ở khung 360–414px (DevTools hoặc điện thoại thật); FraudOps ở 1280px trở lên.
- [ ] Không có tab, bookmark hay thông báo nào lộ email, key, `.env`, dashboard Supabase/Vercel/Groq.
- [ ] Đồng hồ: cả video ≤ 3:00, xuất MP4.
- [ ] Số liệu ở đoạn cuối lấy từ research B.5 (held-out), không làm tròn có lợi.

## 4. Xử lý sự cố khi quay hoặc khi giám khảo dùng

| Sự cố | Dấu hiệu | Làm gì |
|---|---|---|
| Groq chậm hoặc lỗi | Kết quả `Chưa đủ thông tin để kết luận`, lý do lỗi AI | Đợi vài phút, quay lại. Nếu kéo dài: owner đổi biến cấu hình sang model dự phòng (research A.7) và redeploy. Không sửa kết quả |
| Bị giới hạn tần suất khi quay | "Bạn đang gửi quá nhanh…" | Chờ 1 phút; đừng bấm liên tục khi tập |
| DB không kết nối | `/api/health` trả 503 | Kiểm project Supabase có bị tạm dừng không (D-04); kiểm biến `DATABASE_URL` trên Vercel |
| Hồ sơ mẫu bị giám khảo đóng hết | Hàng đợi trống | Owner chạy `npm run demo:reset` (giữ hồ sơ giám khảo tạo, SO-10-AC04) |
| Deploy mới làm hỏng luồng | Một bước trong §1 thất bại | Trong Vercel, promote lại bản deploy trước đó. **Từ 03/12 không deploy tính năng mới**, chỉ sửa lỗi chặn và có kiểm lại cả §1 |

## 5. Giai đoạn chấm (03/12–11/12)

- Mỗi ngày một lần: mở link ScamShield ở chế độ ẩn danh trên điện thoại, chạy M1; đăng nhập FraudOps một tài khoản thử; gọi `/api/health`.
- Theo dõi chi phí và số request Groq; gần trần ngân sách (Q-06) thì báo owner.
- Hướng dẫn 1 trang A4 (plan §9) có: link sản phẩm, 5 tài khoản `judge1…judge5` kèm mật khẩu, 4 bước dùng thử (theo plan §1), disclaimer. Mật khẩu tài khoản thử chỉ nằm trong file PDF nộp bài, không nằm trong repo.
- Chung kết 11/12: chuẩn bị bản ghi màn hình dự phòng của toàn bộ §1 phòng khi mạng tại chỗ lỗi; tập trả lời 10 câu ở [onboarding §9](../onboarding/concepts.md#phần-9-tự-kiểm-tra).

## 6. Quyết định

| ID | Câu hỏi | Quyết định | Trạng thái |
|---|---|---|---|
| R-01 | M1/M3 mạo danh thương hiệu nào? | Một **thương hiệu thật** có trong Phụ lục A của spec, chỉ xuất hiện như nội dung tin nhắn được phân tích (spec §9). Tên miền lừa đảo vẫn là `vi-xac-minh.example`. Không dùng logo hay màu nhận diện. Thương hiệu cụ thể chọn khi soạn M1 | Đã chốt 20/11 |
