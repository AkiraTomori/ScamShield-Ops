# ScamShield Ops — Trang và trạng thái giao diện

**Trạng thái (28/11/2026):** BẢN NHÁP; §6.2 và §7 sửa theo thiết kế S8 owner duyệt 26/11. Mô tả **trang, khối giao diện và trạng thái** của ScamShield và FraudOps. Mục ghi *(đề xuất, chờ owner)* chưa được duyệt.

**Thứ bậc:** hành vi theo [spec](../spec/ScamShield-v1.md); kiến trúc theo [system-design](../architecture/system-design.md). File này **không** định nghĩa endpoint hay trường JSON: mỗi trang chỉ ghi "cần dữ liệu gì". Hình dạng chính xác ở zod schema trong `packages/shared` và [api.md](../architecture/api.md). Token, component và câu chữ ở [design-system.md](./design-system.md). Wireframe từng trang và ma trận trang ↔ API ở [design/pages.md](../design/pages.md).

## 1. Bản đồ trang

| Đường dẫn *(đề xuất)* | Trang | Ai dùng | Đăng nhập | Thiết bị chính |
|---|---|---|---|---|
| `/` | Kiểm tra tin nhắn + kết quả + gửi báo cáo | Người dùng, giám khảo | Không (Q-05) | Điện thoại ≥ 360px |
| `/tra-cuu` | Tra trạng thái báo cáo | Người dùng | Không, dùng mã case + mã bí mật | Điện thoại |
| `/ops/dang-nhap` | Đăng nhập FraudOps | Nhân viên, giám khảo | — | Máy tính |
| `/ops` | Hàng đợi / danh sách hồ sơ | Nhân viên | Có | Máy tính |
| `/ops/ho-so/[mã]` | Chi tiết hồ sơ + kết luận | Nhân viên | Có | Máy tính |
| `/ops/chi-dau` | Chỉ dấu đã xác minh (SO-08, P1) | Nhân viên | Có | Máy tính |

**Khung chung:**
- **ScamShield:** header chỉ có tên sản phẩm và link "Tra cứu báo cáo". Footer luôn có disclaimer (spec §9) ở mọi trạng thái, kể cả lỗi. Không có link sang FraudOps trên trang người dùng; giám khảo vào FraudOps qua link trong hướng dẫn 1 trang.
- **FraudOps:** header có tên "FraudOps", điều hướng (Hồ sơ, Chỉ dấu đã xác minh), tên tài khoản đang đăng nhập, nút Đăng xuất.
- **Không có** nút, menu hay liên kết nào để khoá tài khoản, chặn giao dịch hay liên hệ bên thứ ba (P1, SO-06-AC06).

## 2. ScamShield — `/` Kiểm tra tin nhắn

**Cần dữ liệu:** danh sách 3–4 tin mẫu (tĩnh, dùng tên miền `*.example`); kết quả analysis.

### 2.1 Khối nhập

- Ô nhập nhiều dòng, nhãn "Dán tin nhắn bạn nhận được", bộ đếm `0/2.000`.
- 3–4 nút tin mẫu ("Thử tin mẫu: …"). Bấm vào thì **điền** vào ô, không tự gửi (SO-10-AC05).
- Nút chính "Kiểm tra".
- Một dòng nhỏ dưới ô: "Đừng dán mật khẩu hay mã OTP. Nếu có, hệ thống sẽ tự che trước khi phân tích."

### 2.2 Trạng thái

| Trạng thái | Khi nào | Hiển thị | AC |
|---|---|---|---|
| Ban đầu | Mở trang | Ô trống, tin mẫu, nút "Kiểm tra" dùng được | SO-10-AC05 |
| Không hợp lệ | Rỗng/chỉ khoảng trắng, hoặc > 2.000 ký tự | Lỗi ngay dưới ô (gắn `aria-describedby`), không gửi đi. Server cũng kiểm lại và trả cùng thông báo | SO-01-AC02 |
| Đang kiểm tra | Đã bấm, chờ kết quả | Nút khoá + "Đang kiểm tra…", khối kết quả hiện skeleton. Sau ~5 giây thêm dòng "Vẫn đang phân tích, thường mất dưới 10 giây". Không có spinner vô hạn: server trả `inconclusive` khi quá 20 giây | SO-03-AC06 |
| Có kết quả | Thành công | Khối kết quả (§2.3), tự cuộn tới, vùng `aria-live="polite"` đọc verdict | SO-03-AC04 |
| Chưa kết luận được do hệ thống | Server trả `inconclusive` với `inconclusiveReason` là `timeout`, `llm_invalid_output` hoặc `llm_unavailable` (contracts §1) | Verdict "Chưa đủ thông tin để kết luận" + câu theo lý do (design-system §3) + nút "Thử lại". Vẫn hiện chỉ dấu và phép kiểm tất định đã có | SO-03-AC01, AC06 |
| Chưa kết luận được do thiếu bằng chứng | `inconclusiveReason = insufficient_evidence` | Verdict "Chưa đủ thông tin để kết luận" + câu theo lý do; **không** có nút "Thử lại" (thử lại cũng ra như vậy) | SO-03-AC03 |
| Gửi quá nhanh | Vượt 10 lượt/phút/IP | "Bạn đang gửi quá nhanh, thử lại sau ít phút" (nguyên văn spec). Giữ nguyên nội dung trong ô | SO-01-AC04 |
| Lỗi mạng / máy chủ | Không kết nối được, lỗi 5xx | "Chưa kiểm tra được do lỗi kết nối. Nội dung của bạn vẫn còn, hãy thử lại." + nút "Thử lại". **Không** hiển thị verdict nào | — |

### 2.3 Khối kết quả

Thứ tự từ trên xuống (đọc được trên 360px, một cột):

1. **Verdict:** nhãn + biểu tượng + một câu giải nghĩa (design-system §3). **Không** có phần trăm, điểm số hay chữ "an toàn" (SO-03-AC03, AC04).
2. **Thông báo đã che** (chỉ khi có che): "Đã che mã OTP / mật khẩu / số thẻ trong nội dung trước khi phân tích." (SO-01-AC03).
3. **Giải thích** ngắn do AI viết, gắn nhãn *AI nhận định* (SO-03-AC05). Không có giải thích (`explanation = null`) thì ẩn mục này, không hiện chỗ trống.
4. **Tín hiệu phát hiện:** mỗi dòng có tên tín hiệu và badge nguồn *Kiểm tra* hoặc *AI nhận định* (P2). Tín hiệu SO-08 hiện nguyên văn "Chỉ dấu này đã được đội vận hành xác minh là lừa đảo" với badge *Kiểm tra*. Câu lệnh nhắm vào AI xuất hiện như một tín hiệu rủi ro (SO-01-AC05).
5. **Chỉ dấu đã trích:** URL/tên miền, SĐT, số tài khoản. Mỗi chỉ dấu liệt kê từng phép kiểm với trạng thái *Cảnh báo* / *Không phát hiện vấn đề* / *Không tra được*. *Không tra được* **không** được trình bày như đạt (SO-02-AC02, AC03). URL hiển thị dạng văn bản thuần, **không** là link bấm được, có thể ngắt dòng (P5).
6. **Nên làm gì:** 2–4 khuyến nghị cụ thể (SO-03-AC04). Đây là câu mẫu do code chọn (contracts A-01), **không** gắn nhãn *AI nhận định*.
7. Hai hành động: **"Gửi báo cáo cho đội vận hành"** và "Kiểm tra tin khác" (xoá kết quả, giữ ô trống).
8. Disclaimer (đã có ở footer; lặp lại ngay dưới kết quả).

Không có tín hiệu nào thì mục 4 ghi "Chưa phát hiện tín hiệu nào"; không có chỉ dấu thì mục 5 ghi "Không tìm thấy đường dẫn, số điện thoại hay số tài khoản" (SO-02-AC04).

### 2.4 Gửi báo cáo

Mở ngay dưới kết quả (không chuyển trang, để giữ ngữ cảnh trên điện thoại).

| Phần | Nội dung | AC |
|---|---|---|
| Kênh nhận tin | Chọn một: SMS, Zalo, Messenger, Email, Khác (bắt buộc) | SO-04-AC02 |
| Ghi chú | Tuỳ chọn, tối đa **500 ký tự** (O-04), có bộ đếm | SO-04-AC02 |
| Nút | "Gửi báo cáo" | — |

| Trạng thái | Hiển thị | AC |
|---|---|---|
| Đang gửi | Nút khoá, "Đang gửi…" | — |
| Thành công | "Đã gửi báo cáo." Hiện **mã hồ sơ** (`SC-0007`) và **mã bí mật**, mỗi mã có nút "Sao chép". Cảnh báo: "Lưu lại cả hai mã để tra cứu. Mã bí mật sẽ không hiển thị lại." Link "Tra cứu trạng thái" | SO-04-AC01, AC04 |
| Đã gửi trước đó | Cùng analysis gửi lại: "Báo cáo này đã được gửi trước đó" + mã hồ sơ + "Dùng mã bí mật bạn đã lưu để tra cứu." **Không** hiện lại mã bí mật (O-02) | SO-04-AC03 |
| Lỗi | "Chưa gửi được báo cáo. Hãy thử lại." Giữ nội dung form | — |

## 3. ScamShield — `/tra-cuu` Tra trạng thái

**Cần dữ liệu:** trạng thái hiện tại của một case, chỉ khi mã case và mã bí mật khớp.

- Hai ô: "Mã hồ sơ" (gợi ý `SC-0007`), "Mã bí mật". Nút "Tra cứu".
- **Khớp:** hiện một trong bốn nhãn nguyên văn SO-04-AC04: `Đang chờ xem xét`, `Đã xác nhận lừa đảo`, `Không phát hiện lừa đảo`, `Chưa đủ bằng chứng`, kèm một câu giải nghĩa và thời điểm cập nhật. **Không** hiện lý do nội bộ, tên nhân viên hay nội dung tin.
- **Không khớp** (sai mã, sai mã bí mật, hoặc hồ sơ không tồn tại): **một thông báo duy nhất** "Không tìm thấy báo cáo khớp với hai mã này." để không lộ hồ sơ nào tồn tại.
- Gửi quá nhanh: dùng chung thông báo SO-01-AC04.

## 4. FraudOps — `/ops/dang-nhap`

- Ô "Tên đăng nhập", "Mật khẩu", nút "Đăng nhập". Dòng nhỏ: "Tài khoản thử có trong hướng dẫn sử dụng."
- Sai thông tin: "Sai tên đăng nhập hoặc mật khẩu." (không nói sai phần nào).
- Thử đăng nhập quá nhiều lần: dùng câu chung của `rate_limited` (api.md §2).
- Chưa đăng nhập mà mở trang `/ops/*` → chuyển về đây, đăng nhập xong quay lại đúng trang định mở (SO-06-AC01).
- Phiên hết hạn khi đang thao tác → thông báo "Phiên đăng nhập đã hết hạn" và chuyển về đây. Lý do kết luận đang gõ dở **có thể mất**; chấp nhận trong v1.

## 5. FraudOps — `/ops` Danh sách hồ sơ

**Cần dữ liệu:** danh sách case (mã, thời điểm tạo, verdict engine, loại rủi ro, trạng thái, cờ dữ liệu mẫu, số case liên quan nếu có SO-07), có lọc, tìm, phân trang.

- Bảng, mới nhất trước. Cột: Mã hồ sơ · Thời điểm · Đánh giá của engine (badge verdict) · Loại rủi ro · Trạng thái · (SO-07) "Liên quan: N".
- Case seed có badge **"Dữ liệu mẫu"** (SO-10-AC03).
- Bộ lọc: Trạng thái (Chờ xem xét / Đã đóng), Verdict (4 mức). Ô tìm theo mã hồ sơ (SO-06-AC02). Mặc định lọc "Chờ xem xét".
- Phân trang 25 dòng/trang. Bộ lọc giữ trên URL để tải lại không mất (SO-06-AC05).

| Trạng thái | Hiển thị |
|---|---|
| Đang tải | Skeleton dòng bảng |
| Trống hoàn toàn | "Chưa có hồ sơ nào." (thực tế hiếm vì có seed) |
| Lọc không ra kết quả | "Không có hồ sơ khớp bộ lọc." + nút "Xoá bộ lọc" |
| Lỗi | "Không tải được danh sách. Thử lại." |

Cắt việc (plan §7 mục 5): bỏ lọc và tìm, giữ sắp xếp mới nhất trước.

## 6. FraudOps — `/ops/ho-so/[mã]` Chi tiết hồ sơ

**Cần dữ liệu:** toàn bộ case theo SO-05-AC01, tóm tắt và đề xuất của AI, kết luận (nếu có), danh sách case liên quan (SO-07).

### 6.1 Bố cục

- **Đầu trang:** mã hồ sơ, trạng thái, thời điểm tạo, nguồn "Báo cáo từ người dùng", kênh nhận tin, badge "Dữ liệu mẫu" nếu có.
- **Hai khối tách rõ** (SO-05-AC03), trên màn rộng là hai cột, Bằng chứng bên trái:

| Khối **Bằng chứng** (dữ liệu và kiểm tra tất định) | Khối **Nhận định của AI** (nhãn rõ, nền khác) |
|---|---|
| Nội dung gốc đã che (font đơn cách, giữ xuống dòng, URL là văn bản không bấm được) | Tóm tắt điều tra 3–5 câu (SO-05-AC02). Chưa có (LLM lỗi lúc tạo case, contracts A-02): "Chưa có tóm tắt AI cho hồ sơ này. Hãy kết luận dựa trên bằng chứng." |
| Ghi chú của người báo cáo | Đề xuất bước tiếp theo, **chỉ là văn bản**, không phải nút hành động (P1) |
| Chỉ dấu + kết quả từng phép kiểm | Tín hiệu có nguồn *AI nhận định* |
| Tín hiệu nguồn *Kiểm tra* | |
| Verdict của engine + loại rủi ro + các quy tắc đã kích hoạt | |

- **Hồ sơ liên quan (SO-07, P1):** "N hồ sơ khác có cùng chỉ dấu", liệt kê mã, chỉ dấu chung, trạng thái; bấm mở case đó. Không có thì ẩn khối.

### 6.2 Kết luận (SO-06-AC03)

- Ba lựa chọn (radio): **Xác nhận lừa đảo** (`confirmed_scam`), **Không phải lừa đảo** (`not_scam`), **Chưa đủ bằng chứng** (`insufficient_evidence`).
- "Lý do" bắt buộc, tối thiểu 10, tối đa 500 ký tự (O-04).
- Khi chọn "Xác nhận lừa đảo" và SO-08 có trong bản build: "Sẽ thêm vào danh sách đã xác minh:" kèm danh sách chỉ dấu (văn bản, không bấm được); không có gì để thêm thì "Hồ sơ này không có chỉ dấu nào để thêm." (SO-08-AC01, [verified-indicators §2](../design/verified-indicators.md)).
- Nút "Lưu kết luận và đóng hồ sơ".

| Trạng thái | Hiển thị | AC |
|---|---|---|
| Chờ xem xét | Form kết luận ở cuối trang, bên cạnh hai khối | — |
| Thiếu lý do | Lỗi dưới ô lý do, không gửi | SO-06-AC03 |
| Đang lưu | Nút khoá | — |
| Đã đóng | Thay form bằng thẻ kết luận: lựa chọn, lý do, người kết luận, thời điểm. Nếu khác đánh giá engine (bảng đồng ý ở SO-06-AC04): ghi "Nhân viên không đồng ý với đánh giá AI" | SO-06-AC03, AC04, AC05 |
| Xung đột | Người khác đã đóng hồ sơ trong lúc này (nhiều tài khoản thử, Q-07): "Hồ sơ đã được judge2 kết luận lúc 14:05." Tải lại thẻ kết luận, không ghi đè | — |
| Không tồn tại | "Không tìm thấy hồ sơ SC-xxxx." + link về danh sách | — |

## 7. FraudOps — `/ops/chi-dau` Chỉ dấu đã xác minh (SO-08, P1)

**Cần dữ liệu:** danh sách chỉ dấu đã xác minh (giá trị chuẩn hoá, loại, mã case nguồn, thời điểm, người xác nhận).

- Bảng: Chỉ dấu · Loại · Từ hồ sơ (link) · Thời điểm · Người xác nhận.
- Mỗi dòng có "Gỡ khỏi danh sách" → hộp thoại bắt buộc nhập lý do → xác nhận (SO-08-AC03). Gỡ xong dòng biến mất, có thông báo ngắn.
- Trống: "Chưa có chỉ dấu nào được xác minh."
- Cắt SO-08 (plan §7 mục 1) thì bỏ cả trang và mục điều hướng.

## 8. Quyết định mở cho giao diện

| ID | Câu hỏi | Quyết định | Trạng thái |
|---|---|---|---|
| O-01 | Thế nào là "nhân viên không đồng ý với AI" (SO-06-AC04)? | Đồng ý khi `confirmed_scam` ↔ `high_risk`/`suspicious`; `not_scam` ↔ `no_signal`; `insufficient_evidence` ↔ `inconclusive`; còn lại là không đồng ý. Đã ghi vào SO-06-AC04 | Đã chốt 20/11 |
| O-02 | Gửi lại cùng analysis: có hiện lại mã bí mật? | Không; mã bí mật chỉ lưu dạng băm. Đã ghi vào SO-04-AC03 | Đã chốt 20/11 |
| O-03 | Nhãn `no_signal` lệch giữa spec §3/§8 và SO-03-AC03 | "Chưa phát hiện dấu hiệu lừa đảo"; đã sửa spec §3 và §8 | Đã chốt 20/11 |
| O-04 | Giới hạn ghi chú báo cáo và lý do kết luận | Ghi chú ≤ 500 ký tự; lý do 10–500 ký tự | Đã chốt 20/11 |
| O-05 | Styling | **Tailwind CSS**; token khai báo một lần (§2 design-system) | Đã chốt 20/11 |
