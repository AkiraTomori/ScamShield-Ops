# ScamShield Ops — Design system

**Trạng thái (20/11/2026):** BẢN NHÁP. Token, component, câu chữ và luật a11y dùng cho cả ScamShield và FraudOps. Trang và trạng thái ở [ui-pages.md](./ui-pages.md). Mục ghi *(đề xuất, chờ owner)* chưa được duyệt.

## 1. Nguyên tắc thị giác

- **Trung tính, không mượn nhận diện của ai.** Không dùng logo, màu hồng/magenta nhận diện của MoMo hay màu của ngân hàng, ví nào (spec §9). Tên thương hiệu chỉ xuất hiện như nội dung được phân tích.
- **Không có màu "an toàn".** Không dùng xanh lá cho bất kỳ verdict nào. Mức thấp nhất `no_signal` dùng xanh dương thông tin, không phải xanh lá.
- **Không bao giờ chỉ dựa vào màu.** Mọi verdict, trạng thái phép kiểm và badge nguồn đều có biểu tượng + chữ.
- **Bằng chứng và AI tách bằng thị giác.** Nội dung *AI nhận định* luôn có badge tím và nền riêng; *Kiểm tra* dùng badge xanh ngọc.

## 2. Token

Dùng **Tailwind CSS** (owner chốt 20/11/2026). Token khai báo **một lần** dưới dạng CSS custom properties trong file CSS global và nối vào theme Tailwind, để class Tailwind và CSS thường dùng cùng giá trị; không khai báo bảng màu thứ hai trong file cấu hình. Cách nối cụ thể theo phiên bản Tailwind ghim lúc scaffold. Chỉ có giao diện sáng trong v1.

**Màu.** Tỉ lệ tương phản tính theo công thức WCAG 2.x ngày 20/11/2026; chữ thường cần ≥ 4,5:1, viền thành phần UI cần ≥ 3:1.

| Token | Giá trị | Dùng cho | Tương phản |
|---|---|---|---|
| `--color-bg` | `#FFFFFF` | Nền trang | — |
| `--color-surface-subtle` | `#F2F4F7` | Nền khối phụ, hàng bảng xen kẽ | — |
| `--color-text` | `#101828` | Chữ chính | 17,75 trên trắng; 16,11 trên `surface-subtle` |
| `--color-text-muted` | `#475467` | Chữ phụ, chú thích | 7,69 trên trắng; 6,98 trên `surface-subtle` |
| `--color-border` | `#D0D5DD` | Đường kẻ trang trí (không dùng cho viền ô nhập) | 1,47 (chỉ trang trí) |
| `--color-border-strong` | `#667085` | Viền ô nhập, checkbox, radio | 4,97 trên trắng |
| `--color-primary` | `#3538CD` | Nút chính, link, vòng focus | 8,08 trên trắng; chữ trắng trên nền này 8,08 |
| `--color-danger` | `#B42318` | Lỗi form | 6,57 trên trắng |

**Màu verdict** (chữ/biểu tượng trên nền nhạt tương ứng):

| Verdict | Chữ | Nền | Tương phản | Biểu tượng |
|---|---|---|---|---|
| `high_risk` | `#B42318` | `#FEF3F2` | 6,05 | Tam giác cảnh báo đặc |
| `suspicious` | `#B54708` | `#FFFAEB` | 5,20 | Dấu chấm than tròn |
| `no_signal` | `#175CD3` | `#EFF8FF` | 5,57 | Chữ "i" tròn (thông tin), **không** dùng dấu tích |
| `inconclusive` | `#344054` | `#F2F4F7` | 9,49 | Dấu hỏi tròn |

**Badge nguồn:**

| Badge | Chữ | Nền | Tương phản |
|---|---|---|---|
| *Kiểm tra* | `#0E7090` | `#ECFDFF` | 5,37 |
| *AI nhận định* | `#6941C6` | `#F4F3FF` | 6,02 |

**Chữ:** font **Be Vietnam Pro** (U-01, owner chốt 26/11), nạp bằng `next/font` (tự host lúc build, không gọi Google Fonts lúc chạy), dự phòng `system-ui, sans-serif`. Font đơn cách cho nội dung tin nhắn gốc: `ui-monospace, monospace`. Font này phải ghi vào bảng tài sản có sẵn ở README khi dùng.

| Token | Cỡ / dòng | Dùng cho |
|---|---|---|
| `--text-xs` | 12 / 16 | Badge |
| `--text-sm` | 14 / 20 | Chú thích, bảng FraudOps |
| `--text-md` | 16 / 24 | Chữ thân, ô nhập (≥ 16px để iOS không tự phóng to) |
| `--text-lg` | 20 / 28 | Tiêu đề khối |
| `--text-xl` | 24 / 32 | Nhãn verdict, tiêu đề trang |

**Khoảng cách:** thang 4px (`--space-1` = 4px … `--space-8` = 32px). **Bo góc:** 6px cho ô nhập/nút, 10px cho thẻ. **Điểm ngắt:** < 640px một cột (ScamShield); ≥ 1024px hai cột cho chi tiết hồ sơ FraudOps. ScamShield phải dùng được ở 360px không cuộn ngang.

## 3. Câu chữ chuẩn

Câu ghi "nguyên văn spec" phải dùng đúng từng chữ. Toàn hệ thống **không** có chữ "an toàn", **không** có phần trăm, **không** gọi một người là "kẻ lừa đảo" (P1): nhãn mô tả tin nhắn hoặc hồ sơ.

| Khái niệm | Câu chữ | Nguồn |
|---|---|---|
| Disclaimer | "Kết quả mang tính tham khảo. Hãy xác minh qua kênh chính thức của tổ chức trước khi chuyển tiền hoặc cung cấp thông tin." | Nguyên văn spec §9 |
| `high_risk` | **Nguy cơ cao** · "Tin nhắn có nhiều dấu hiệu lừa đảo. Đừng bấm đường dẫn, đừng chuyển tiền hay cung cấp mã OTP." | Nhãn: spec §3 |
| `suspicious` | **Đáng ngờ** · "Tin nhắn có dấu hiệu bất thường. Hãy xác minh qua kênh chính thức trước khi làm theo." | Nhãn: spec §3 |
| `no_signal` | **Chưa phát hiện dấu hiệu lừa đảo** · "Hệ thống chưa thấy dấu hiệu lừa đảo, nhưng điều này không đảm bảo tin nhắn là thật. Hãy tự kiểm tra qua kênh chính thức." | Spec §3, SO-03-AC03 |
| `inconclusive` | **Chưa đủ thông tin để kết luận** · "Hệ thống chưa đủ bằng chứng để đánh giá. Hãy thận trọng và xác minh qua kênh chính thức." | Nhãn: spec §3 |
| Gửi quá nhanh | "Bạn đang gửi quá nhanh, thử lại sau ít phút" | Nguyên văn SO-01-AC04 |
| Chỉ dấu đã xác minh | "Chỉ dấu này đã được đội vận hành xác minh là lừa đảo" | Nguyên văn SO-08-AC02 |
| Trạng thái case (phía người dùng) | `Đang chờ xem xét` · `Đã xác nhận lừa đảo` · `Không phát hiện lừa đảo` · `Chưa đủ bằng chứng` | Nguyên văn SO-04-AC04 |
| Kết luận (phía nhân viên) | Xác nhận lừa đảo · Không phải lừa đảo · Chưa đủ bằng chứng | SO-06-AC03 |
| Bất đồng | "Nhân viên không đồng ý với đánh giá AI" | Nguyên văn SO-06-AC04 |
| Nguồn tín hiệu | *Kiểm tra* · *AI nhận định* | Spec P2, SO-03-AC04 |
| Trạng thái phép kiểm | **Cảnh báo** (`warn`) · **Không phát hiện vấn đề** (`pass`) · **Không tra được** (`unavailable`, kèm "Không tra được kết quả. Điều này không có nghĩa là không có vấn đề.") | SO-02-AC03 |
| Lý do chưa kết luận | `timeout`: "Hệ thống phân tích quá lâu. Hãy thử lại sau ít phút." · `llm_invalid_output`, `llm_unavailable`: "Bước phân tích bằng AI đang gặp sự cố. Hãy thử lại sau ít phút." · `insufficient_evidence`: "Nội dung chưa đủ để đánh giá. Hãy thận trọng và xác minh qua kênh chính thức." | contracts §1, SO-03-AC03, AC06 |
| Thiếu tóm tắt AI | "Chưa có tóm tắt AI cho hồ sơ này. Hãy kết luận dựa trên bằng chứng." | contracts A-02 |
| Bằng chứng cứng khi AI lỗi | Dưới verdict *Nguy cơ cao*: "Bước phân tích bằng AI chưa chạy được; kết quả dựa trên kiểm tra của hệ thống." | design/analysis-pipeline P-01 |
| Quy tắc kích hoạt (FraudOps) | R0 "AI không chạy được" · R1 "Bằng chứng đã xác minh hoặc danh sách đen" · R2 "Câu lệnh nhắm vào AI kèm dấu hiệu khác" · R3 "Tên miền đánh lừa + đòi thông tin hoặc tiền" · R4 "Đòi thông tin bảo mật kèm đe doạ/gấp/đường dẫn" · R5 "Từ hai dấu hiệu mạnh" · R6 "Một dấu hiệu mạnh" · R7 "Nhiều dấu hiệu vừa/yếu" · R8 "Thiếu bằng chứng" · R9 "Không có dấu hiệu" | design/analysis-pipeline §7 |
| Signal `claims_organization` | "Tin xưng danh một tổ chức" | P-07 |

Ghi chú về trạng thái phép kiểm: nhãn "Không phát hiện vấn đề" chỉ dùng cho **một phép kiểm**, không bao giờ dùng làm verdict. Giao diện không có chữ "an toàn" ở bất kỳ đâu.

**Tên phép kiểm** (`CheckType`, contracts §4) hiển thị cho người dùng:

| `CheckType` | Tên hiển thị |
|---|---|
| `official_domain` | Tên miền chính thức của thương hiệu |
| `lookalike` | Tên miền nhái |
| `punycode` | Ký tự ngụy trang (punycode) |
| `subdomain_brand` | Tên thương hiệu nằm trong tên miền phụ |
| `shortener` | Đường dẫn rút gọn |
| `ip_host` | Đường dẫn dùng địa chỉ IP |
| `risky_tld` | Đuôi tên miền hay bị lạm dụng |
| `domain_age` | Tuổi tên miền |
| `blocklist` | Danh sách đen đã biết |
| `verified_indicator` | Đã được đội vận hành xác minh |

Trường `detail` của phép kiểm là mã ngắn; UI dịch sang câu tiếng Việt trong `copy/vi.ts` (ví dụ `age_days:3` → "Đăng ký 3 ngày trước").

## 4. Component

Tự viết bằng React + Tailwind, không dùng bộ component ngoài (thêm bộ nào cũng phải hỏi owner). Biểu tượng là SVG inline tự vẽ (vài hình đơn giản), không thêm thư viện icon.

| Component | Mô tả | Ghi chú a11y |
|---|---|---|
| `Button` | primary / secondary / ghost; trạng thái loading khoá nút và đổi chữ | `aria-busy` khi loading; vùng bấm ≥ 44×44px trên điện thoại |
| `TextArea` + `CharCounter` | Ô nhập tin, bộ đếm `n/2.000` | Bộ đếm gắn `aria-describedby`; lỗi gắn `aria-invalid` |
| `SampleChips` | Các nút tin mẫu | Là `button`, không phải link |
| `VerdictBanner` | Nhãn + biểu tượng + câu giải nghĩa theo §3 | Nằm trong vùng `aria-live="polite"`; tiêu đề `h2` |
| `SourceBadge` | *Kiểm tra* / *AI nhận định* | Chữ đầy đủ, không chỉ màu |
| `SignalList` | Danh sách tín hiệu, mỗi dòng có `SourceBadge` | `ul` |
| `IndicatorCard` | Chỉ dấu + danh sách phép kiểm + `CheckStatus` | URL là văn bản thuần, `word-break: break-all`, không có `href` (P5) |
| `CheckStatus` | Cảnh báo / Không phát hiện vấn đề / Không tra được | Biểu tượng + chữ |
| `RedactionNotice` | Thông báo đã che dữ liệu | — |
| `Disclaimer` | Câu §3, dùng ở footer và dưới kết quả | — |
| `CodeWithCopy` | Mã hồ sơ / mã bí mật + nút sao chép | Thông báo "Đã sao chép" qua `aria-live` |
| `StatusBadge` | Trạng thái case | — |
| `SeedBadge` | "Dữ liệu mẫu" | — |
| `AiPanel` | Khung *Nhận định của AI*: nền `#F4F3FF`, tiêu đề có `SourceBadge` AI | `section` có `aria-labelledby` |
| `EvidencePanel` | Khung *Bằng chứng* | `section` có `aria-labelledby` |
| `DecisionForm` | Radio 3 kết luận + lý do bắt buộc | `fieldset` + `legend`; lỗi đọc được |
| `ConfirmDialog` | Hộp thoại gỡ chỉ dấu kèm lý do | Bẫy focus, `Esc` đóng, trả focus về nút gốc |
| `DataTable` | Bảng FraudOps có lọc, phân trang | `th scope`, trạng thái sắp xếp đọc được |
| `EmptyState`, `ErrorState`, `Skeleton` | Các trạng thái chung | Lỗi có nút thử lại |

## 5. Luật a11y và hiển thị

- Mục tiêu WCAG 2.1 AA. Mọi cặp màu chữ/nền mới phải tính lại tỉ lệ và ghi vào §2.
- Vòng focus 2px `--color-primary`, cách 2px, không bao giờ `outline: none` mà không thay thế.
- Toàn bộ thao tác làm được bằng bàn phím, theo thứ tự đọc.
- `lang="vi"` trên `html`.
- Tôn trọng `prefers-reduced-motion`: tắt cuộn mượt và hiệu ứng skeleton.
- Nội dung do người dùng gửi (tin nhắn, ghi chú) luôn hiển thị như văn bản, không render HTML hay Markdown, không tự tạo link.
