# ScamShield Ops — Cấu trúc mã nguồn

**Trạng thái (28/11/2026):** BẢN NHÁP, **dự kiến**. Slice nền móng (PR #2), slice dữ liệu P0 (PR #3) và slice S2 thử model (PR #4) đã merge vào `main`; slice S3 đã merge (PR #46, 26/11); runner eval dev (một phần S10) đã merge (PR #47, 27/11); slice S5 đã merge (PR #50, 27/11); T-060…T-062 trên nhánh `feat/s6-auth` (28/11, chưa merge); cây dưới đây là đích đến. Test nằm ở `test/` riêng của từng package, không lẫn trong `src/`. Slice nào tạo thư mục nào thì cập nhật file này trong cùng PR. Ranh giới và lý do ở [system-design §3](./system-design.md#3-cấu-trúc-repo-và-ranh-giới-module); cách viết code ở [conventions/](../conventions/README.md).

## 1. Cây thư mục

```
.
├── apps/
│   └── web/                         Next.js (App Router) + Tailwind; deploy lên Vercel
│       ├── postcss.config.mjs       Tailwind v4
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/        ScamShield: page.tsx (/), tra-cuu/
│       │   │   ├── ops/             FraudOps: dang-nhap/, (staff)/ (có header): page.tsx (danh sách), ho-so/[code]/, chi-dau/
│       │   │   └── api/             route handlers (api.md)
│       │   │       ├── health/
│       │   │       ├── analyses/  analyses/[analysisId]/report/
│       │   │       ├── case-status/
│       │   │       └── ops/ session/  cases/[code]/decision/  confirmed-indicators/[id]/removal/
│       │   ├── components/          component dùng chung (design-system §4)
│       │   ├── features/            component theo màn hình: analysis/, report/, lookup/, auth/, cases/, indicators/
│       │   ├── copy/vi.ts           chữ hiển thị
│       │   ├── server/              cầu nối web ↔ core: tạo deps, đọc phiên, ánh xạ lỗi → HTTP
│       │   └── styles/globals.css   token + Tailwind
│       └── e2e/                     Playwright (C-01)
├── packages/
│   ├── shared/                      không phụ thuộc gì trong repo; client import được
│   │   ├── src/
│   │   │   ├── enums.ts             contracts §1
│   │   │   ├── analysis.ts  case.ts  report.ts  ops.ts  health.ts
│   │   │   ├── input.ts             normalizeInput, countInputChars + câu lỗi đầu vào (client dùng được)
│   │   │   ├── url-lists.ts         schema UrlLists
│   │   │   ├── llm.ts               schema đầu ra LLM (contracts §7); AiSignalType; SignalType ở enums.ts
│   │   │   ├── errors.ts            ErrorCode + câu tiếng Việt
│   │   │   ├── brands.ts            schema BrandList
│   │   │   ├── demo-messages.ts     schema + tin mẫu (demo-data §2)
│   │   │   └── env.ts               schema biến môi trường (chỉ dùng ở server)
│   │   └── data/                    brands.json (Q-10), url-lists.json (P-04), demo-messages.json
│   └── core/                        nghiệp vụ; không import next
│       ├── scripts/                 lệnh của owner: demo-seed.ts
│       └── src/
│           ├── deps.ts              tạo phụ thuộc thật (db, llm, http, clock)
│           ├── db/                  client, ping, schema/, migrations/
│           ├── http/                client HTTP ra ngoài có danh sách host cho phép (P5)
│           ├── text/                so khớp không dấu giữ vị trí gốc; cắt chuỗi (hàm thuần)
│           ├── redaction/           che OTP, mật khẩu, số thẻ (hàm thuần)
│           ├── indicators/          trích + chuẩn hoá chỉ dấu (hàm thuần)
│           ├── url-checks/          phép kiểm tất định trên chuỗi URL (hàm thuần)
│           ├── lookup/              RDAP, Safe Browsing (qua http/)
│           ├── llm/                 prompt, gọi Groq, parse đầu ra
│           ├── verdict/             quy tắc verdict + khuyến nghị (hàm thuần)
│           ├── analysis/            điều phối pipeline, lưu analysis
│           ├── rate-limit/
│           ├── reports/             gửi báo cáo, tạo case, mã bí mật, tra trạng thái
│           ├── cases/               danh sách, chi tiết, kết luận, case liên quan
│           ├── confirmed-indicators/
│           ├── auth/                tài khoản nhân viên, mật khẩu, phiên
│           ├── crypto/              băm scrypt dùng chung (mã bí mật, mật khẩu)
│           └── demo/                seed, reset demo, tạo tài khoản thử
├── eval/
│   ├── cases/dev.jsonl              tình huống có nhãn, tập dev (20 câu đầu, owner duyệt 21/11)
│   ├── cases/heldout.jsonl          tập held-out, chỉ chạy khi đóng băng
│   ├── src/                         case.ts (EvalCase), score.ts, estimate.ts, runner.ts, cache.ts, report.ts, args.ts, env.ts, run-q08.ts (CLI thử model Q-08); pipeline-record.ts, pipeline-runner.ts, pipeline-score.ts, pipeline-report.ts, result-path.ts (không ghi đè kết quả), run-eval.ts (CLI `npm run eval`)
│   ├── test/                        Vitest cho eval (không gọi mạng)
│   ├── .cache/                      đầu ra thô, gitignore
│   └── results/                     kết quả đã commit (SO-09-AC04); q08-<ngày>-<commit>.json, <ngày>-dev-<commit>.json + -summary.md
├── docs/
├── tools/sdlc-kit/                  submodule
├── docker-compose.yml               Postgres local
├── .env.example
└── package.json                     npm workspaces + script gốc
```

Module có trong cây nhưng chưa tới slice của nó thì **chưa tạo**. Đã tạo: T-040 (PR #48, đã merge): `apps/web/postcss.config.mjs`, `apps/web/src/components/`, `apps/web/test/{components,copy,styles}/`; T-041 (PR #48): `apps/web/src/features/analysis/` (`AnalysisFeature`, `InputPanel`, `ResultView`, `state.ts`, `submit-analysis.ts`), `apps/web/test/features/`, `packages/shared/src/demo-messages.ts` + `data/demo-messages.json`, entry con trong `exports` của `@scamshield/shared`; T-042 (PR #48): `features/analysis/{view-model.ts,fixtures.ts}`, `components/{SignalList,IndicatorCard,RedactionNotice}.tsx`, entry `@scamshield/shared/brands`, trang dev tạm `apps/web/src/app/xem-truoc/` (xoá trước 30/11); slice S3: `packages/shared/src/{analysis,input,brands,url-lists}.ts` + `data/`, `packages/core/src/{text,redaction,indicators,url-checks,verdict,analysis,rate-limit}/`, `apps/web/src/server/analyses.ts`, `apps/web/src/app/api/analyses/` (`lookup/` chưa tạo, chờ T-035); slice S5: `packages/shared/src/report.ts`, entry `@scamshield/shared/{enums,report}`, `packages/core/src/reports/`, `core/src/db/errors.ts`, `core/src/llm/{summarize-case,output-filters,guard}.ts` + prompt `case-summary-v1`, `apps/web/src/app/{tra-cuu,api/case-status,api/analyses/[analysisId]/report}/`, `apps/web/src/server/{http,reports,case-status}.ts`, `apps/web/src/features/{report,lookup}/` + `features/post-json.ts`, `components/{CodeWithCopy,ConfirmDialog,StatusBadge,TextInput}.tsx`; trang `/` và `/tra-cuu` nằm ở `app/`, chưa dùng nhóm `(public)/`; T-060: `packages/shared/src/ops.ts` + entry `@scamshield/shared/ops`, `packages/core/src/{auth,crypto,demo}/`, `packages/core/scripts/demo-seed.ts`, `apps/web/src/app/{ops,api/ops/session}/`, `apps/web/src/server/{ops-guards,ops-session,ops-auth}.ts`, `apps/web/src/features/auth/`; T-061: `packages/core/src/cases/`, `apps/web/src/features/cases/`, `components/{VerdictBadge,SeedBadge}.tsx` + `verdict-style.ts`; T-062: `packages/shared/src/case.ts`, `core/src/cases/detail.ts`, `apps/web/src/app/ops/(staff)/ho-so/[code]/`, `features/cases/{CaseDetailView,EvidencePanel,AiPanel}.tsx`; slice S2: `packages/shared/src/llm.ts` (+ `SignalType`, `SignalSource` trong `enums.ts`), `packages/core/src/http/` (client có allowlist), `packages/core/src/llm/` (client Groq, prompt `signals-v1` / `explain-v3`, `extractSignals`, `writeExplanation`, `withRateLimitRetry` chỉ cho runner), `eval/` (workspace `@scamshield/eval`); slice nền móng: `apps/web` (trang `/`, `api/health`), `packages/shared` (`health.ts`, `env.ts`, `errors.ts`), `packages/core` (`db/`, `deps.ts`); slice dữ liệu P0: `packages/shared/src/enums.ts`, `packages/core/src/db/schema/` (8 bảng), `packages/core/src/db/migrations/` (`0000_p0_tables`), `packages/core/test/db/` (test tích hợp, cần `DATABASE_URL`).

## 2. Phụ thuộc giữa module trong `packages/core`

```
analysis ─→ redaction, indicators, url-checks, lookup, llm, verdict, confirmed-indicators, rate-limit, db
redaction ─→ indicators (để không che nhầm URL, SĐT, số tài khoản)
url-checks ─→ indicators (kiểu);  verdict ─→ url-checks (so tên miền chính thức)
reports  ─→ llm (tóm tắt), redaction, crypto, db (đọc analyses, ghi cases; kiểu `Db` từ rate-limit)
auth     ─→ crypto, db;  demo ─→ auth, db
cases    ─→ confirmed-indicators (từ T-063/S8), reports (chuẩn hoá mã hồ sơ), auth (kiểu `StaffSession`), db
lookup, llm ─→ http
```

`redaction`, `indicators`, `url-checks`, `verdict` không phụ thuộc module nào có I/O. Không có vòng phụ thuộc.

## 3. Lệnh

Cột *Có chưa* cho biết lệnh đã có trong `package.json` hay mới là dự kiến (kiểm 28/11/2026).

| Lệnh | Làm gì | Ai chạy | Có chưa |
|---|---|---|---|
| `npm run dev` | Chạy Next.js local | Mọi người | Có |
| `npm run verify` | Format, lint, typecheck, Vitest trên mọi workspace | Mọi người, CI | Có |
| `npm run test:e2e` | Playwright với app + Postgres local | Mọi người | Chưa (slice sau) |
| `npm run db:generate` | Sinh file migration SQL từ schema | Người viết slice | Có |
| `npm run db:migrate` | Chạy migration; DB deploy dùng `DATABASE_URL_MIGRATE` | **Owner** với DB deploy | Có |
| `npm run demo:seed` | Nạp case mẫu `is_seed`, tài khoản `judge1…judge5` (mật khẩu ở `DEMO_STAFF_PASSWORDS`) | **Owner** với DB deploy | Có, **mới chỉ tài khoản** (case mẫu ở T-090) |
| `npm run demo:reset` | Xoá và nạp lại dữ liệu `is_seed`, giữ case giám khảo tạo (SO-10-AC04) | **Owner** | Chưa (slice sau) |
| `npm run eval:q08 -- --models <a>,<b> --runs 3` | Thử model Groq (Q-08): chỉ in ước tính; thêm `--confirm` mới gọi Groq (tốn tiền, cần `GROQ_API_KEY` trong `.env`). `--list-models` liệt kê model đang có. Tuỳ chọn: `--price-in/--price-out` (mỗi 1M token), `--resume`/`--fresh`, `--limit N`, `--retry-failed`, `--concurrency N`, `--reuse-signals-from <tag>`, `--no-json-mode <models>`, `--reasoning-format hidden\|parsed`, `--reasoning-effort <v>` | Đội; **hỏi owner trước khi `--confirm`** | Có |
| `npm run eval -- --set dev` | Chạy cả pipeline trên tập dev, chỉ số research B.3. Không có `--yes` thì chỉ in ước tính; `--yes` mới gọi Groq (cần `GROQ_API_KEY`, `GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN`). Tuỳ chọn `--runs N` (mặc định 3), `--gap-ms N` (mặc định 2000). `--set heldout` bị từ chối tới khi có T-103 | **Hỏi owner trước khi `--yes`** | Có (tập dev) |

## 4. Test theo tầng

| Tầng | Công cụ | Ở đâu | Gọi ra ngoài |
|---|---|---|---|
| Hàm thuần (che dữ liệu, chỉ dấu, kiểm URL, verdict) | Vitest | `<package>/test/`, `*.test.ts`, phản chiếu `src/` | Không |
| Module có I/O | Vitest + phụ thuộc giả | `<package>/test/` | Không |
| Tích hợp DB | Vitest + Postgres local | `<package>/test/`, `*.int.test.ts` | Chỉ DB local; bỏ qua nếu thiếu `DATABASE_URL` |
| Route handler | Vitest gọi trực tiếp hàm handler | `apps/web/test/` | Không |
| End-to-end | Playwright | `apps/web/e2e/` | App + DB local; LLM thật hoặc giả theo cấu hình |
| Chất lượng AI | Runner eval | `eval/` | LLM thật |

Tên test ghi mã AC (`SO-xx-ACnn`) khi kiểm một tiêu chí.
