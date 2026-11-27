# Thiết kế slice S5: gửi báo cáo và tra trạng thái (T-050…T-053)

**Trạng thái (27/11/2026):** **OWNER ĐÃ DUYỆT SLICE S5 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. **T-053, T-050, T-051, T-052 xong ở local 27/11** (nhánh `feat/s5-report`, commit `7a03690`, chưa merge, chưa deploy). Đã kiểm ở local 27/11, kết quả ở [§13](#13-kết-quả-kiểm-27112026). Chỗ cài đặt khác hoặc thêm so với bản duyệt ở [§12](#12-ghi-chú-cài-đặt-27112026), **owner xác nhận 27/11**. Ghi chú có thêm luật che RP-06 (owner chốt 27/11, §3.1).

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5, docs/README.md). Nó **không nhắc lại** những gì đã có ở các file dưới, chỉ bổ sung phần còn để ngỏ:
- [spec](../spec/ScamShield-v1.md): SO-04-AC01…AC04, SO-05-AC01, AC02, SO-01-AC03, SO-03-AC05, P1, Q-05.
- [api.md §3](../architecture/api.md#3-phía-công-khai): `POST /api/analyses/{id}/report`, `POST /api/case-status`.
- [data-model](../architecture/data-model.md) (cấp 3, **đã duyệt 21/11**): bảng `cases` §2.3, giao dịch §4, mã hồ sơ §5, băm §6.
- [contracts](../architecture/contracts.md): `PublicCaseStatus` §1, `LlmCaseSummaryOutput` §7, A-02.
- [ui-pages §2.4, §3](../product/ui-pages.md) và [pages.md §2.3, §3](./pages.md): trạng thái và wireframe của form báo cáo và `/tra-cuu`.
- [scamshield-ui.md](./scamshield-ui.md) (S4): state machine của trang `/`. File này **sửa** một chỗ ở đó (§5).

Thay đổi cột, CHECK hay body của api.md là **quyết định của owner** (§10), không phải lựa chọn thiết kế.

## 1. Kết quả cần có

- **Gửi báo cáo:** người dùng vừa nhận kết quả bấm "Gửi báo cáo cho đội vận hành", chọn kênh và thêm ghi chú nếu muốn. Họ nhận được **mã hồ sơ** và **mã bí mật**, chỉ hiện một lần.
- **Phía FraudOps:** có một case `pending_review` kèm tóm tắt AI. Nếu AI lỗi thì vẫn có case, chỉ thiếu tóm tắt (A-02).
- **Tra trạng thái:** ở `/tra-cuu`, nhập đúng cả hai mã thì thấy một trong bốn trạng thái. Nhập sai thì không biết được hồ sơ có tồn tại hay không.

**Trong slice:**
- T-050: route report, tạo case, tóm tắt AI, chống trùng (vai C; riêng hàm tóm tắt là vai A).
- T-051: form báo cáo và màn có mã (vai B).
- T-052: `POST /api/case-status` và trang `/tra-cuu` (P1, **thứ 4** trong thứ tự cắt ở plan §7).

**Ngoài slice:**
- hiển thị case ở FraudOps (T-061, T-062)
- mã bí mật của case mẫu (T-090, §9)

## 2. `POST /api/analyses/{analysisId}/report`

### 2.1 Thứ tự và ngân sách

| # | Bước | Khi lỗi |
|---|---|---|
| 1 | Rate limit, dùng chung khoá với `/api/analyses` (api.md §5) | 429, dừng |
| 2 | Parse `analysisId` (UUID) và body bằng `ReportRequest` (zod, `packages/shared`). Kênh ∈ `ReportChannel`; ghi chú ≤ 500 ký tự, đếm theo cùng luật với nội dung tin (S4 U-02) | 400 `validation_failed` |
| 3 | Đọc analysis | Không có → 404 `not_found` |
| 4 | **Đã có case cho analysis này** → 200 `{ caseCode, secretCode: null, alreadyReported: true }` | Không gọi LLM |
| 5 | Che ghi chú bằng `redact` (§3.1) | — |
| 6 | `summarizeCase`: hạn **8 giây** (RP-03), ngoài giao dịch | Lỗi, quá hạn hoặc không qua bộ lọc → `aiSummary = null`, **vẫn tạo case** (A-02) |
| 7 | Sinh mã bí mật (§4.1), băm scrypt | — |
| 8 | Một giao dịch: `INSERT cases` (bản chụp `engine_verdict`, `risk_types`) | 23505 trên `analysis_id` → đọc case đã có, trả 200 `alreadyReported: true`. Lỗi khác → 500 |
| 9 | 201 `{ caseCode, secretCode, alreadyReported: false }` | — |

- Route khai báo `maxDuration` ≥ 15 giây. Giá trị cho phép của gói Vercel là **mục kiểm lúc deploy**, như với route phân tích.
- **Hai request đầu tiên đến cùng lúc** cho cùng một analysis: cả hai qua bước 4 và cả hai gọi LLM. Chỉ một bên INSERT được. Chấp nhận tốn thêm một lượt LLM. Không khoá trước, vì giữ khoá trong lúc chờ LLM trái với data-model §4.
- Bước 4 nằm **trước** LLM, để gửi lại (SO-04-AC03) không tốn lượt LLM.
- `analysisId` là UUID ngẫu nhiên, chỉ có trong response của `/api/analyses`. Biết `analysisId` là đủ quyền gửi báo cáo (api.md §2). Analysis nào cũng gửi được, kể cả `inconclusive`.

### 2.2 Mất mã bí mật khi thử lại (đã biết, đề xuất chấp nhận trong v1)

Server đã ghi case nhưng response không tới được trình duyệt (mạng rớt, client hết thời gian chờ). Người dùng bấm thử lại và nhận `alreadyReported: true` với `secretCode: null`. **Mã bí mật mất hẳn**, và người dùng không tra trạng thái được nữa.

- Case vẫn tới FraudOps, nên luồng chính (plan §1) không bị ảnh hưởng. Chỉ có T-052 (P1, thứ 4 trong thứ tự cắt) là không dùng được cho case này.
- UI cho trường hợp này dùng câu "đã gửi trước đó" ở ui-pages §2.4, thêm một câu: "Nếu bạn chưa kịp lưu mã bí mật, đội vận hành vẫn nhận được báo cáo này."
- Phương án sửa (đổi api.md) ở RP-02.

## 3. Tóm tắt AI cho hồ sơ (SO-05-AC02)

### 3.1 Ghi chú của người báo cáo là nội dung người dùng

- SO-01-AC03 yêu cầu che "trước khi lưu và trước khi gửi cho LLM". Ghi chú cũng được lưu và gửi cho LLM, nên **phải che bằng cùng hàm `redact`**. Spec đã quy định, không cần quyết định thêm.
- **Hệ quả về độ dài:** nhãn che (`[OTP ĐÃ CHE]`) dài hơn chuỗi nó thay. Một ghi chú 500 ký tự hợp lệ có thể vượt CHECK `reporter_note ≤ 500` (data-model §2.3) sau khi che, và gây lỗi 500. Bảng `analyses` đã nới lên 4000 vì đúng lý do này. Cách xử lý ở RP-01.
- **Luật che thêm cho ghi chú (RP-06, owner chốt 27/11).** Người báo cáo thường kể "mình đưa mã 482913" mà không viết "OTP", nên luật của tin nhắn không bắt được. `redactNote` chạy `redact` rồi che thêm mọi **dãy 4–8 chữ số đứng riêng** (kể cả viết `482 913`, `482-913`) bằng nhãn `[OTP ĐÃ CHE]`. Giữ nguyên: số điện thoại, đường dẫn, số tài khoản viết **ngay sau** STK / "số tài khoản" (Q-04), số tiền, ngày giờ. Chấp nhận che nhầm, ví dụ năm viết riêng, mã đơn, số tài khoản 6–8 chữ số không đứng ngay sau STK. Nội dung tin nhắn không đi qua luật này. Mã viết kiểu `482.913` bị coi là số tiền và không che.
- Ghi chú đặt trong **khối phân tách riêng**, khác khối nội dung tin, cùng cơ chế `delimiters.ts` đã có. Không bao giờ ghép ghi chú vào system prompt.

### 3.2 Đầu vào, đầu ra, bộ lọc

- **Đầu vào:** nội dung đã che, signal, check, verdict, `riskTypes`, kênh, ghi chú đã che (contracts §7).
- **Đầu ra:** `LlmCaseSummaryOutput` = `{ summary, nextSteps }`, gồm 3–5 câu và 1–3 bước. Schema này **chưa có** trong `packages/shared/src/llm.ts`, cần thêm.
- **Prompt:** `packages/core/src/llm/prompts/case-summary-v1.ts`, có `PROMPT_VERSION`, lưu vào `cases.summary_prompt_version`.
- **Gọi model:** `temperature = 0`; sai schema thì thử lại 1 lần nếu còn ≥ 3 giây (giống pipeline §2). Model lấy từ `GROQ_MODEL_EXPLAIN`, không thêm biến môi trường mới.
- **Bộ lọc sau khi nhận.** Vi phạm thì `aiSummary = null`, không thử lại:
  - Dùng lại bộ lọc của giải thích (write-explanation.ts): độ dài (≤ 1.000 ký tự cho `summary`, ≤ 200 ký tự mỗi bước), cấm `an toàn`, `%`, `chắc chắn`, `đảm bảo`, `bảo đảm`, `tuyệt đối`.
  - Dãy chữ số lạ: so với **nội dung đã che + ghi chú + signal + check**. Prompt này có thấy nội dung tin, nên tập "số đã biết" rộng hơn của giải thích.
  - *(đề xuất, RP-04)* Chặn theo P1: cấm "kẻ lừa đảo" trong `summary` và `nextSteps`. Cấm `nextSteps` đề xuất "khoá tài khoản", "chặn giao dịch", "phong toả". Nhân viên vẫn tự quyết; bộ lọc chỉ để AI không đề xuất hành động mà hệ thống cấm (SO-06-AC06).
- **Một hàm, tách khỏi bộ lọc.** Đặt bộ lọc dùng chung vào `packages/core/src/llm/output-filters.ts` để giải thích và tóm tắt dùng cùng một chỗ. Đây là refactor nhỏ của mã S2, thuộc vai A.

## 4. Mã bí mật và `POST /api/case-status` (SO-04-AC04)

### 4.1 Mã bí mật

- **Bảng chữ:** Crockford base32 (32 ký tự, bỏ `I L O U`), sinh bằng `crypto.randomInt`.
- **Chuẩn hoá đầu vào:** trim, viết hoa, bỏ khoảng trắng và gạch ngang, đổi `O→0`, `I/L→1`. Người dùng gõ lại từ giấy không bị sai vì nhầm chữ.
- **Hiển thị:** chia nhóm 4 ký tự bằng gạch ngang. Gạch ngang chỉ để dễ đọc, không băm.
- **Độ dài: 8 ký tự = 40 bit** (RP-05). Mã hồ sơ là dãy tăng dần từ `SC-0101` (data-model §5), nên đoán được mã hồ sơ. Toàn bộ an toàn của tra cứu nằm ở mã bí mật. Với 10 lượt/phút/IP, đoán trúng một mã 40 bit cho trước cần khoảng 10¹¹ phút cho mỗi IP. Wireframe vẽ `K7QX-2M` (6 ký tự, 30 bit, khoảng 10⁸ phút): vẫn đủ cho cuộc thi, nhưng ngắn hơn không đáng.
- **Băm:** scrypt của `node:crypto`, muối ngẫu nhiên, tham số nằm trong chuỗi băm (data-model §6, backend.md). So sánh bằng `timingSafeEqual`.

### 4.2 Tra trạng thái

| Đầu vào | Phản hồi |
|---|---|
| Thiếu trường, rỗng, hoặc dài hơn 32 ký tự | 400 `validation_failed`. Chỉ phụ thuộc đầu vào, không đọc DB, nên không lộ gì |
| Mã hồ sơ sai định dạng sau chuẩn hoá | 404, **giống hệt** dòng dưới |
| Mã hồ sơ không có trong DB | 404 `not_found`, câu "Không tìm thấy báo cáo khớp với hai mã này." |
| Có mã hồ sơ nhưng sai mã bí mật | 404 như trên |
| Khớp cả hai | 200 `{ caseCode, status: PublicCaseStatus, updatedAt }` |

- **Không lộ qua thời gian phản hồi:** khi mã hồ sơ không có trong DB, vẫn chạy scrypt trên một chuỗi băm giả cố định. Nhờ vậy ba trường hợp 404 tốn thời gian như nhau. Phần này kiểm bằng review, không viết test đo thời gian.
- **Ánh xạ trạng thái:** `pending_review` → `pending_review`; `closed` → giá trị `decisions.decision`. `updatedAt` = `cases.updated_at`.
- Mã hồ sơ được chuẩn hoá bằng trim và viết hoa. Chấp nhận nhập chỉ phần số (`101` → `SC-0101`).
- Response chỉ có ba trường trên: không có lý do kết luận, tên nhân viên hay nội dung tin (api.md).

## 5. Giao diện (T-051, T-052)

### 5.1 Form báo cáo trên trang `/`

Trạng thái và câu chữ theo ui-pages §2.4. Phần bổ sung:

| Tình huống | Hiển thị |
|---|---|
| 404 (analysis không còn, ví dụ sau khi reset demo) | "Không tìm thấy kết quả phân tích này. Hãy kiểm tra lại tin nhắn rồi gửi báo cáo." Nút gửi bị khoá |
| 429 | Câu nguyên văn SO-01-AC04; giữ nội dung form |
| Mạng lỗi, 5xx, quá **20 giây** (client abort, lớn hơn hạn 8 giây của tóm tắt cộng DB) | "Chưa gửi được báo cáo. Hãy thử lại." Giữ form. Thử lại có thể ra "đã gửi trước đó" (§2.2) |
| `alreadyReported` | Câu ui-pages §2.4 + câu §2.2 |
| Không sao chép được (trình duyệt chặn clipboard, không phải secure context) | Tự bôi đen mã để người dùng tự sao chép; thông báo "Hãy tự sao chép mã" qua `aria-live` |

- Form là component client trong `features/report/`, gắn vào prop `actions` của `ResultView` (S4 §2). Form nhận `analysisId` từ state của `AnalysisFeature`.
- Validate phía client bằng `ReportRequest` dùng chung với server.

### 5.2 Sửa state machine của S4 (cần duyệt cùng S4)

Theo S4 §3.1, sửa ô nhập thì ẩn kết quả, và "Kiểm tra tin khác" xoá kết quả. **Sau khi gửi báo cáo thành công**, cả hai thao tác này sẽ xoá luôn mã bí mật đang hiện, và mã đó không bao giờ hiện lại. Sửa như sau:
- Thêm trạng thái `reported` sau `result`. Ở trạng thái này, ô nhập chỉ đọc, có dòng "Đã gửi báo cáo cho tin này. Bấm Kiểm tra tin khác để kiểm tin mới."
- Ở `reported`, bấm "Kiểm tra tin khác" sẽ hỏi lại: "Bạn đã lưu mã hồ sơ và mã bí mật chưa? Mã bí mật sẽ không hiển thị lại." Có hai nút: "Đã lưu, kiểm tin khác" và "Quay lại". Dùng `ConfirmDialog` (design-system §4).
- Tin mẫu bị khoá ở `reported`.

S4 §3.1 đã ghi chú trỏ tới mục này.

### 5.3 Trang `/tra-cuu`

- Theo ui-pages §3 và pages.md §3: hai ô, một nút, ba trạng thái (khớp, không khớp, 429) cùng lỗi mạng.
- Server component dựng khung trang, form là component client. Disclaimer có ở trang.
- Kết quả **không** đưa mã lên URL. Mã chỉ nằm trong body POST (api.md).
- Không có link nào tới FraudOps.

## 6. Module và hàm

Theo team-split §3. Không thêm lớp trung gian.

```ts
// packages/shared — vai C giữ
ReportRequest            // { channel: ReportChannel, note?: string }
ReportResponse           // { caseCode, secretCode: string | null, alreadyReported }
CaseStatusRequest        // { caseCode: string, secretCode: string }
CaseStatusResponse       // { caseCode, status: PublicCaseStatus, updatedAt }
LlmCaseSummaryOutput     // { summary: string, nextSteps: string[] } — vai A thêm vào llm.ts

// packages/core/src/llm — vai A
summarizeCase(input: CaseSummaryInput, deps: LlmDeps, opts: CallOptions): Promise<SummarizeCaseResult>
                                                     // ok: { summary, nextSteps } | lỗi có lý do; không throw

// packages/core/src/reports — vai C
generateSecretCode(random: RandomSource): string     // 8 ký tự Crockford, chưa chia nhóm
normalizeSecretCode(input: string): string | null
hashSecret(code: string): Promise<string>
verifySecret(code: string, hash: string): Promise<boolean>
submitReport(analysisId: string, req: ReportRequest, deps: ReportDeps): Promise<
  | { kind: "created"; caseCode: string; secretCode: string }
  | { kind: "already_reported"; caseCode: string }
  | { kind: "analysis_not_found" }>

// tra trạng thái, cùng module reports (codebase.md §1) — vai C
normalizeCaseCode(input: string): string | null
lookupPublicStatus(req: CaseStatusRequest, deps: DbDeps): Promise<CaseStatusResponse | null>
                                                     // null cho mọi trường hợp không khớp
```

- Route ở `apps/web/src/app/api/analyses/[analysisId]/report/route.ts` và `apps/web/src/app/api/case-status/route.ts` (vai C). Route chỉ làm rate limit, parse, gọi core, ánh xạ sang HTTP.
- `ReportDeps` = `database`, `llm`, `now`, `random`, cùng `redact` lấy từ S3 (T-031).

## 7. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Unit `generateSecretCode` / `normalizeSecretCode` | Đúng 8 ký tự thuộc bảng chữ; chuẩn hoá `o→0`, `l→1`, bỏ gạch ngang và khoảng trắng; chuỗi lạ ra `null` |
| Unit `hashSecret` / `verifySecret` | Đúng mã → true; sai một ký tự → false; chuỗi băm không chứa mã gốc |
| Unit `summarizeCase` (LLM giả) | Sai schema → thử lại 1 lần; quá hạn; từng luật lọc §3.2; ghi chú chứa chỉ dẫn cho AI nằm trong khối phân tách, không nằm trong system prompt |
| Int `submitReport` (Postgres local) | Tạo case `pending_review` có `engine_verdict`, `risk_types` chụp từ analysis; **gửi lần hai không gọi LLM**; **hai lời gọi song song tạo đúng một case**, bên thua nhận `already_reported` (đường 23505); LLM lỗi vẫn có case với `ai_summary = null`; ghi chú có OTP được lưu ở dạng đã che |
| Int `lookupPublicStatus` | Sai mã hồ sơ, sai mã bí mật, hồ sơ không tồn tại → cùng `null`; mỗi kết luận ánh xạ đúng `PublicCaseStatus` |
| Route | 404 analysis; 400 kênh lạ, ghi chú dài; 429 không gọi LLM; ba trường hợp 404 của `/case-status` có **status và body giống hệt** |
| So chuỗi | Bốn nhãn trạng thái SO-04-AC04 so với design-system §3 |
| Kiểm tay | Ảnh 360px: form, thành công, đã gửi trước, `/tra-cuu` khớp và không khớp; luồng `reported` của §5.2 |

## 8. Ánh xạ AC → kiểm

| AC | Kiểm bằng |
|---|---|
| SO-04-AC01 | Int `submitReport` tạo case `pending_review`; route trả `caseCode`; E2E T-092 |
| SO-04-AC02 | `ReportRequest` (kênh, ghi chú ≤ 500); route 400 |
| SO-04-AC03 | Int gửi lần hai và gửi song song; response không có `secretCode` |
| SO-04-AC04 | Int `lookupPublicStatus`; route `/case-status` ba trường hợp 404 giống hệt; review chống lộ qua thời gian |
| SO-05-AC01 | Int: case có bản chụp verdict, loại rủi ro, nguồn; phần hiển thị kiểm ở T-062 |
| SO-05-AC02 | Unit `summarizeCase` và bộ lọc; LLM lỗi vẫn có case (A-02); eval ở T-101 nếu còn thời gian |

## 9. Phụ thuộc

| Cần | Ai | Ghi chú |
|---|---|---|
| T-038: analysis được lưu | C | Đã merge (PR #46, 26/11) |
| `redact` (T-031) | A | Che ghi chú |
| Schema `AnalysisResult` trong shared (S4 §4) | C | Form báo cáo nằm trong khối kết quả |
| Mã bí mật của case mẫu | C (T-090) | Seed cần mã đã biết để demo `/tra-cuu`. Lưu mã ở chỗ chỉ đội demo đọc được (ví dụ `.env` hoặc ghi chú riêng của owner), không commit |

## 10. Quyết định (owner chốt 26/11/2026)

Tiền tố `RP-` (báo cáo, slice S5), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| RP-01 | Ghi chú sau khi che có thể dài hơn 500 ký tự và vượt CHECK (§3.1) | (a) Migration nới CHECK `reporter_note` lên 1.000. Người dùng vẫn thấy giới hạn 500 (O-04 giữ nguyên với dữ liệu nhập); sửa data-model §2.3. (b) Kiểm 500 ký tự **sau khi** che: không cần migration, nhưng ghi chú 490 ký tự có OTP bị từ chối mà người dùng không hiểu vì sao | (a). Migration chưa chạy trên DB deploy nào, nên có thể sửa thẳng `0000_p0_tables` như DB-06 · **Owner chốt 26/11** |
| RP-02 | Mất mã bí mật khi response bị rớt (§2.2) | (a) **Chấp nhận** trong v1, có câu giải thích. (b) Trình duyệt tự sinh mã bí mật và gửi lên; server băm. Gửi lại với cùng mã thì server kiểm băm và trả lại `secretCode` đó. Phải đổi api.md (server không còn tự sinh mã) và thêm một nhánh kiểm | (a). T-052 là P1 thứ 4 trong thứ tự cắt; (b) đáng làm nếu còn giờ sau 29/11 · **Owner chốt 26/11** |
| RP-03 | Hạn của tóm tắt AI | 8 giây: tổng thời gian route khoảng ≤ 10 giây. Ngắn hơn thì dễ ra `aiSummary = null`; dài hơn thì người dùng chờ lâu | 8 giây, chỉnh theo số đo · **Owner chốt 26/11** |
| RP-04 | Bộ lọc P1 cho tóm tắt (§3.2) | Cấm "kẻ lừa đảo"; cấm `nextSteps` đề xuất khoá tài khoản, chặn giao dịch, phong toả. Có thể làm mất một số tóm tắt hợp lý | Bật · **Owner chốt 26/11** |
| RP-05 | Độ dài mã bí mật | 8 ký tự (40 bit) so với 6 ký tự như wireframe (30 bit) | 8; wireframe pages.md §2.3 và ví dụ api.md đã sửa · **Owner chốt 26/11** |
| RP-06 | Ghi chú kể ở ngôi thứ nhất lọt mã OTP (review 27/11) | (a) Thêm luật che riêng cho ghi chú (§3.1), chấp nhận che nhầm vài con số. (b) Thêm câu nhắc dưới ô ghi chú. (c) Chấp nhận | (a), vì SO-01-AC03 yêu cầu che trước khi lưu · **Owner chốt 27/11**; chi tiết luật do agent chọn khi cài |

## 11. Rủi ro

- **Lịch:** S5 nằm sau S3, mà S3 xong muộn (merge 26/11). Thiếu thời gian thì cắt T-052 trước (plan §7 thứ 4). T-050 và T-051 là P0, không cắt.
- **Chi phí LLM:** mỗi báo cáo mới tốn một lượt gọi, dùng chung trần `LLM_DAILY_CALL_CAP` (P-03). Chạm trần thì `aiSummary = null`, case vẫn được tạo.
- **Tóm tắt chưa được eval:** bộ eval SO-09 đo verdict và giải thích, chưa đo tóm tắt. Chất lượng tóm tắt chỉ được kiểm bằng bộ lọc và bằng mắt, trừ khi T-101 còn thời gian.

## 12. Ghi chú cài đặt (27/11/2026)

Khác hoặc thêm so với bản duyệt. **Owner xác nhận cả 10 mục ngày 27/11/2026**, gồm các câu mới ở mục 10.

| # | Việc | Lý do |
|---|---|---|
| 1 | `lookupPublicStatus`, `normalizeCaseCode` nằm ở `core/src/reports/`, không phải `core/src/cases/` như §6 bản đầu; giao diện ở `features/lookup/` | `codebase.md` (cấp 4) thắng thiết kế slice (cấp 5); tránh thêm phụ thuộc `cases → reports` |
| 2 | Trong lúc **đang gửi** báo cáo cũng khoá ô nhập, tin mẫu, nút "Kiểm tra", "Kiểm tra tin khác" và ẩn "Thử lại" (§5.2 chỉ nói sau khi thành công) | Đổi nội dung giữa chừng thì mất câu trả lời, cùng mã bí mật trong đó |
| 3 | `reported` chỉ áp cho lần gửi **thành công** (có mã bí mật trên màn hình). "Đã gửi trước đó" không khoá, không hỏi lại | Không có mã bí mật nào để mất |
| 4 | **Trong lúc đang gửi** và ở `reported`, đóng, tải lại hoặc rời trang thì trình duyệt hỏi lại (`beforeunload`; phần đang gửi thêm sau review 27/11); link "Tra cứu trạng thái" mở **tab mới** và ghi "(mở tab mới)" | Mở cùng tab sẽ mất mã bí mật. Safari trên iOS không hỗ trợ `beforeunload` |
| 5 | Header trang `/` có link "Tra cứu báo cáo" theo wireframe pages §2.1; test P5 của trang `/` đổi thành "link duy nhất là `/tra-cuu`" | Wireframe đã có link này |
| 6 | Bộ lọc P1 (RP-04) so trên chữ **bỏ dấu**, cho phép tối đa 3 từ chen giữa ("khoá ngay các tài khoản"). Cụm cấm hành động chỉ áp cho `nextSteps` | "khoá"/"khóa", "toả"/"tỏa" là hai chuỗi khác nhau |
| 7 | Số câu 3–5 chỉ yêu cầu trong prompt, code không đếm. Quá dài thì bỏ tóm tắt, không thử lại | Đếm câu trên chữ có tên miền dễ sai |
| 8 | Ghi chú sau khi che được **cắt ở 1.000 ký tự** | Nhãn che có thể làm 500 ký tự vượt cả CHECK mới |
| 9 | Phần chặn trần LLM và log lỗi gọi model được tách thành `guardLlm`, dùng chung cho phân tích và tóm tắt | Một chỗ cho P-03 |
| 10 | Câu mới chưa có trong tài liệu duyệt: ba câu giải nghĩa trạng thái (trừ câu `confirmed_scam` lấy từ wireframe), "Hãy chọn nơi bạn nhận tin.", "Ghi chú tối đa 500 ký tự.", "Hãy nhập cả mã hồ sơ và mã bí mật.", "Chưa tra cứu được do lỗi kết nối. Hãy thử lại." Ghi ở [design-system §3](../product/design-system.md#3-câu-chữ-chuẩn) | Cần câu để hiển thị |

**Chưa kiểm** (tại lúc cài đặt) được cập nhật ở §13.

## 13. Kết quả kiểm (27/11/2026)

Chạy ở local trên commit `7a03690`. Postgres 17 tạm (Docker, đã xoá), server `next dev`, Groq thật theo cấu hình `.env` local, tin tự tạo với tên miền dành riêng.

**Đạt:**
- `npm run verify` (660 đạt, 68 test tích hợp bỏ qua vì không có DB); chạy lại có DB: 728/728. `next build` và migrate DB trống xanh.
- Route thật: 201 rồi 200 `alreadyReported`; hai request song song ra một hồ sơ; ba kiểu sai mã cho 404 giống hệt status và body; lượt thứ 11 từ một IP bị 429, và khoá đó chặn cả `/report`; OTP trong ghi chú được che.
- UI headless Chromium 360px: form, đang gửi, thành công, khoá `reported`, `beforeunload`, hộp hỏi lại, đã gửi trước đó, analysis không còn, mất mạng, `/tra-cuu` khớp, không khớp, 429. Không cuộn ngang, không lỗi console, mã không lên URL.

**Tóm tắt AI với Groq thật (SO-05-AC02):**

| Cách gửi | Có tóm tắt | Lý do thiếu |
|---|---|---|
| Báo cáo khoảng 20 giây sau khi phân tích | 0/3 | 429 |
| Nghỉ khoảng 90 giây rồi báo cáo | 3/4 | một lượt `json_validate_failed`, thử lại bị 429 |

- Ba tóm tắt nhận được qua bộ lọc, route mất khoảng 2–2,5 giây. Một lượt có câu lệnh chèn trong ghi chú: model thuật lại yêu cầu đó như lời người báo cáo, không làm theo.
- Nhận xét chất lượng: tóm tắt chép mã nội bộ (`ip_host`, `lookalike`, `pass`, `inconclusive`) vào câu cho nhân viên đọc. Chưa sửa.
- Mẫu quá nhỏ để kết luận tỉ lệ. Cả đợt kiểm tốn khoảng 30 lượt gọi Groq; nhịp gửi dày có thể là một phần nguyên nhân 429.

**Rủi ro:** ở local, đổi header `x-forwarded-for` là sang khoá rate limit khác. SO-01-AC04 và ước tính dò mã ở §4.1 chỉ đúng khi header IP của nền tảng đáng tin (mục kiểm lúc deploy).

**Chưa kiểm:** SO-05-AC01 phần "nguồn (`user_report`)": chưa có trong mã S5, theo [contracts §6](../architecture/contracts.md#6-hồ-sơ-casedetail-dùng-ở-fraudops) là trường của `CaseDetail` (T-062), nên §8 ghi quá phạm vi test hiện có. Chống lộ qua thời gian (§4.2): mới đọc mã (`lookupPublicStatus` luôn chạy scrypt, kể cả trên `DUMMY_SECRET_HASH`), chưa đo. Bản deploy, `maxDuration` và header IP trên Vercel; điện thoại thật; trình đọc màn hình; DB dev local đã có CHECK 1.000 ký tự hay chưa; nút sao chép khi trình duyệt cho phép clipboard (mới kiểm nhánh bị chặn).

**Sửa sau review (27/11, commit `8f59b75`):** cảnh báo rời trang nay bật cả khi đang gửi báo cáo (`leavingLosesCodes` ở `features/analysis/state.ts`, có test). `npm run verify` (661 đạt, 68 test tích hợp bỏ qua vì không có DB) và `next build` xanh. Chromium headless 360px, hai API giả trong trình duyệt: đang gửi thì link header và tải lại đều hỏi lại; chọn ở lại thì mã vẫn tới; gửi lỗi thì rời trang không bị hỏi. Safari trên iOS vẫn không hỏi.

**Đã xử lý (27/11):** ghi chú lọt mã OTP, owner chốt thêm luật che (RP-06, §3.1). Đã chạy: `npm run verify` có DB tạm 745/745, không DB 676 đạt và 69 bỏ qua; `next build` xanh. Số điện thoại của chính nạn nhân trong ghi chú vẫn được giữ (Q-04).

**Còn mở từ review, chờ owner:**
- Tóm tắt chép mã nội bộ (`ip_host`, …): đổi sang nhãn tiếng Việt trước khi đưa vào prompt, nên làm trước hoặc cùng T-062.
- Bộ lọc hành động cấm có thể bỏ oan cả bản tóm tắt: theo dõi log `case_summary_failed` mã `forbidden_action`.
- Chưa có cách tạo bù tóm tắt khi Groq trả 429: quyết trước đóng băng 30/11.

