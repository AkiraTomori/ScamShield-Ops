# ScamShield Ops — Design system

**Trạng thái (27/11/2026):** BẢN NHÁP; §2 ghi cách nối token (T-040), §4 ghi cách khoá nút khi chờ (T-041); §3 nhận bảng nhãn tín hiệu và câu mã `detail` (T-042); §4 `IndicatorCard` đổi sang `overflow-wrap: anywhere` cho khớp scamshield-ui §5.2 và mã (sửa 27/11 theo owner); đã merge (PR #48), chưa deploy; §3 nhận câu của form báo cáo và trang tra cứu (S5, 27/11, chưa merge, chờ owner duyệt câu mới). Token, component, câu chữ và luật a11y dùng cho cả ScamShield và FraudOps. Trang và trạng thái ở [ui-pages.md](./ui-pages.md). Mục ghi *(đề xuất, chờ owner)* chưa được duyệt.

## 1. Nguyên tắc thị giác

- **Trung tính, không mượn nhận diện của ai.** Không dùng logo, màu hồng/magenta nhận diện của MoMo hay màu của ngân hàng, ví nào (spec §9). Tên thương hiệu chỉ xuất hiện như nội dung được phân tích.
- **Không có màu "an toàn".** Không dùng xanh lá cho bất kỳ verdict nào. Mức thấp nhất `no_signal` dùng xanh dương thông tin, không phải xanh lá.
- **Không bao giờ chỉ dựa vào màu.** Mọi verdict, trạng thái phép kiểm và badge nguồn đều có biểu tượng + chữ.
- **Bằng chứng và AI tách bằng thị giác.** Nội dung *AI nhận định* luôn có badge tím và nền riêng; *Kiểm tra* dùng badge xanh ngọc.

## 2. Token

Dùng **Tailwind CSS** (owner chốt 20/11/2026). Token khai báo **một lần** dưới dạng CSS custom properties trong file CSS global và nối vào theme Tailwind, để class Tailwind và CSS thường dùng cùng giá trị; không khai báo bảng màu thứ hai trong file cấu hình. Cách nối cụ thể theo phiên bản Tailwind ghim lúc scaffold. Chỉ có giao diện sáng trong v1.

**Cách nối (T-040, Tailwind v4):** token khai báo trong `@theme` ở `apps/web/src/styles/globals.css`; không có file cấu hình Tailwind. Bảng màu và thang cỡ chữ mặc định của Tailwind bị xoá (`--color-*: initial`, `--text-*: initial`), nên không có class xanh lá hay cỡ chữ ngoài bảng. Tên màu verdict: `--color-verdict-<high-risk|suspicious|no-signal|inconclusive>` và `…-bg`; badge nguồn: `--color-source-<check|ai>` và `…-bg`.

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

**Chữ trạng thái phép kiểm** trên nền trắng (tính 27/11): *Cảnh báo* `#B54708` 5,43; *Không tra được* `#344054` 10,46; *Không phát hiện vấn đề* dùng `--color-text-muted` (7,69).

**Chữ:** font **Be Vietnam Pro** (U-01, owner chốt 26/11), nạp bằng `next/font` (tự host lúc build, không gọi Google Fonts lúc chạy), dự phòng `system-ui, sans-serif`. Font đơn cách cho nội dung tin nhắn gốc: `ui-monospace, monospace`. Font này phải ghi vào bảng tài sản có sẵn ở README khi dùng.

| Token | Cỡ / dòng | Dùng cho |
|---|---|---|
| `--text-xs` | 12 / 16 | Badge |
| `--text-sm` | 14 / 20 | Chú thích, bảng FraudOps |
| `--text-md` | 16 / 24 | Chữ thân, ô nhập (≥ 16px để iOS không tự phóng to) |
| `--text-lg` | 20 / 28 | Tiêu đề khối |
| `--text-xl` | 24 / 32 | Nhãn verdict, tiêu đề trang |

**Khoảng cách:** thang 4px (`--spacing` = 4px; class `p-1` = 4px … `p-8` = 32px). **Bo góc:** 6px cho ô nhập/nút (`rounded-control`), 10px cho thẻ (`rounded-card`). **Điểm ngắt:** < 640px một cột (ScamShield); ≥ 1024px hai cột cho chi tiết hồ sơ FraudOps. ScamShield phải dùng được ở 360px không cuộn ngang.

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

**Báo cáo và tra cứu** (S5). Câu của form và màn thành công theo [ui-pages §2.4](./ui-pages.md#24-gửi-báo-cáo) và [report-flow §5](../design/report-flow.md#5-giao-diện-t-051-t-052). Các câu dưới đây thêm khi viết mã, **chờ owner duyệt**:

| Chỗ dùng | Câu |
|---|---|
| `pending_review` (giải nghĩa) | "Đội vận hành đã nhận báo cáo và chưa có kết luận." |
| `confirmed_scam` (wireframe pages §3) | "Đội vận hành đã xem xét và xác nhận tin nhắn này là lừa đảo." |
| `not_scam` | "Đội vận hành đã xem xét và không phát hiện lừa đảo. Hãy vẫn xác minh qua kênh chính thức." |
| `insufficient_evidence` | "Đội vận hành đã xem xét nhưng chưa đủ bằng chứng để kết luận. Hãy thận trọng." |
| Chưa chọn kênh; ghi chú quá dài | "Hãy chọn nơi bạn nhận tin." · "Ghi chú tối đa 500 ký tự." |
| Thiếu mã; lỗi mạng khi tra cứu | "Hãy nhập cả mã hồ sơ và mã bí mật." · "Chưa tra cứu được do lỗi kết nối. Hãy thử lại." |

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

**Nhãn tín hiệu** (`SignalType`; chuyển từ scamshield-ui §5.1 khi viết T-042). Nhãn mô tả tin nhắn, không gọi ai là kẻ lừa đảo (P1).

| `SignalType` | Nhãn |
|---|---|
| `claims_organization` | Tin xưng danh một tổ chức *(đã có, P-07)* |
| `urgency` | Tạo áp lực thời gian |
| `threat` | Đe doạ khoá tài khoản, phạt hoặc kiện |
| `credential_request` | Đòi mã OTP, mật khẩu hoặc thông tin thẻ |
| `payment_request` | Yêu cầu chuyển tiền hoặc đóng phí |
| `reward_promise` | Hứa trúng thưởng, hoàn tiền hoặc lợi nhuận |
| `ai_directed_instruction` | Có câu tìm cách điều khiển hệ thống kiểm tra |
| `brand_domain_mismatch` | Tên miền không thuộc thương hiệu được nhắc tới |
| `lookalike_domain` | Tên miền giống tên miền chính thức |
| `brand_in_subdomain` | Tên thương hiệu nằm trong tên miền phụ |
| `shortened_url` | Dùng đường dẫn rút gọn |
| `ip_url` | Đường dẫn dùng địa chỉ IP |
| `risky_tld` | Đuôi tên miền hay bị lạm dụng |
| `new_domain` | Tên miền mới đăng ký gần đây |
| `blocklisted_url` | Đường dẫn có trong danh sách đen đã biết |
| `verified_indicator` | Chỉ dấu này đã được đội vận hành xác minh là lừa đảo *(nguyên văn SO-08-AC02)* |

**Câu cho mã `detail`** (chuyển từ scamshield-ui §5.3; câu phụ thuộc cả phép kiểm, trạng thái và mã; tổ hợp ngoài bảng thì không hiện detail, không bao giờ in mã thô). Tên thương hiệu lấy từ `brands.json`.

| Phép kiểm | Trạng thái | Mã | Câu | Nguồn mã |
|---|---|---|---|---|
| `official_domain` | `warn` | `brand:<id>` | "Không thuộc tên miền chính thức của {tên thương hiệu}" | pipeline §6.5 |
| `official_domain` | `pass` | `brand:<id>` | "Thuộc tên miền chính thức của {tên thương hiệu}" | pipeline §6.5 |
| `lookalike` | `warn` | `nearest:<tên miền>:distance_<n>` | "Gần giống {tên miền}, khác {n} ký tự" | pipeline §6.5 |
| `lookalike` | `warn` | `contains:<bí danh>` | "Chứa tên thương hiệu “{bí danh}”" | pipeline §6.5 |
| `punycode` | `warn` | `decoded:<dạng Unicode>` | "Hiển thị thành: {dạng Unicode}" | pipeline §6.5 |
| `domain_age` | `warn` hoặc `pass` | `age_days:<n>` | "Đăng ký {n} ngày trước" | contracts §4, design-system §3 |

- `nearest:…:distance_0` (tên trùng, khác đuôi; pipeline N-06): **chưa có câu**, hiện không hiện detail vì "khác 0 ký tự" gây hiểu sai. Đề xuất chờ owner: "Trùng tên với {tên miền} nhưng khác phần đuôi".
- `contains:` trên `subdomain_brand` không có trong bảng nên không hiện detail.

**Khối kết quả** (wireframe [pages §2.2](../design/pages.md)): tiêu đề "Vì sao", "Dấu hiệu phát hiện", "Đường dẫn, số điện thoại, tài khoản", "Nên làm gì". Mục tín hiệu và mục chỉ dấu luôn hiện; rỗng thì ghi nguyên văn [ui-pages §2.3](./ui-pages.md#23-khối-kết-quả): "Chưa phát hiện tín hiệu nào", "Không tìm thấy đường dẫn, số điện thoại hay số tài khoản" (chỉ dấu `brand` không tính). Thông báo che chỉ liệt kê loại đã che, nối bằng " / ": "Đã che mã OTP / mật khẩu / số thẻ trong nội dung trước khi phân tích." Chữ `--color-text` trên nền khối AI `#F4F3FF`: 16,15.

## 4. Component

Tự viết bằng React + Tailwind, không dùng bộ component ngoài (thêm bộ nào cũng phải hỏi owner). Biểu tượng là SVG inline tự vẽ (vài hình đơn giản), không thêm thư viện icon.

| Component | Mô tả | Ghi chú a11y |
|---|---|---|
| `Button` | primary / secondary / ghost; trạng thái loading khoá nút và đổi chữ | `aria-busy` khi loading; khoá bằng `aria-disabled` và chặn click (không dùng `disabled`, để giữ focus); vùng bấm ≥ 44×44px trên điện thoại |
| `TextArea` + `CharCounter` | Ô nhập tin, bộ đếm `n/2.000` | Bộ đếm gắn `aria-describedby`; lỗi gắn `aria-invalid` |
| `SampleChips` | Các nút tin mẫu | Là `button`, không phải link |
| `VerdictBanner` | Nhãn + biểu tượng + câu giải nghĩa theo §3 | Nằm trong vùng `aria-live="polite"`; tiêu đề `h2` |
| `SourceBadge` | *Kiểm tra* / *AI nhận định* | Chữ đầy đủ, không chỉ màu |
| `SignalList` | Danh sách tín hiệu, mỗi dòng có `SourceBadge` | `ul` |
| `IndicatorCard` | Chỉ dấu + danh sách phép kiểm + `CheckStatus` | URL là văn bản thuần, `overflow-wrap: anywhere` (class `wrap-anywhere`; chỉ ngắt giữa từ khi chuỗi không vừa dòng, không như `break-all`), không có `href` (P5) |
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
