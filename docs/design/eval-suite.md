# Thiết kế slice S10: bộ eval SO-09, đóng băng, chạy held-out (T-100…T-103)

**Trạng thái (27/11/2026):** **OWNER ĐÃ DUYỆT SLICE S10 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. Agent được viết mã cho slice này. **27/11/2026:** có runner tối thiểu cho tập dev (`npm run eval -- --set dev`, nhánh `feat/t-039-dev-eval`) để làm T-039, gồm `scorePipeline` theo B.3 và dòng phụ EV-03. T-101 còn thiếu: `loadCaseSet` với kiểm chéo tập, chặn held-out (§4.2), `--ids`, bảng chấm 15 giải thích. **Khác §3.2, chờ owner xác nhận:** dòng phụ EV-03 không dùng lại `isInfraFailure` mà loại theo từng chỉ số (chỉ số verdict bỏ lượt không có verdict; giải thích và đúng schema bỏ lời gọi không được trả lời), vì hàm cũ bỏ cả lượt đã có verdict. **Thêm vào §3.3, chờ owner xác nhận:** file kết quả tập dev trùng tên thì đánh số `-2`, `-3` thay vì ghi đè; hậu tố này không phải cách chạy lại held-out (EV-04 giữ nguyên). Mọi việc của S10 đều là **P0**, và "bộ eval có số liệu" nằm trong danh sách **không bao giờ cắt** (plan §7).
- T-100 (soạn câu) **làm được ngay**.
- T-101 (runner) phụ thuộc T-039. Thực chất runner chỉ cần `analyzeMessage` của S3, không cần route.
- T-102 và T-103 nằm cuối chuỗi (30/11, 01/12).

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5). Nó chỉ bổ sung phần các file dưới còn để ngỏ:
- [spec SO-09](../spec/ScamShield-v1.md): AC01…AC04, Q-11.
- [research/result.md Phần B](../research/result.md#phần-b-bộ-eval-so-09): thành phần, định dạng câu (B.2), chỉ số (B.3), nhật ký (B.4), số cho slide (B.5). **Định nghĩa chỉ số ở B.3 là chính thức;** file này không định nghĩa lại.
- [evaluation-protocol](../research/evaluation-protocol.md): gán nhãn, QC, chống rò rỉ, đóng băng, mẫu báo cáo.
- [analysis-pipeline §1, §11](./analysis-pipeline.md) (đã duyệt): route và eval gọi **cùng** hàm `analyzeMessage`.
- Mã S2 đã có trong `eval/src/`: `case.ts` (schema B.2), `cache.ts`, `estimate.ts`, `score.ts`, `runner.ts`.
- [verified-indicators §3](./verified-indicators.md) (S8) và [demo-data §2](./demo-data.md) (S9): eval dùng danh sách chỉ dấu đã xác minh rỗng; tin demo nằm trong tập dev.

## 1. Kết quả cần có

- Một lệnh `npm run eval -- --set dev|heldout` chạy toàn bộ pipeline thật trên từng câu, mỗi câu 3 lần, rồi xuất đủ chỉ số B.3 ra file trong `eval/results/`.
- Tập held-out chỉ được chạy **một lần**, sau khi đóng băng tính năng. Số của lần chạy đó đi vào README và slide, kèm câu giới hạn.
- Không có đường tắt nào để chạy held-out sớm, chạy lại trong im lặng, hay chỉnh prompt theo kết quả held-out.

## 2. Bộ câu (T-100)

### 2.1 Thành phần đề xuất: 80 câu

| Nhóm | `dev` | `heldout` | Tổng |
|---|---|---|---|
| `clear_scam` | 18 (8 đã có) | 12 | 30 |
| `legit_lookalike` | 14 (5 đã có) | 10 | 24 |
| `ambiguous` | 12 (4 đã có) | 6 | 18 |
| `prompt_injection` | 4 (3 đã có) | 4 | 8 |
| **Cộng** | **48** | **32** | **80** |

- Tỉ lệ khoảng 60/40 (B.1). Câu injection: 8, trong khoảng 5–10 (SO-09-AC01).
- Mỗi người trong đội soạn khoảng 20 câu (team-split §2); A duyệt nhãn cuối.
- **Tin demo** (`M1`, `M2`, `M3`, `prize`, `urgent`; demo-data §2) được thêm vào **dev**, tính trong 48 câu dev. Chúng không bao giờ vào held-out, vì đã công khai trên trang.

### 2.2 Chia tập trước khi chỉnh

- 20 câu hiện có đã được dùng để chọn model (Q-08), nên **giữ ở dev**.
- Mỗi câu mới được gán vào dev hoặc held-out **ngay lúc soạn**, trước khi ai chạy nó qua pipeline. Người soạn ghi thẳng vào `dev.jsonl` hoặc `heldout.jsonl`.
- **Câu gần trùng phải ở cùng một tập** (protocol §4): cùng mẫu tin, chỉ đổi URL, tên hay số. Thêm trường **tuỳ chọn** `template` vào schema B.2 (EV-01). Runner từ chối chạy nếu một giá trị `template` xuất hiện ở cả hai tập. Cũng vậy với hai câu có cùng tên miền đăng ký.
- Hạn: **held-out đầy đủ và được A duyệt trước 29/11**, tức trước vòng chỉnh prompt và quy tắc cuối cùng (team-split §2).
- Quy ước nội dung giữ như `eval/cases/README.md`: chỉ `*.example`/`*.test`, tên tổ chức giả, số bịa, không có người thật. D1 chỉ để tham khảo, viết lại, không chép (Q-11).

## 3. Runner (T-101)

### 3.1 Gọi đúng pipeline

Runner gọi `analyzeMessage(content, deps)` của `packages/core`. Đây là cùng hàm route dùng (pipeline §1). `deps` cho eval:

| Phụ thuộc | Eval dùng | Lý do |
|---|---|---|
| `llm` | Client Groq thật, model đọc từ cấu hình như production | Đo đúng thứ người dùng gặp |
| Tra cứu ngoài (RDAP, Safe Browsing) | **Tắt**, tức không có check | Mọi câu dùng `*.example`/`*.test`, vốn đã "không tra theo cấu hình" (pipeline §6.6). Tắt hẳn để số không phụ thuộc mạng ngoài. Ghi `lookups: "off"` vào kết quả |
| `verifiedIndicators` (S8) | Luôn trả rỗng | Số không phụ thuộc trạng thái DB demo |
| Lưu analysis | **Không lưu** (EV-02) | Eval không ghi vào DB nào |
| Rate limit, trần LLM theo ngày | Không áp dụng | Hai cơ chế này nằm ở route và DB, không nằm trong `analyzeMessage` |
| `now`, `random` | Thật | — |

**EV-02, cần A và C thống nhất trước khi viết T-038:** sơ đồ pipeline §2 vẽ bước "lưu analysis" bên trong `analyzeMessage`. Nếu bước lưu nằm trong hàm đó, eval phải có DB. Đề xuất: `analyzeMessage` **không** lưu. Hàm trả `{ result, trace }`; route gọi `saveAnalysis` ngay sau đó. Như vậy eval và route vẫn gọi cùng một hàm phân tích. Đây chỉ là đổi chỗ đặt lời gọi lưu, không đổi hành vi. Trần 20 giây vẫn tính cho cả route.

### 3.2 Nhịp chạy và lỗi hạ tầng

- **Chạy tuần tự, mỗi lần một lượt phân tích,** có khoảng nghỉ giữa các lượt (mặc định 2 giây, chỉnh được bằng cờ). Groq có hạn mức theo phút; research A.6 ghi 5/60 lượt dính 429.
- **Đếm hết, không chạy lại trong im lặng.** Protocol §5 yêu cầu tỉ lệ đúng schema tính cả 429 và timeout. Lượt nào ra `inconclusive` vì `llm_unavailable` hay `timeout` thì vẫn là một lượt trong mọi chỉ số.
- **Báo thêm một dòng phụ (EV-03):** cùng chỉ số, nhưng bỏ các lượt hỏng vì hạ tầng (429, lỗi mạng trước khi có đầu ra). Dòng này luôn có nhãn "không tính lỗi hạ tầng", kèm số lượt bị bỏ. Dùng lại `isInfraFailure` đã có. Slide chỉ dùng dòng chính.
- **Tiếp tục khi bị ngắt:** dùng lại cơ chế cache JSONL của S2 (`cache.ts`), khoá theo `(casesSha256, commit, promptVersion, rulesVersion, model)`. Chạy lại cùng khoá thì bỏ qua lượt đã có. Với held-out, cache chỉ dùng để chạy tiếp lần đang dở, không dùng để chạy lần thứ hai (§4).

### 3.3 Chỉ số và đầu ra

- **Chỉ số theo đúng B.3.** Đơn vị là **lượt chạy** (mỗi câu 3 lượt), riêng "ổn định" tính theo câu. Mọi tỉ lệ ghi kèm tử số và mẫu số (protocol §5).
- **Ánh xạ sang mã:** `score.ts` của S2 đang tính cho signal của từng model. Thêm `scorePipeline(records, cases)` cho B.3, dùng lại hàm `percentile` đã có. Không sửa hàm chấm của S2, để số Q-08 cũ vẫn tái lập được.
- **"Giải thích bám bằng chứng"** có hai phần:
  1. **Tự động:** tỉ lệ `explanation ≠ null`. Bộ lọc ở pipeline §9 đã loại giải thích có số lạ, chữ cấm hoặc quá dài.
  2. **Chấm tay:** lấy ngẫu nhiên 15 giải thích (seed cố định), xuất bảng chấm Markdown giống `q08-grading-*.md`. Người chấm ghi rõ là người hay AI (protocol §5: không gọi AI chấm là "người chấm mù").
- **Độ trễ** là độ trễ của `analyzeMessage` chạy trên máy chạy eval. Nó **không** gồm mạng tới Vercel hay bước lưu DB. Kết quả ghi rõ điều này. Độ trễ trên bản deploy đo riêng ở T-102 (§4).
- **File kết quả:** `eval/results/<yyyy-mm-dd>-<set>-<commit7>.json` (tập dev: đã có file cùng tên thì thêm `-2`, `-3`, không ghi đè; chạy lại held-out vẫn theo §4.2), theo mẫu protocol §7 (`run_id`, `git_commit`, `casesSha256`, model, `promptVersion`, `rulesVersion`, `lookups`, số lượt hỏng theo nguyên nhân, các chỉ số), cộng toàn bộ bản ghi từng lượt. Kèm `…-summary.md` có sẵn **một dòng B.4** để dán vào result.md, và danh sách câu sai (id, verdict mong đợi, verdict thực tế ở 3 lượt).
- **Trước khi gọi Groq,** runner in ước lượng số lời gọi và token bằng `estimate.ts` (80 câu × 3 lượt × 2 lời gọi ≈ 480 lời gọi), rồi dừng chờ `--yes`. AGENTS.md yêu cầu hỏi trước khi chạy toàn bộ eval nhiều lần. Cờ `--ids dev-001,dev-005` chạy một phần, phục vụ chỉnh prompt.

### 3.4 Module

```ts
// eval/src — vai A
loadCaseSet(set: "dev" | "heldout"): { cases: EvalCase[]; sha256: string }   // kiểm template, tên miền chéo tập
runPipelineCase(c: EvalCase, run: number, deps: EvalPipelineDeps): Promise<PipelineRunRecord>
scorePipeline(records: PipelineRunRecord[], cases: EvalCase[]): PipelineScore         // thuần, B.3
writePipelineResult(score, records, meta): { jsonPath: string; summaryPath: string }
// eval/src/run-eval.ts: CLI cho `npm run eval`
```

## 4. Đóng băng và chạy held-out (T-102, T-103)

### 4.1 Đóng băng (30/11, T-102)

1. Mọi PR tính năng đã merge, và `npm run verify` xanh trên `main`.
2. Chạy eval **dev** lần cuối, ghi một dòng B.4.
3. Owner deploy commit đó lên production, chạy E2E trên bản deploy (demo-data §4) và checklist demo.md §3.
4. Đo độ trễ trên bản deploy: gửi 10 tin dev bằng tay qua trang, ghi p50/p95 vào B.4 phần ghi chú. Mười lượt này tính vào hạn mức 10 lượt/phút, nên chờ đủ thời gian giữa các lượt.
5. Ghi **commit đóng băng** (SHA đầy đủ) vào result.md B.4. Không tạo hay đẩy tag nếu owner chưa yêu cầu.

Sau mốc này, chỉ sửa lỗi chặn luồng demo (demo.md §4). Sửa lỗi có đụng tới prompt hay quy tắc thì phải chạy lại dev, và commit đóng băng ở B.4 phải đổi theo **trước** khi chạy held-out.

### 4.2 Chạy held-out một lần (01/12, T-103)

`npm run eval -- --set heldout --frozen <sha>`. Runner từ chối chạy khi:
- `<sha>` khác `HEAD`, hoặc cây làm việc còn thay đổi chưa commit;
- `<sha>` khác commit đóng băng ghi ở result.md B.4. Runner đọc dòng có nhãn cố định trong file này;
- đã có file kết quả `heldout` cho cùng `casesSha256`, trừ khi có `--rerun-reason "<lý do>"` (EV-04).

Sau khi chạy:
- A và owner điền B.4 (một dòng) và B.5 (số cho README và slide, kèm câu giới hạn của SO-09-AC04).
- **Không** sửa prompt, quy tắc hay nhãn held-out theo kết quả (SO-09-AC02). Lỗi phát hiện được ghi vào "hạn chế đã biết" trong B.5.
- Owner quyết có commit file kết quả held-out không. Đề xuất: **có**, vì SO-09-AC04 yêu cầu "lưu thành file trong repo".

## 5. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Unit `loadCaseSet` | Parse hai file; `template` trùng giữa hai tập → dừng; cùng tên miền đăng ký ở hai tập → dừng; tin demo nằm trong held-out → dừng |
| Unit `scorePipeline` (TDD) | Dùng bộ bản ghi giả có kết quả tính tay trước: precision, recall, FPR, `inconclusive` trên nhóm không rõ, injection (cần **cả** verdict đúng **và** có `ai_directed_instruction`), ổn định theo câu, p50/p95; lượt hỏng hạ tầng có ở dòng chính, không có ở dòng phụ; mẫu số bằng 0 → `null`, không ra `NaN` |
| Unit chặn held-out | SHA lệch `HEAD`; cây làm việc bẩn; đã có kết quả mà không có lý do chạy lại → từ chối |
| Unit deps eval | Bước lưu không được gọi; tra cứu ngoài không được gọi; `verifiedIndicators` trả rỗng |
| Chạy thật | Dev: một lần đầy đủ sau khi S3 xong, ghi B.4. Hỏi owner trước mỗi lần chạy đầy đủ |

**Ánh xạ AC:**
- SO-09-AC01: `loadCaseSet` đếm theo nhóm và số câu injection; A duyệt nhãn.
- SO-09-AC02: chặn chéo tập, chặn held-out (§4.2), quy trình đóng băng.
- SO-09-AC03: `scorePipeline`, cùng một lệnh với 3 lượt mỗi câu.
- SO-09-AC04: file kết quả trong `eval/results/`, B.4, B.5, README và slide (T-110, T-112).

## 6. Quyết định (owner chốt 26/11/2026)

Tiền tố `EV-` (eval, slice S10), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| EV-01 | Thêm trường tuỳ chọn `template` vào định dạng câu B.2 | Giữ được câu gần trùng ở cùng một tập (protocol §4). Phải sửa `case.ts` và B.2 | Thêm · **Owner chốt 26/11** |
| EV-02 | `analyzeMessage` có tự lưu analysis không (§3.1) | (a) Không: route gọi `saveAnalysis` sau đó; eval không cần DB. (b) Có, nhưng bước lưu truyền vào được; eval truyền hàm không làm gì | (a). A và C chốt trước T-038 · **Owner chốt 26/11** |
| EV-03 | Lượt hỏng vì hạ tầng (429, mạng) | (a) Tính vào dòng chính, thêm dòng phụ "không tính lỗi hạ tầng" có nhãn rõ. (b) Chỉ tính dòng chính. (c) Tự chạy lại lượt hỏng: số đẹp hơn, nhưng trái protocol §5 | (a); slide chỉ dùng dòng chính · **Owner chốt 26/11** |
| EV-04 | Held-out hỏng giữa chừng vì sự cố hạ tầng (Groq sập) | Cho chạy lại bằng `--rerun-reason`. Cả hai lần đều ghi vào B.4, và B.5 dùng lần cuối kèm ghi chú. Không cho chạy lại vì "số chưa đẹp" | Như trên · **Owner chốt 26/11** |
| EV-05 | Số câu | 80 (đề xuất) so với 60 (tối thiểu): 80 cho mẫu số held-out lớn hơn, nhưng cần soạn thêm 60 câu trong 3 ngày | 80; nếu tới 28/11 chưa đủ thì dừng ở 60–70 và giữ tỉ lệ nhóm · **Owner chốt 26/11** |

## 7. Rủi ro

- **Lịch:** `analyzeMessage` đã có trên `main` (PR #46, 26/11) và runner tập dev có từ 27/11. Việc chỉnh theo dev phải xong trước khi đóng băng 30/11. Soạn câu (T-100) phải xong trước đó, độc lập với S3.
- **Chi phí và hạn mức Groq:** một lần chạy đầy đủ khoảng 480 lời gọi, cộng các lần chạy dev khi chỉnh. Groq gói miễn phí có thể làm lần chạy kéo dài hàng giờ vì 429. Đặt khoảng nghỉ, chạy từ sớm, và theo dõi chi phí (Q-06).
- **Mẫu nhỏ:** 32 câu held-out × 3 lượt. Một câu sai làm số thay đổi vài điểm phần trăm. B.5 phải ghi mẫu số và câu giới hạn.
