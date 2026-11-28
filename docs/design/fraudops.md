# Thiết kế slice S6: FraudOps (T-060…T-063)

**Trạng thái (28/11/2026):** **OWNER ĐÃ DUYỆT SLICE S6 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. Agent được viết mã cho slice này. **T-060…T-063 xong ở local 28/11** (đã merge vào `main` (PR #51, 28/11), chưa deploy; chỗ khác bản duyệt ở [§11](#11-ghi-chú-cài-đặt-28112026), **chờ owner xác nhận**). T-061…T-063 cần có case: lấy từ S5 hoặc seed (T-090).

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5, docs/README.md). Nó **không nhắc lại** những gì đã có ở các file dưới, chỉ bổ sung phần còn để ngỏ:
- [spec](../spec/ScamShield-v1.md): SO-06-AC01…AC06, SO-05-AC01, AC03, SO-10-AC02, AC03, P1.
- [api.md §4](../architecture/api.md#4-phía-fraudops): phiên, CSRF, đăng nhập, đăng xuất, kết luận.
- [data-model](../architecture/data-model.md) (cấp 3, **đã duyệt 21/11**): `decisions` §2.4, `staff_users` §2.5, `staff_sessions` §2.6, giao dịch kết luận §4, seed §7.
- [contracts §6](../architecture/contracts.md#6-hồ-sơ-casedetail-dùng-ở-fraudops): `CaseDetail`.
- [ui-pages §4–6](../product/ui-pages.md) và [pages.md §4–6](./pages.md): trạng thái và wireframe.
- [conventions/backend §7](../conventions/backend.md), [frontend §2](../conventions/frontend.md#2-server-và-client-component): scrypt, cookie, server component đọc thẳng `packages/core`.
- Hướng dẫn xác thực của Next.js bản ghim (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`).

Thay đổi cột, CHECK hay body của api.md là **quyết định của owner** (§9).

## 1. Kết quả cần có

Một giám khảo dùng `judge1` đăng nhập và thấy hàng đợi hồ sơ chờ xem xét. Họ mở một hồ sơ, thấy **Bằng chứng** tách khỏi **Nhận định của AI**, rồi chọn kết luận kèm lý do. Tải lại trang, đăng nhập lại hay mở từ máy khác, kết luận vẫn còn. Hai giám khảo kết luận cùng một hồ sơ thì chỉ người đầu tiên thắng; người sau thấy kết luận đó, không ghi đè. Không có nút hay API nào khoá tài khoản, chặn giao dịch hay liên hệ bên thứ ba (P1).

**Trong slice:**
- T-060: đăng nhập, đăng xuất, phiên, kiểm Origin, chặn truy cập `/ops`.
- T-061: danh sách hồ sơ.
- T-062: chi tiết hồ sơ.
- T-063: kết luận, xung đột 409, nhãn không đồng ý với AI.

**Ngoài slice:**
- hồ sơ liên quan (T-070, SO-07; P1, thứ 2 trong thứ tự cắt). Trong S6 `relatedCases` luôn rỗng và khối bị ẩn; T-070 điền sau (28/11), xem [related-cases](./related-cases.md).
- chỉ dấu đã xác minh (T-080, T-081, SO-08). Chỉ chừa móc nối ở §5.3.
- tạo tài khoản `judge1…judge5` và case mẫu (T-090, §8).

## 2. Kiểm quyền: một cửa duy nhất

Tài liệu Next.js bản ghim nói rõ:
- Layout **không** chạy lại khi chuyển trang phía client.
- Layout cũng không chặn được trang con render.
- Proxy (trước đây gọi là middleware) chỉ dùng cho kiểm tra lạc quan, không thay được kiểm phiên.

Vì vậy phiên phải được kiểm **sát nguồn dữ liệu**, không phải ở layout.

**Thiết kế:**
- `packages/core/src/auth` có `verifySession(token, deps) → StaffSession | null`. `StaffSession` là **kiểu có nhãn** (branded type): chỉ `verifySession` tạo ra được.
- Mọi hàm đọc hay ghi của FraudOps trong core **nhận `StaffSession` làm tham số đầu tiên**: `listCases(session, …)`, `getCaseDetail(session, …)`, `decideCase(session, …)`. Quên kiểm phiên thì **không typecheck được**.
- `apps/web/src/server/ops-session.ts` (`server-only`):
  - `requireStaffPage(nextPath)`: đọc cookie, gọi `verifySession`. Không có phiên thì `redirect("/ops/dang-nhap?next=…")`. Mỗi `page.tsx` dưới `/ops` gọi hàm này.
  - `requireStaffApi(request)`: không có phiên thì trả 401 `unauthorized`. Mỗi route `/api/ops/*`, trừ đăng nhập, gọi hàm này.
- Layout `/ops` chỉ **hiển thị** tên nhân viên và nút đăng xuất. Nó không dùng để chặn truy cập.
- Không dùng `proxy.ts` trong v1: thêm một lớp mà không thêm an toàn.

**Chống chuyển hướng mở (open redirect):** chỉ nhận `next` khi giá trị bắt đầu bằng `/ops`, không bắt đầu bằng `//`, và không có `\` hay scheme. Sai thì chuyển về `/ops`.

## 3. Đăng nhập, phiên, đăng xuất (T-060)

### 3.1 `POST /api/ops/session`

| # | Bước | Khi lỗi |
|---|---|---|
| 1 | Kiểm `Origin` (§3.3). Áp dụng cả cho đăng nhập, để chặn CSRF đăng nhập | 403 `forbidden_origin` |
| 2 | Rate limit, khoá `login:` + băm IP, **5 lượt/phút** (api.md đề xuất; OP-01) | 429 |
| 3 | Parse `{ username, password }`. `username` trim và viết thường; mật khẩu 1–200 ký tự | 400 |
| 4 | Đọc user theo `username` | Không có user, hoặc user có `disabled_at` → vẫn **chạy scrypt trên chuỗi băm giả**, rồi trả 401 `invalid_credentials` |
| 5 | `verifyPassword` (scrypt, `timingSafeEqual`) | 401 `invalid_credentials` |
| 6 | Sinh token 32 byte ngẫu nhiên; `INSERT staff_sessions` (lưu SHA-256 của token, `expires_at = now + 12 h`) | 500 |
| 7 | 204, kèm `Set-Cookie` | — |

- **Cookie:** tên `ops_session`; `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 12 giờ. `Secure` ở mọi môi trường trừ `next dev` (OP-02).
- **Hết hạn cố định 12 giờ,** không gia hạn khi đang dùng. Phiên demo ngắn, nên giữ đơn giản.
- **Dọn phiên hết hạn:** ở khoảng 1/50 lượt đăng nhập (chọn ngẫu nhiên), xoá dòng có `expires_at < now()`. Cùng cách với rate limit (data-model §2.7).
- Đăng nhập lần nữa thì tạo phiên mới. Phiên cũ vẫn dùng được tới khi hết hạn: một giám khảo có thể mở trên hai máy.

### 3.2 `verifySession` và đăng xuất

- `verifySession`: tính SHA-256 của token, tìm theo PK, kiểm `expires_at > now()` và user chưa bị `disabled_at`. Kết quả là `{ staffUserId, username, displayName }`. Một truy vấn có join.
- `DELETE /api/ops/session`: kiểm Origin → xoá dòng phiên (nếu có) → xoá cookie (`Max-Age=0`) → 204. Không có phiên hợp lệ thì trả 401 `unauthorized` như mọi route FraudOps khác (SO-06-AC01, api.md §4; sửa 28/11 cho khớp). Client coi 401 là đã đăng xuất.

### 3.3 Kiểm `Origin`

- Áp dụng cho mọi request `POST` và `DELETE` dưới `/api/ops/*`.
- So header `Origin` với origin của chính request: `request.nextUrl.origin`, tức scheme cộng host mà nền tảng nhận. Không thêm biến môi trường mới.
- Thiếu `Origin` hoặc lệch → 403. Trình duyệt hiện đại luôn gửi `Origin` cho request `POST` hay `DELETE` gọi bằng `fetch`.
- Cách lấy origin sau proxy của Vercel là **mục kiểm lúc deploy**.

## 4. Danh sách hồ sơ `/ops` (T-061)

- Server component gọi `listCases(session, query, deps)`. Theo api.md §1, không có `GET` API cho danh sách.
- **Query trên URL** (giữ khi tải lại, SO-06-AC05): `trang-thai` (`pending_review` | `closed` | `all`, mặc định `pending_review`), `verdict` (một `Verdict` hoặc bỏ trống), `ma` (mã hồ sơ), `trang` (≥ 1).
  - Parse bằng zod. Giá trị lạ **không** báo lỗi, chỉ rơi về giá trị mặc định.
- **Tìm theo mã:** chuẩn hoá bằng `normalizeCaseCode` của S5 (report-flow §4.2), so khớp **chính xác**. Khi có `ma`, **bỏ qua bộ lọc trạng thái** để luôn tìm ra hồ sơ dù đã đóng. Mã không chuẩn hoá được thì hiện "Không có hồ sơ khớp bộ lọc."
- **Sắp xếp và phân trang:** `created_at DESC, id DESC`, 25 dòng/trang, `OFFSET`. Có tổng số dòng để hiện "Trang x/y". Bảng chỉ vài chục tới vài trăm dòng, nên không cần phân trang theo con trỏ. Index có sẵn: `(status, created_at DESC)`, `(engine_verdict, created_at DESC)`.
- **Mỗi dòng** (`CaseListItem`): `caseCode`, `createdAt`, `engineVerdict`, `riskTypes`, `status`, `isSeed`, cộng `decision` nếu đã đóng (để hiện nhanh). Đọc từ các cột bản chụp trên `cases`, không join `analyses`.
- **Hiển thị:**
  - Thời gian định dạng `dd/MM HH:mm` theo `Asia/Ho_Chi_Minh`, tính **ở server**, để không lệch khi hydrate.
  - Mỗi dòng là một link thật tới `/ops/ho-so/SC-xxxx`, mở được bằng bàn phím.
  - Case seed có badge "Dữ liệu mẫu".
- **Trạng thái:** theo ui-pages §5. Phần "đang tải" dùng `loading.tsx` có skeleton. Phần "lỗi" dùng `error.tsx` có nút "Thử lại" (gọi `reset`).
- **Cắt việc** (plan §7 thứ 5): bỏ lọc và tìm, giữ sắp xếp mới nhất trước và phân trang.

**Nhãn `RiskType`** (đề xuất; design-system §3 chưa có):

| `RiskType` | Nhãn |
|---|---|
| `brand_impersonation` | Mạo danh thương hiệu |
| `otp_phishing` | Lừa lấy OTP |
| `payment_request` | Yêu cầu chuyển tiền |
| `fake_prize` | Trúng thưởng giả |
| `other` | Khác |

## 5. Chi tiết và kết luận `/ops/ho-so/[mã]` (T-062, T-063)

### 5.1 Đọc

- Server component gọi `getCaseDetail(session, caseCode, deps)` → `CaseDetail | null`. Kết quả `null` → `notFound()`, trang "Không tìm thấy hồ sơ SC-xxxx." kèm link về danh sách.
- `CaseDetail` là zod schema trong `packages/shared` (contracts §6). Phần `analysis` là `AnalysisResult` của S4 §4 (đã gồm `rule`); `redactedContent` là trường riêng của `CaseDetail` (sửa 28/11 cho khớp contracts §6).
- Dữ liệu jsonb được parse bằng zod khi đọc (DB-02). Parse lỗi thì ném lỗi, rơi vào `error.tsx`. Không render dữ liệu hỏng.

### 5.2 Hai khối (SO-05-AC03)

Theo ui-pages §6.1 và pages.md §6.1. Phần bổ sung:
- **Bằng chứng:** nội dung đã che, ghi chú, chỉ dấu kèm check, signal có `source = deterministic`, verdict của engine, loại rủi ro, quy tắc (nhãn R0…R9 ở design-system §3).
- **Nhận định của AI:** `aiSummary` (hoặc câu A-02 khi `null`), `nextSteps` dạng danh sách văn bản **không có nút**, signal có `source = ai`, và `explanation` của analysis.
- Dùng lại component của S4 (`SignalList`, `IndicatorCard`, `CheckStatus`, `SourceBadge`) và các bảng nhãn, câu `detail` (scamshield-ui §5). Không viết bộ thứ hai.
- Mọi chữ do người dùng hay LLM viết (nội dung, ghi chú, tóm tắt, bước tiếp theo, `evidence`) render như **văn bản**. URL không bấm được (P5).
- Bố cục hai cột từ 1024px, một cột ở dưới mức đó. Khối Bằng chứng luôn đứng trước khối AI theo thứ tự đọc.

### 5.3 Kết luận: `POST /api/ops/cases/{caseCode}/decision`

| # | Bước | Khi lỗi |
|---|---|---|
| 1 | Kiểm Origin | 403 |
| 2 | `requireStaffApi` | 401 |
| 3 | Parse `{ decision, reason }`. `reason` trim, độ dài 10–500 ký tự, đếm theo cùng luật đếm ký tự với S4 U-02 | 400, có `fields.reason` |
| 4 | `decideCase(session, caseCode, input, deps)`: một giao dịch theo data-model §4 | Không có case → 404. Đã đóng → 409 |
| 5 | 200 + `decision` | — |

- **`disagreesWithEngine`** = hàm thuần `disagreesWithEngine(decision, engineVerdict)` trong `packages/core/src/cases`, theo bảng đồng ý ở SO-06-AC04. Hàm này **làm TDD**, có đủ 12 cặp. Giá trị được lưu cùng `decisions.engine_verdict` (chụp từ `cases.engine_verdict`).
- **409 phải kèm kết luận hiện có** (api.md). Dạng lỗi chung (`{ error: { code, message, fields? } }`) chưa có chỗ cho dữ liệu này. Owner chốt OP-03 (b): 409 không kèm kết luận; client tải lại trang.
- **Móc nối SO-08:** S6 chỉ đánh dấu chỗ trong giao dịch (chú thích ở `cases/decide.ts`); S8 viết `recordConfirmedIndicators` trong `core/src/confirmed-indicators/` và gọi tại đó khi `decision = confirmed_scam`. S6 **không** tạo hàm rỗng, module hay bảng `confirmed_indicators` (sửa 28/11 cho khớp codebase.md §1: module chưa tới slice thì chưa tạo).
- `decidedBy` trả về `displayName` của nhân viên. `CaseDetail.decision` lấy tên qua join `staff_users`.

### 5.4 Trạng thái phía client của form kết luận

Form là component client duy nhất của trang (`features/cases/DecisionForm.tsx`).

| Tình huống | Hiển thị |
|---|---|
| 200 | `router.refresh()`: server component render lại, thay form bằng thẻ kết luận |
| 400 | Lỗi dưới ô lý do, lấy từ `fields.reason` |
| 409 | "Hồ sơ đã được người khác kết luận." Rồi `router.refresh()` để hiện thẻ kết luận của người kia, có tên và giờ (OP-03 b). Lý do đang gõ dở **vẫn giữ** trong ô (chỉ đọc), để người dùng sao chép nếu cần |
| 401 | Thông báo "Phiên đăng nhập đã hết hạn", rồi chuyển về `/ops/dang-nhap?next=<trang hiện tại>`. Lý do đang gõ **có thể mất**: ui-pages §4 đã chấp nhận điều này trong v1 |
| 404 | "Không tìm thấy hồ sơ." kèm link về danh sách |
| Mạng lỗi, 5xx | "Chưa lưu được kết luận. Hãy thử lại." Giữ nội dung form |

- Nút khoá trong lúc chờ. Nút **luôn bấm được**, kể cả khi lý do chưa đủ 10 ký tự: bấm thì hiện lỗi. Như vậy người dùng biết vì sao không lưu được.
- Có bộ đếm `n/500`. Chọn `confirmed_scam` khi đang khác verdict của engine thì **không** cảnh báo trước. Nhãn không đồng ý chỉ hiện sau khi lưu (SO-06-AC04).

## 6. Module

```ts
// packages/shared — vai C
CaseListQuery, CaseListItem, CaseListPage    // { items, page, totalPages }
CaseDetail                                   // contracts §6
DecisionRequest                              // { decision: Decision, reason: string }
DecisionRecord                               // { decision, reason, decidedBy, decidedAt, disagreesWithEngine }
LoginRequest                                 // { username, password }

// packages/core/src/auth — vai C
hashPassword(pw: string): Promise<string>
verifyPassword(pw: string, hash: string): Promise<boolean>
login(req: LoginRequest, deps): Promise<{ token: string; expiresAt: Date } | null>   // null = sai thông tin
verifySession(token: string, deps): Promise<StaffSession | null>
logout(token: string, deps): Promise<void>

// packages/core/src/cases — vai C
listCases(session: StaffSession, q: CaseListQuery, deps): Promise<CaseListPage>
getCaseDetail(session: StaffSession, caseCode: string, deps): Promise<CaseDetail | null>
decideCase(session: StaffSession, caseCode: string, req: DecisionRequest, deps):
  Promise<{ kind: "decided"; decision: DecisionRecord }
        | { kind: "conflict"; decision: DecisionRecord }
        | { kind: "not_found" }>
disagreesWithEngine(decision: Decision, verdict: Verdict): boolean
```

- Trang ở `apps/web/src/app/ops/`: `dang-nhap/page.tsx`, `page.tsx`, `ho-so/[code]/page.tsx` (vai B). Route ở `apps/web/src/app/api/ops/` (vai C).
- `StaffSession` không mang secret và không đi xuống client. Client chỉ nhận `displayName` để hiện ở header.

## 7. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Unit `disagreesWithEngine` (TDD) | Đủ 12 cặp (3 kết luận × 4 verdict) theo SO-06-AC04 |
| Unit kiểm `next` | `/ops/ho-so/SC-0101` → giữ; `//evil.example`, `https://evil.example`, `/\evil`, `/abc` → `/ops` |
| Unit kiểm Origin | Khớp, lệch, thiếu |
| Int `auth` (Postgres local) | Đăng nhập đúng tạo phiên; DB chỉ chứa băm của token; sai mật khẩu, sai user, user bị khoá → `null`; phiên hết hạn hoặc user bị khoá → `verifySession` ra `null`; `logout` xoá phiên |
| Int `decideCase` | Đóng case, ghi decision, lưu `engine_verdict` và `disagrees_with_engine`; **hai lời gọi song song chỉ một bên `decided`**, bên kia `conflict` kèm kết luận của bên thắng; lý do 9 ký tự bị từ chối (cả CHECK của DB) |
| Int `listCases` | Mặc định chỉ `pending_review`, mới nhất trước; lọc verdict; tìm theo mã bỏ qua lọc trạng thái; trang 2 |
| Route | Mọi `/api/ops/*` trừ đăng nhập: không cookie → 401; `POST` lệch Origin → 403; 409 không kèm kết luận (OP-03 b) |
| **Bất biến P1** (SO-06-AC06) | Test liệt kê mọi file `route.ts` dưới `apps/web/src/app/api`, so với bảng endpoint ở api.md §2. Thêm endpoint mà không sửa api.md thì test đỏ |
| Kiểm tay | Ảnh 1280px: danh sách, chi tiết chờ, chi tiết đã đóng có nhãn không đồng ý, xung đột với hai tài khoản ở hai trình duyệt; tải lại vẫn còn kết luận (SO-06-AC05); làm hết bằng bàn phím |

## 8. Phụ thuộc

| Cần | Ai | Ghi chú |
|---|---|---|
| Tài khoản nhân viên để test tay | C | Test tích hợp tự chèn user. Test tay trước khi có T-090 thì cần một lệnh tạo user ở máy local (OP-04) |
| Case để xem | C | S5 (T-050) hoặc seed (T-090). T-061, T-062 làm trước được bằng case chèn trong test tích hợp |
| Component và bảng nhãn của S4 | B | `SignalList`, `IndicatorCard`, bảng nhãn signal và `detail` |
| `normalizeCaseCode` của S5 | C | Tìm theo mã |

## 9. Quyết định (owner chốt 26/11/2026)

Tiền tố `OP-` (FraudOps, slice S6), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| OP-01 | Hạn mức đăng nhập | 5 lượt/phút theo băm IP (api.md đề xuất). Giám khảo ngồi chung một mạng (cùng IP NAT) có thể chạm hạn mức khi cùng gõ sai | 5 lượt/phút/IP; tăng lên 10 nếu buổi chấm dùng chung mạng · **Owner chốt 26/11** |
| OP-02 | Cờ `Secure` khi chạy `next dev` trên `http://localhost` | (a) Bật ở mọi môi trường trừ `next dev`. (b) Luôn bật: Chrome vẫn chấp nhận trên localhost, nhưng Safari thì có thể không | (a) · **Owner chốt 26/11** |
| OP-03 | Dạng body của 409 (api.md: "kèm kết luận hiện có") | (a) Thêm trường tuỳ chọn `details` vào `ApiError`: `{ error: { code, message, details: { decision } } }`; sửa conventions/contracts §4 và `errors.ts`. (b) Không kèm; client `router.refresh()` để đọc lại: không đổi hợp đồng, nhưng câu "đã được {tên} kết luận" phải đợi trang tải lại | (b): đơn giản hơn, và trang tải lại vẫn hiện tên người kết luận trên thẻ. Nếu chọn (b), sửa dòng 409 trong api.md · **Owner chốt 26/11** |
| OP-04 | Tạo tài khoản nhân viên trước khi có T-090 | (a) Làm phần `judge1…judge5` của `demo:seed` sớm, ngay trong T-060. (b) Thêm lệnh `ops:create-user` riêng | (a): không thêm lệnh mới, chỉ đổi thứ tự trong T-090 · **Owner chốt 26/11** |

## 10. Rủi ro

- **Lịch:** plan đặt T-060 ở 25–26/11 và T-061…T-063 ở 27–28/11. T-060 không bị S3 chặn, nên là việc nên bắt đầu sớm nhất trong S6.
- **Origin sau proxy của Vercel:** nếu `request.nextUrl.origin` trên Vercel không khớp `Origin` trình duyệt gửi, mọi thao tác ghi của FraudOps trả 403. Phải kiểm ngay ở bản deploy đầu tiên.
- **Next 16:** `cookies()`, `redirect()`, `notFound()` và `router.refresh()` có thể khác bản cũ. Đọc tài liệu đi kèm trong `node_modules/next/dist/docs/` khi viết mã.

## 11. Ghi chú cài đặt (28/11/2026)

T-060. **Chờ owner xác nhận** các chỗ khác hoặc thêm so với bản duyệt:

- **Kiểm Origin (§3.3):** so `Origin` với scheme (`x-forwarded-proto`, mặc định theo `request.url`) cộng header `Host`, **không** dùng `request.nextUrl.origin`. Lý do: với `next start` ở local, `request.url` mang địa chỉ server đang lắng nghe (`0.0.0.0:3160`), không phải host trình duyệt gọi, nên mọi lượt ghi cùng origin đều bị 403 (kiểm 28/11). Trang ở site khác không đặt được `Origin` hay `Host`.
- **`server-only`:** không import, vì gói chưa có trong repo và không thêm thư viện cho việc này. `ops-session.ts` dùng `next/headers`, chỉ chạy được ở server.
- **Header FraudOps** nằm ở nhóm route `app/ops/(staff)/`, nên trang đăng nhập không có header. Header chỉ có mục "Hồ sơ"; mục "Chỉ dấu đã xác minh" thêm khi có trang (S8).
- **scrypt** chuyển sang `packages/core/src/crypto/`, dùng chung cho mã bí mật (S5) và mật khẩu; định dạng băm không đổi.
- **`demo:seed`** mới chỉ tạo `judge1…judge5` (OP-04 a). Mật khẩu được bỏ khoảng trắng đầu cuối và không chứa dấu phẩy. Tài khoản đã bị khoá vẫn khoá. Đổi mật khẩu **không** huỷ phiên đang mở (hết hạn sau tối đa 12 giờ).
- **Câu chữ mới** (`copy/vi.ts`, khối `ops`): "Trang xử lý hồ sơ của đội vận hành.", "Đang đăng xuất…", "Chưa đăng xuất được. Hãy thử lại.", "Đang đăng nhập…", "Hãy nhập tên đăng nhập và mật khẩu.", "Chưa đăng nhập được do lỗi kết nối. Hãy thử lại."

**Đã kiểm 28/11 ở local** (DB tạm trên Postgres Docker, mật khẩu ngẫu nhiên, xoá sau khi kiểm):
- `npm run verify` (có test tích hợp) và `next build` xanh.
- `next start` + `curl`: `/ops` không phiên → 307 tới đăng nhập; `DELETE` không phiên → 401; sai Origin → 403; sai mật khẩu → 401; đúng → 204 và cookie; đăng xuất rồi dùng cookie cũ → bị chuyển về đăng nhập; lượt thứ 6 trong một phút từ một IP → 429; gọi qua `localhost`, `127.0.0.1`, IP LAN đều được. Header giả lập proxy HTTPS → 204.
- `next dev`: cookie không có `Secure`.
- Edge headless: chuyển hướng, lỗi trống và sai mật khẩu, quay lại `next`, tải lại vẫn đăng nhập, đăng xuất bằng bàn phím, `next` trỏ site khác về `/ops`; không có lỗi console; 1280px và 360px không cuộn ngang. JavaScript không đọc được cookie.

**Chưa kiểm:** bản deploy (host và `x-forwarded-proto` sau proxy Vercel, `x-forwarded-for`), Safari, trình đọc màn hình, thời gian phản hồi sai tên so với sai mật khẩu (mới đọc mã: luôn chạy scrypt). **SO-06-AC01 phần "API trả 401":** hiện chỉ có `DELETE /api/ops/session`; route kết luận (T-063) và gỡ chỉ dấu (S8) phải gọi `requireStaffApi` và có test riêng.

### T-061 danh sách hồ sơ

**Chờ owner xác nhận:**
- **Đang tải (§4):** không dùng `loading.tsx` mà đặt `<Suspense>` trong trang, sau khi đã kiểm phiên. `loading.tsx` làm response bắt đầu stream trước khi kiểm, nên người chưa đăng nhập nhận 200 kèm chuyển hướng phía client thay vì 307. T-062 nên làm giống vậy (cả `notFound()` cũng bị ảnh hưởng).
- **Lỗi (§4):** nút "Thử lại" gọi `retry` thay vì `reset`. Ở Next 16.4, `retry` mới đọc lại dữ liệu. `error.tsx` nằm ở `ops/(staff)/` và ghi "Không tải được danh sách."; T-062 cần `error.tsx` riêng cho trang chi tiết. Layout bỏ qua lỗi kiểm phiên (chỉ ẩn header) để lỗi hiện ở error boundary của trang.
- **`CaseListPage` (§6)** có thêm `hasAnyCase`, để phân biệt "Chưa có hồ sơ nào." với "Không có hồ sơ khớp bộ lọc.". `trang` lớn hơn số trang thì trả trang cuối.
- **"Xoá bộ lọc"** dẫn tới `/ops?trang-thai=all` (bỏ mọi bộ lọc), không về mặc định: mặc định có thể chính là màn đang trống.
- **Tìm theo mã** bỏ qua lọc trạng thái nhưng **vẫn áp** lọc verdict, đúng chữ §4.
- Form lọc là GET (`next/form`) có nút "Lọc", không tự gửi khi đổi ô chọn. Bấm vào dòng cũng mở hồ sơ (phím và trình đọc màn hình dùng link ở cột mã).
- **Câu chữ mới:** "Lọc hồ sơ", "Khi tìm theo mã, bộ lọc trạng thái được bỏ qua.", "Lọc", "Phân trang", "Đang tải danh sách…".
- Lỗi khi tra phiên được ném lại thành `session_lookup_failed`, để log của Next không chứa câu truy vấn và băm token.

**Đã kiểm 28/11 ở local** (DB tạm 31 hồ sơ chèn bằng SQL, xoá sau khi kiểm): `npm run verify` và `next build` xanh; Edge headless: mặc định 25 dòng mới nhất, trang 2, tải lại giữ trang, lọc, tìm hồ sơ đã đóng bằng số, không khớp, xoá bộ lọc, bấm dòng, Tab rồi Enter, skeleton khi bảng `cases` bị khoá, lỗi truy vấn và lỗi tra phiên rồi "Thử lại", DB trống; chưa đăng nhập vẫn 307 và giữ query trong `next`; không lỗi console; trang không cuộn ngang ở 360px.

**Chưa có / chưa kiểm:** `/ops/ho-so/[mã]` chưa có (T-062), nên link hồ sơ ra trang 404. Hồ sơ mẫu thật là T-090, nên SO-10-AC03 mới kiểm phần badge. Chưa kiểm bản deploy, Safari, trình đọc màn hình. Bề rộng tối thiểu của bảng (thêm sau lượt chụp) chỉ kiểm bằng build.

### T-062 chi tiết hồ sơ

**Chờ owner xác nhận:**
- **Không có trạng thái đang tải** (ui-pages §6 không yêu cầu): không `loading.tsx`, không `Suspense`, để chưa đăng nhập nhận 307 và mã không tồn tại nhận 404 thật. Đổi lại, khi chuyển từ danh sách sang, màn cũ đứng yên cho tới khi hồ sơ đọc xong.
- **Trang không tìm thấy:** đọc mã từ địa chỉ bằng `useParams`, chỉ nhắc lại khi đúng dạng `SC-…`; chuỗi khác thì ghi "Không tìm thấy hồ sơ.", tránh hiện chữ bất kỳ từ URL.
- **Khối Bằng chứng** thêm thông báo đã che, và câu "Bước phân tích bằng AI chưa chạy được…" khi `high_risk` kèm lý do (P-01). Các câu lý do `inconclusive` khác không hiện vì viết cho người gửi ("hãy thử lại"); quy tắc kích hoạt đã nói lý do.
- **Dùng chung `toViewModel` của S4**, nên chỉ dấu loại `brand` không có thẻ riêng; khối Bằng chứng liệt kê chúng thành một dòng "Thương hiệu được nhắc tới: …" (sửa sau review 28/11: tin không có đường dẫn thì không có phép kiểm nào nhắc tới thương hiệu). Khuyến nghị cho người gửi không hiện.
- `CaseDetail` nằm ở `packages/shared/src/case.ts`, không phải `ops.ts`, để schema đầu ra LLM không vào bundle trình duyệt.
- Dữ liệu lưu không parse được: log `case_detail_invalid` kèm mã hồ sơ, trang lỗi, không render một phần.
- **Chưa hiện kết luận** của hồ sơ đã đóng (đọc rồi nhưng chưa vẽ): form và thẻ là T-063.
- **Câu chữ mới:** "Ghi chú của người báo cáo", "Không có ghi chú.", "Giải thích đã hiện cho người dùng", "qua email", "qua kênh khác", "Không tìm thấy hồ sơ.", "Về danh sách hồ sơ", "Không tải được hồ sơ.".

**Đã kiểm 28/11 ở local** (DB tạm, xoá sau khi kiểm): `npm run verify` và `next build` xanh. Ba hồ sơ tạo qua `POST /api/analyses` và `/report` thật, **không gọi model** (key giả, trần lượt LLM đã hết); tóm tắt AI, một signal AI và một dòng dữ liệu hỏng được sửa bằng SQL. `curl`: chưa đăng nhập 307 giữ `next`, mã không có 404, dữ liệu hỏng 500, không link ra ngoài, mã OTP không có trong trang. Edge headless: hai cột ở 1280px, một cột ở 800px (Bằng chứng trên), không cuộn ngang tới 360px, từ danh sách vào, Tab tới "‹ Danh sách", trang không tìm thấy, trang lỗi rồi "Thử lại", không lỗi console.

**Chưa kiểm:** bản deploy; hồ sơ có tóm tắt do model thật viết; hai trạng thái `high_risk` kèm lý do và giải thích AI mới kiểm bằng test render; Safari; trình đọc màn hình.

### T-063 kết luận

**Chờ owner xác nhận:**
- **Xung đột (§5.4, ui-pages §6.2):** trong lúc tải lại hiện "Hồ sơ đã được người khác kết luận."; khi thẻ kết luận về thì đổi thành "Hồ sơ đã được {tên} kết luận lúc {ngày giờ}.", khớp cả hai tài liệu. Ô "Lý do bạn đang viết (chưa lưu)" chỉ đọc.
- Lý do được lưu **sau khi chuẩn hoá** (cùng `standardizeText` dùng để đếm), nên số ký tự đã đếm và đã lưu là một.
- Hết phiên: hiện thông báo 2 giây rồi mới chuyển tới đăng nhập.
- Hồ sơ biến mất (404): thông báo và link về danh sách nằm dưới form, form vẫn còn.
- Dòng nhắc của SO-08 trên form chưa có, vì SO-08 chưa nằm trong bản build.
- **Câu chữ mới:** "Chọn kết luận", "Hãy chọn một kết luận.", "Lý do cần từ 10 đến 500 ký tự.", "Đang lưu…", "Hồ sơ đã được {tên} kết luận lúc {ngày giờ}.", "Lý do bạn đang viết (chưa lưu)".

**Đã kiểm 28/11 ở local** (DB tạm, xoá sau khi kiểm, không gọi model): `npm run verify` và `next build` xanh. Test: đủ 12 cặp đồng ý/khác (viết test trước), hai kết luận đồng thời (5 vòng), rollback khi DB từ chối, route 401/403/400/404/409/200/500, và test P1 so danh sách `route.ts` với bảng api.md §2. `curl`: 401, 403, 400, 404, 200, 409, hai lệnh song song ra một 200 một 409, người báo cáo tra thấy kết luận mới. Edge headless với hai tài khoản: lỗi nhập, lưu hoàn toàn bằng bàn phím, tải lại vẫn còn, xung đột, danh sách chờ không còn hồ sơ, lỗi server giữ nội dung rồi gửi lại được, hồ sơ bị xoá, hết phiên rồi đăng nhập quay lại đúng hồ sơ.

**Chưa kiểm:** bản deploy; Safari; trình đọc màn hình; đăng nhập lại từ thiết bị khác (SO-06-AC05 mới kiểm bằng tải lại và đọc từ phiên khác trong test).

### Sửa sau review (28/11/2026)

**Chờ owner xác nhận** cùng các mục trên:
- Khối Bằng chứng có dòng "Thương hiệu được nhắc tới: …" (SO-05-AC01).
- Hồ sơ `closed` mà không có dòng `decisions` (S6 không tạo ra được; seed sai thì có thể) không hiện form, chỉ ghi "Hồ sơ đã đóng nhưng không có kết luận được lưu.".
- Form kết luận bị từ chối thì focus chuyển tới ô sai đầu tiên (nhóm lựa chọn, rồi lý do), để trình đọc màn hình đọc câu lỗi.

**Sửa lỗi, không phải đổi thiết kế:** `username` chứa NUL từng làm Postgres ném lỗi và route trả 500; nay mọi ký tự điều khiển hoặc surrogate lẻ trong `username` trả 400 (api.md §4). Mật khẩu không đổi luật.

**Đã kiểm 28/11:** test mới viết trước và thấy đỏ; `npm run verify` và `next build` xanh; trên DB tạm: NUL trả 400, tin chỉ có "MoMo" hiện dòng thương hiệu, focus và mô tả trong cây accessibility của Edge đúng ô và đúng câu lỗi, hồ sơ đóng thiếu kết luận không có form. **Chưa kiểm** bằng trình đọc màn hình thật.

