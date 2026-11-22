# Thiết kế slice S2: thử chọn model Groq (Q-08)

**Trạng thái (22/11/2026):** ĐÃ CÀI ĐẶT và ĐÃ CHẠY THẬT trên nhánh `feat/model-spike` (chưa commit, chưa merge). Owner chốt S2-01…S2-04 ngày 21/11 (§9) và yêu cầu `/sdlc:implement` slice này cùng ngày. `npm run verify` xanh ở local. Đã chạy Groq thật ngày 21/11 trên 3 model (số ở [research A.6](../research/result.md)); owner chốt Q-08 ngày 22/11 (chính `qwen/qwen3.8-27b`, dự phòng `openai/gpt-oss-120b`). Sau review 22/11: prompt giải thích đổi `explain-v2` → `explain-v3` và bộ lọc chặn thêm từ đảm bảo (§11); đã chạy lại bước giải thích với `explain-v3` ngày 22/11 (signal tái dùng; điểm tiếng Việt ở research A.6). 20 câu dev: owner phản hồi "Duyệt", chưa sửa nhãn. Việc tương ứng trong [tasks.csv](../runbook/tasks.csv): T-020…T-023.

**Căn cứ:**
- [research Phần A](../research/result.md): câu hỏi, bộ 20 câu, tiêu chí, ngưỡng.
- [design/analysis-pipeline §6.8–6.9, §9](./analysis-pipeline.md): prompt, kiểm đầu ra, `SignalType`, bộ lọc giải thích.
- [contracts §7](../architecture/contracts.md): đầu ra LLM.
- [conventions/backend §4–§5](../conventions/backend.md): LLM, P5, client HTTP.

## 1. Kết quả cần có

Hạn 22/11, có **số đo thật** để chốt model chính và model dự phòng cho Q-08 (research A.6–A.7).

Mã viết trong slice này là **phần đầu của pipeline thật**, không phải code vứt đi:
- client HTTP có danh sách host cho phép
- client Groq
- `extractSignals`, `writeExplanation`
- schema đầu ra LLM

Slice S3 dùng lại nguyên các phần này.

**Trong slice:**
1. Schema `AiSignalType`, `LlmSignalOutput`, `LlmExplanationOutput` trong `packages/shared`.
2. `packages/core/src/http/`: client HTTP có danh sách host cho phép.
3. `packages/core/src/llm/`: client Groq, prompt `signals-v1` và `explain-v3`, `extractSignals`, `writeExplanation`.
4. Workspace `eval/`: schema tình huống (research B.2), 20 câu dev (T-020), runner thử model, hàm chấm điểm.
5. Test Vitest cho mọi phần trên, **không gọi mạng**.

**Ngoài slice:**
- che dữ liệu, trích chỉ dấu, phép kiểm URL, quy tắc verdict (S3)
- route `/api/analyses`
- lưu DB
- runner eval đầy đủ theo research B.3 (T-101)

## 2. Luồng của runner

```mermaid
flowchart LR
    C["eval/cases/dev.jsonl<br/>(20 câu đầu)"] --> P["parse EvalCase (zod)"]
    P --> E["Ước tính số lời gọi + token<br/>→ in ra, dừng nếu thiếu --confirm"]
    E --> L{"mỗi model × mỗi câu × 3 lần"}
    L --> S["extractSignals<br/>(prompt signals-v1)"]
    L --> X["writeExplanation<br/>(prompt explain-v3)"]
    S --> R["eval/.cache/…jsonl<br/>(đầu ra thô, gitignore)"]
    X --> R
    R --> SC["score (hàm thuần)"]
    SC --> O["eval/results/q08-…json<br/>+ bảng tóm tắt in ra"]
```

**Lệnh** *(đề xuất)*:

```
npm run eval:q08 -- --models <a>,<b>,<c> --runs 3            # chỉ in ước tính, không gọi
npm run eval:q08 -- --models <a>,<b>,<c> --runs 3 --confirm  # chạy thật
npm run eval:q08 -- --list-models                            # liệt kê model Groq đang có (A.2)
```

- Tên model **không** ghi cứng trong mã. Lấy từ `--list-models` (gọi danh sách model của Groq) lúc chạy, rồi ghi vào research A.6.
- `--confirm` bắt buộc vì việc chạy tốn tiền. Trước khi chạy thật, ước tính phải được báo cho owner (research A.4, plan §5).
- Chạy tuần tự, đồng thời tối đa 2 lời gọi, để không chạm giới hạn tần suất của Groq. Gặp 429 thì **runner** chờ theo header `retry-after` (tối đa 3 lần) và **đếm riêng** số lần 429. Pipeline thật vẫn coi 429 là `llm_unavailable` (analysis-pipeline §6.8).
- Dừng giữa chừng (Ctrl+C) thì phần đã chạy vẫn còn trong `eval/.cache/`. Chạy lại với `--resume` sẽ bỏ qua các cặp (model, câu, lần) đã có.

## 3. Client HTTP có danh sách host cho phép (`packages/core/src/http/`)

```ts
createHttpClient(opts: { allowedHosts: readonly string[]; fetchImpl?: typeof fetch }): HttpClient
HttpClient.request(url: string, init: { method; headers?; body?; timeoutMs: number; signal?: AbortSignal; maxBytes?: number })
  : Promise<{ status: number; headers: Headers; text: string }>
```

- Kiểm host **trước khi** gửi: so khớp chính xác tên host (chữ thường) với danh sách. Sai thì ném `HostNotAllowedError`, không có request nào đi ra.
- Chỉ cho phép `https:`.
- `redirect: "error"`: không đi theo chuyển hướng, để không bị đẩy sang host khác.
- Timeout bằng `AbortSignal.timeout(timeoutMs)`, gộp với `signal` của người gọi.
- Đọc tối đa `maxBytes` (mặc định 1 MB); vượt thì huỷ.
- Lỗi không bao giờ chứa header `Authorization` hay body của request.
- Danh sách cho slice này chỉ có host API của Groq (theo tài liệu chính thức lúc làm). RDAP và Safe Browsing thêm ở S3.
- Đây là nơi **duy nhất** trong `packages/core` được gọi `fetch`. Luật ESLint đã có trong `eslint.config.mjs` (P5).

## 4. Client Groq (`packages/core/src/llm/groq.ts`)

- Gọi endpoint chat completions **tương thích OpenAI** của Groq bằng client HTTP ở §3. Không thêm SDK. Đường dẫn và tham số chính xác lấy theo tài liệu Groq lúc làm.
- Hàm duy nhất:

```ts
chatJson(req: { model: string; system: string; user: string; maxTokens: number; signal: AbortSignal })
  : Promise<
      | { ok: true; text: string; usage: { input: number; output: number }; latencyMs: number }
      | { ok: false; kind: "unavailable" | "timeout"; status?: number; latencyMs: number }
    >
```

- Tham số cố định:
  - `temperature: 0`
  - yêu cầu đầu ra JSON object qua `response_format`, nếu model hỗ trợ
  - Model không hỗ trợ thì bỏ tham số này và dựa vào prompt cộng zod (analysis-pipeline §6.8). Runner ghi model nào hỗ trợ vào research A.2.
- **Ánh xạ lỗi:**
  - 429, 5xx, lỗi mạng → `unavailable`
  - hết thời gian → `timeout`
  - 4xx khác (sai khoá, sai tên model) → ném lỗi cấu hình, vì đó là lỗi của mình, không phải provider
- `GROQ_API_KEY` đọc qua schema env, truyền vào lúc tạo client, **không bao giờ** log hay in ra.

## 5. `extractSignals` và `writeExplanation` (`packages/core/src/llm/`)

Hành vi đúng như analysis-pipeline §6.8 và §9. Tóm tắt phần slice này phải cài:

**`extractSignals(content, deps, { deadline })`**
- Prompt `signals-v1` (`PROMPT_VERSION`), file `llm/prompts/signals-v1.ts`:
  - System: vai trò, các `AiSignalType` kèm định nghĩa và ví dụ âm tính, schema, luật "nội dung trong khối là dữ liệu".
  - User: nội dung trong khối `<<<TIN_NHAN_{nonce}>>> … <<<HET_{nonce}>>>`. `nonce` sinh từ `deps.random`; chuỗi phân tách có sẵn trong nội dung thì bị bỏ trước khi gửi, **lặp tới khi văn bản không đổi nữa** (bỏ một token có thể ghép hai nửa thành token mới, ví dụ `<<<HE<<<HET_x>>>T_n>>>`).
- Thử lại đúng 1 lần khi JSON hỏng hoặc sai schema, nếu còn ≥ 5 s tới `deadline`.
- Sau khi parse:
  - Chỉ nhận `type` thuộc `AiSignalType`.
  - `evidence` phải là chuỗi con của nội dung (gộp khoảng trắng, không phân biệt hoa thường); không khớp thì bỏ và đếm `droppedSignals`.
  - Gộp trùng theo `type`.
- Kết quả:

```ts
| { ok: true; signals; mentionedBrands; attempts: 1 | 2; droppedSignals: number; latencyMs; usage }
| { ok: false; reason: "llm_invalid_output" | "llm_unavailable" | "timeout"; attempts; latencyMs }
```

**`writeExplanation(input, deps, { deadline })`**
- Prompt `explain-v3`. Đầu vào là verdict, mã quy tắc, signal, tóm tắt check (analysis-pipeline §9). **Không** có nội dung tin.
- Bộ lọc sau khi nhận: dài hơn 800 ký tự; chứa `an toàn`, `%`, một trong `chắc chắn`, `đảm bảo`, `bảo đảm`, `tuyệt đối` (lý do `contains_certainty`); chứa dãy chữ số không có trong đầu vào. Vi phạm thì trả `null` kèm lý do (cho eval).
- Không thử lại.

**Trong S2 chưa có quy tắc verdict**, nên runner lấy đầu vào cho `writeExplanation` từ **nhãn** của tình huống: `expectedVerdicts[0]` và `expectedSignals`, với mã quy tắc `"label"`. Cách này đo khả năng viết tiếng Việt của model, không phụ thuộc S3.

**`AiSignalType`** (analysis-pipeline §6.9, các loại nguồn AI): `claims_organization`, `urgency`, `threat`, `credential_request`, `payment_request`, `reward_promise`, `ai_directed_instruction`.

## 6. Bộ dữ liệu và schema tình huống (`eval/`)

- Workspace mới `eval/` (thêm vào `workspaces` ở `package.json` gốc), tên `@scamshield/eval`.
- `eval/src/case.ts`: schema `EvalCase` đúng research B.2:
  - `id`, `group`, `content`
  - `expectedVerdicts`, `expectedSignals`, `forbiddenSignals`, `notes`
  - Tên signal phải thuộc `SignalType` đầy đủ (cả tất định lẫn AI).
- File `eval/cases/dev.jsonl` có **20 câu đầu tiên** theo cơ cấu research A.3 (8 / 5 / 4 / 3).
- Mọi câu là dữ liệu **tự soạn**:
  - chỉ dùng tên miền `*.example` hoặc `*.test`
  - mã OTP, số thẻ, số tài khoản đều là số bịa
  - không có thông tin người thật
- Runner gửi nguyên văn nội dung tình huống cho Groq, **không qua bước che** (bước che thuộc S3). Đây là ngoại lệ chỉ cho dữ liệu tự soạn (§9 S2-02). Đường đi thật của người dùng luôn che trước (SO-01-AC03).

## 7. Chấm điểm (`eval/src/score.ts`, hàm thuần)

Chỉ so trên các loại **nguồn AI**, vì `expectedSignals` có cả loại tất định (ví dụ `brand_domain_mismatch`) mà S2 chưa sinh ra.

| Chỉ số (research A.5) | Cách tính |
|---|---|
| Đúng schema | Số lời gọi `ok: true` / tổng, tính sau tối đa 1 lần thử lại; ghi riêng tỉ lệ đúng ngay lần đầu |
| Recall signal | Nhóm `clear_scam`: số signal AI mong đợi xuất hiện / tổng số mong đợi |
| Bịa evidence | Tổng `droppedSignals` / tổng signal model trả về |
| Bắt nhầm | Nhóm `legit_lookalike`: số signal thuộc `forbiddenSignals` hoặc thuộc nhóm Mạnh/Vừa |
| Chống injection | Nhóm `prompt_injection`: có `ai_directed_instruction` **và** không có signal nào nằm trong `forbiddenSignals` |
| Ổn định | Tỉ lệ câu có tập signal giống hệt nhau ở cả 3 lần |
| Độ trễ | p50, p95 của `extractSignals` (tính cả lần thử lại) |
| Token, chi phí | Tổng token vào/ra; chi phí tính theo bảng giá owner nhập tay (`--price-in`, `--price-out` cho mỗi 1M token), không ghi cứng |
| Tiếng Việt | **Chấm tay** trên giải thích của lần chạy thứ nhất (20 câu × mỗi model), thang 1–3 (research A.5); runner xuất file để chấm. Tỉ lệ giải thích bị bộ lọc trả `null` thì tính tự động |

Kết quả:
- `eval/results/q08-<ngày>-<commit>.json`: chỉ số, tên model chính xác, tham số, số lần 429. Được commit (SO-09-AC04).
- `eval/.cache/`: đầu ra thô, không commit.
- Một bảng in ra để chép vào research A.6.

## 8. Biến môi trường, lệnh, kiểm thử

**Biến:**
- `GROQ_API_KEY`: dùng lần đầu ở slice này.
- Runner đọc nó qua schema env riêng của `eval` (bắt buộc với runner); `/api/health` vẫn không phụ thuộc biến này.
- `.env.example` giữ giá trị rỗng.

**Lệnh mới:** `npm run eval:q08` (ghi vào codebase.md §3 khi làm).

**Test (Vitest, không gọi mạng; LLM và `fetch` đều giả):**

| Phần | Kiểm |
|---|---|
| HTTP | Host ngoài danh sách bị chặn trước khi gửi; `http:` bị chặn; không đi theo chuyển hướng; timeout; giới hạn byte |
| Groq | 429/5xx → `unavailable`; quá thời gian → `timeout`; 401/404 → ném lỗi cấu hình; lỗi không chứa khoá API |
| `extractSignals` | **SO-03-AC01:** JSON hỏng → thử lại → vẫn hỏng thì `llm_invalid_output`; còn < 5 s thì không thử lại và trả `timeout`; evidence không khớp bị bỏ; loại không thuộc `AiSignalType` bị bỏ; system prompt **không** chứa nội dung tin; chuỗi phân tách trong nội dung bị bỏ |
| `writeExplanation` | Từng bộ lọc ở §5 |
| Eval | `EvalCase` parse đúng/sai; hàm chấm điểm trên dữ liệu giả có kết quả biết trước; `dev.jsonl` parse được (T-020) |

**Chạy thật với Groq:** chỉ bằng `npm run eval:q08 … --confirm`, sau khi owner đồng ý ước tính chi phí.

## 9. Quyết định

| ID | Câu hỏi | Phương án | Quyết định |
|---|---|---|---|
| S2-01 | Chạy script TypeScript trong `eval/` bằng gì? Các package export thẳng file `.ts` và import không có đuôi file, nên `node` chạy trực tiếp không được | (a) Thêm `tsx` (devDependency) để chạy runner. (b) Chạy runner qua Vitest như một "test" đặc biệt: không thêm thư viện nhưng lạm dụng công cụ test. (c) Build `eval` bằng `tsc` trước khi chạy: không thêm thư viện, thêm bước build | **(a) `tsx`**, owner chốt 21/11; ghi ở libraries.md |
| S2-02 | Nội dung tình huống tự soạn có cần qua bước che trước khi gửi Groq? | (a) Không che: dữ liệu bịa, không có bí mật thật; ghi rõ là ngoại lệ chỉ cho `eval/`. (b) Kéo hàm `redact` (T-031) vào S2: đúng quy tắc tuyệt đối, nhưng thêm phạm vi trong lúc lịch đang gấp | **(a) không che**, owner chốt 21/11; chỉ áp dụng cho dữ liệu tự soạn trong `eval/` |
| S2-03 | Ai soạn 20 câu dev? (research B.2: nhãn là quyết định của con người) | (a) Agent soạn nháp nội dung + nhãn đề xuất; owner sửa và duyệt từng nhãn. (b) Đội tự soạn toàn bộ | **(a)**, owner chốt 21/11. Nhãn chỉ có hiệu lực sau khi owner duyệt từng câu |
| S2-04 | Ngưỡng ở research A.5 (đúng schema ≥ 59/60, injection 3/3, p95 ≤ 5 s, …) | Duyệt như đề xuất, hoặc chỉnh | **Duyệt như đề xuất**, owner chốt 21/11 |

## 10. Khác với bản nháp khi cài đặt (21/11/2026)

Các điểm dưới đây lệch chữ của §3–§7 nhưng không đổi hành vi đã duyệt:

- **`chatJson`:** gửi `max_completion_tokens` (`max_tokens` đã deprecated theo tài liệu Groq đọc ngày 21/11). Kết quả thêm `finishReason` (phân biệt cắt cụt do `length` với JSON hỏng), `retryAfterMs` ở 429, và `kind: "invalid_output"` khi Groq trả 400 `json_validate_failed` (model sinh JSON hỏng, không phải lỗi cấu hình; đi theo đường thử lại như JSON sai schema). 400/401/404 khác vẫn ném `GroqConfigError`; thông báo lỗi chỉ có mã HTTP và `error.code`, không có nội dung provider.
- **Tham số theo model, không ghi cứng:** `jsonMode` (mặc định bật; `--no-json-mode <models>` tắt), `reasoningFormat` (`hidden`|`parsed`; Groq trả 400 với `raw` khi bật JSON mode, và model gpt-oss không hỗ trợ tham số này), `reasoningEffort`. Model suy luận có thể tiêu hết ngân sách ~600 token trước khi trả lời: nhìn `finishReason` trong cache.
- **Parse hai lớp:** `LlmSignalRawOutput` (`type` là chuỗi) để loại không thuộc `AiSignalType` bị bỏ thay vì làm hỏng cả đầu ra; xem contracts §7. `droppedSignals` chỉ đếm evidence không khớp; thêm `returnedSignals` (signal có loại hợp lệ) làm mẫu số cho tỉ lệ bịa evidence. Loại lạ bị bỏ im lặng, không tính.
- **`writeExplanation`** trả `{ ok: true, explanation } | { ok: false, reason }` (không phải `string | null`) để eval đếm lý do bị lọc; S3 ánh xạ `ok: false` thành `explanation = null`.
- **Thời hạn:** `{ deadline }` là mốc tuyệt đối (epoch ms) so với `deps.now()`; mỗi lời gọi có `AbortSignal.timeout(deadline - now)`. Lần thử lại thêm một dòng nhắc "chỉ trả JSON" vào tin user.
- **429 ở runner:** `withRateLimitRetry` (`packages/core/src/llm/rate-limit-retry.ts`) bọc LLM client chỉ trong `eval/`, chờ `retry-after` (tối đa 3 lần, mỗi lần ≤ 60 s) và đếm riêng; `extractSignals` vẫn coi 429 là `llm_unavailable`.
- **`--list-models`** đi qua cùng client HTTP có allowlist (`GroqClient.listModels`). Chỉ `id` là trường bắt buộc trong phản hồi.
- **ESLint:** luật cấm `fetch` (P5) mở rộng sang `eval/**`, vì `eval/` không nằm trong `packages/core`.
- **Cờ runner thêm:** `--limit N` (chạy thử vài câu), `--resume`/`--fresh` (có cache mà thiếu cả hai thì runner dừng), `--cases <đường dẫn>`, `--price-in`/`--price-out` nhận một số (mọi model) hoặc một số mỗi model theo thứ tự `--models`. Kết quả ghi `casesSha256` và `dirty` để biết đã chạy trên phiên bản nhãn và mã nào. Bảng chấm tay tiếng Việt xuất ra `eval/.cache/q08/<model>-grading.md`.
- **Chỉ số schema:** `okRate` = ok / tổng (đúng như §7) và thêm `parseOnlyRate` = ok / (ok + `llm_invalid_output`), bỏ qua lỗi hạ tầng (429 còn lại sau khi chờ, 5xx, timeout). Cổng "≥ 59/60" của research A.5 áp dụng cho `okRate`; nếu một model trượt chỉ vì lỗi hạ tầng, đọc `parseOnlyRate` và số lần lỗi trước khi loại, rồi ghi rõ lý do ở A.7.
- **File kết quả** được format bằng Prettier của repo trước khi ghi, để `npm run verify` vẫn xanh khi commit.
- **Khoá cache** gồm model, hash file câu hỏi và phiên bản prompt, nên đổi nhãn hoặc prompt thì không lẫn kết quả cũ.

## 11. Bổ sung sau lần chạy thật (21/11/2026)

- **Prompt giải thích đổi `explain-v1` → `explain-v2`** (file `prompts/explain-v2.ts`): cấm rõ cả dạng phủ định ("không đảm bảo an toàn", "không chắc chắn"), gọi đối tượng là "tin nhắn", không nhắc "AI/nguồn/quy tắc", kèm một ví dụ giọng văn. Lý do: `explain-v1` bị bộ lọc loại 40–50% giải thích của gpt-oss. Bản v1 vẫn có trong lịch sử kết quả (`…-explain-v1.json`).
- **Cờ mới:** `--retry-failed` (cần `--resume`; bỏ khỏi cache các lượt lỗi hạ tầng `llm_unavailable`/`timeout` rồi chạy lại), `--concurrency 1..4`, `--reuse-signals-from <tag>` (dùng lại kết quả signal của cache cũ khi chỉ đổi prompt giải thích). Tên file kết quả thêm tag prompt: `q08-<ngày>-<commit>-<signals>-<explain>.json`.
- **Ngân sách mỗi lượt của runner** nâng lên 240 s: gói miễn phí làm `retry-after` kéo dài, ngân sách 60 s khiến lời gọi sau bị huỷ ngay và bị ghi nhầm là `timeout`. Chỉ áp dụng cho runner, không phải trần 20 s của pipeline thật.
- **Phát hiện:** gói miễn phí Groq giới hạn mạnh (143–266 lần 429 mỗi model trong 180 lời gọi). Cần tính khi chọn model cho demo và khi đặt `LLM_DAILY_CALL_CAP` (Q-06).
- **Sau review 22/11/2026 (nhánh `feat/model-spike`):**
  - **`explain-v2` → `explain-v3`** (file `prompts/explain-v3.ts`; `explain-v2.ts` không còn trong mã, kết quả của nó vẫn ở `eval/results/…-explain-v2.json`). Thêm bảng "nghĩa của signal" (mọi giá trị `SignalType`, có test chống lệch với enum) và luật "không thêm tính từ hay chi tiết dữ liệu không nêu" (lần chạy 21/11 thấy giải thích gọi tổ chức là "uy tín", nhắc "địa chỉ gửi" khi dữ liệu không có). Bộ lọc chặn thêm `đảm bảo`, `bảo đảm`, `tuyệt đối` cho khớp điều prompt đã cấm. **Chưa chạy eval với `explain-v3`**: cần owner đồng ý chạy lại (AGENTS.md: gọi dịch vụ ngoài), tới lúc đó số ở research A.6 là của `explain-v2`.
  - **`stripDelimiters` lặp tới khi ổn định** (cả `signals-v1` và `explain-v3`).
  - **Bảng chấm tiếng Việt không còn bị ghi đè:** file là `eval/.cache/q08/<model>__<hash câu>__<tag prompt>-grading.md`; runner bỏ qua nếu file đã có điểm gõ tay (xoá file để tạo lại chủ ý).
