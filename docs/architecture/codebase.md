# ScamShield Ops — Cấu trúc mã nguồn

**Trạng thái (24/11/2026):** BẢN NHÁP, **dự kiến**. Slice nền móng (PR #2), slice dữ liệu P0 (PR #3) và slice S2 thử model (PR #4) đã merge vào `main`; cây dưới đây là đích đến. Test nằm ở `test/` riêng của từng package, không lẫn trong `src/`. Slice nào tạo thư mục nào thì cập nhật file này trong cùng PR. Ranh giới và lý do ở [system-design §3](./system-design.md#3-cấu-trúc-repo-và-ranh-giới-module); cách viết code ở [conventions/](../conventions/README.md).

## 1. Cây thư mục

```
.
├── apps/
│   └── web/                         Next.js (App Router) + Tailwind; deploy lên Vercel
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/        ScamShield: page.tsx (/), tra-cuu/
│       │   │   ├── ops/             FraudOps: dang-nhap/, page.tsx (danh sách), ho-so/[code]/, chi-dau/
│       │   │   └── api/             route handlers (api.md)
│       │   │       ├── health/
│       │   │       ├── analyses/  analyses/[id]/report/
│       │   │       ├── case-status/
│       │   │       └── ops/ session/  cases/[code]/decision/  confirmed-indicators/[id]/removal/
│       │   ├── components/          component dùng chung (design-system §4)
│       │   ├── features/            component theo màn hình: analysis/, report/, lookup/, cases/, indicators/
│       │   ├── copy/vi.ts           chữ hiển thị
│       │   ├── server/              cầu nối web ↔ core: tạo deps, đọc phiên, ánh xạ lỗi → HTTP
│       │   └── styles/globals.css   token + Tailwind
│       └── e2e/                     Playwright (C-01)
├── packages/
│   ├── shared/                      không phụ thuộc gì trong repo; client import được
│   │   ├── src/
│   │   │   ├── enums.ts             contracts §1
│   │   │   ├── analysis.ts  case.ts  report.ts  ops.ts  health.ts
│   │   │   ├── llm.ts               schema đầu ra LLM (contracts §7); AiSignalType; SignalType ở enums.ts
│   │   │   ├── errors.ts            ErrorCode + câu tiếng Việt
│   │   │   ├── brands.ts            schema BrandList
│   │   │   └── env.ts               schema biến môi trường (chỉ dùng ở server)
│   │   └── data/brands.json         danh sách thương hiệu (Q-10)
│   └── core/                        nghiệp vụ; không import next
│       └── src/
│           ├── deps.ts              tạo phụ thuộc thật (db, llm, http, clock)
│           ├── db/                  client, ping, schema/, migrations/
│           ├── http/                client HTTP ra ngoài có danh sách host cho phép (P5)
│           ├── redaction/           che OTP, mật khẩu, số thẻ (hàm thuần)
│           ├── indicators/          trích + chuẩn hoá chỉ dấu (hàm thuần)
│           ├── url-checks/          phép kiểm tất định trên chuỗi URL (hàm thuần)
│           ├── lookup/              RDAP, Safe Browsing (qua http/)
│           ├── llm/                 prompt, gọi Groq, parse đầu ra
│           ├── verdict/             quy tắc verdict + khuyến nghị (hàm thuần)
│           ├── analysis/            điều phối pipeline, lưu analysis
│           ├── rate-limit/
│           ├── reports/             gửi báo cáo, tạo case, tra trạng thái
│           ├── cases/               danh sách, chi tiết, kết luận, case liên quan
│           ├── confirmed-indicators/
│           ├── auth/                tài khoản nhân viên, mật khẩu, phiên
│           └── demo/                seed, reset demo, tạo tài khoản thử
├── eval/
│   ├── cases/dev.jsonl              tình huống có nhãn, tập dev (20 câu đầu, owner duyệt 21/11)
│   ├── cases/heldout.jsonl          tập held-out, chỉ chạy khi đóng băng
│   ├── src/                         case.ts (EvalCase), score.ts, estimate.ts, runner.ts, cache.ts, report.ts, args.ts, run-q08.ts (CLI thử model Q-08)
│   ├── test/                        Vitest cho eval (không gọi mạng)
│   ├── .cache/                      đầu ra thô, gitignore
│   └── results/                     kết quả đã commit (SO-09-AC04); q08-<ngày>-<commit>.json
├── docs/
├── tools/sdlc-kit/                  submodule
├── docker-compose.yml               Postgres local
├── .env.example
└── package.json                     npm workspaces + script gốc
```

Module có trong cây nhưng chưa tới slice của nó thì **chưa tạo**. Đã tạo: slice S2: `packages/shared/src/llm.ts` (+ `SignalType`, `SignalSource` trong `enums.ts`), `packages/core/src/http/` (client có allowlist), `packages/core/src/llm/` (client Groq, prompt `signals-v1` / `explain-v3`, `extractSignals`, `writeExplanation`, `withRateLimitRetry` chỉ cho runner), `eval/` (workspace `@scamshield/eval`); slice nền móng: `apps/web` (trang `/`, `api/health`), `packages/shared` (`health.ts`, `env.ts`, `errors.ts`), `packages/core` (`db/`, `deps.ts`); slice dữ liệu P0: `packages/shared/src/enums.ts`, `packages/core/src/db/schema/` (8 bảng), `packages/core/src/db/migrations/` (`0000_p0_tables`), `packages/core/test/db/` (test tích hợp, cần `DATABASE_URL`).

## 2. Phụ thuộc giữa module trong `packages/core`

```
analysis ─→ redaction, indicators, url-checks, lookup, llm, verdict, confirmed-indicators, rate-limit, db
reports  ─→ analysis (đọc), llm (tóm tắt), rate-limit, db
cases    ─→ confirmed-indicators, db
lookup, llm ─→ http
```

`redaction`, `indicators`, `url-checks`, `verdict` không phụ thuộc module nào có I/O. Không có vòng phụ thuộc.

## 3. Lệnh

| Lệnh | Làm gì | Ai chạy |
|---|---|---|
| `npm run dev` | Chạy Next.js local | Mọi người |
| `npm run verify` | Format, lint, typecheck, Vitest trên mọi workspace | Mọi người, CI |
| `npm run test:e2e` | Playwright với app + Postgres local | Mọi người |
| `npm run db:generate` | Sinh file migration SQL từ schema | Người viết slice |
| `npm run db:migrate` | Chạy migration; DB deploy dùng `DATABASE_URL_MIGRATE` | **Owner** với DB deploy |
| `npm run demo:seed` | Nạp case mẫu `is_seed`, tài khoản `judge1…judge5` | **Owner** với DB deploy |
| `npm run demo:reset` | Xoá và nạp lại dữ liệu `is_seed`, giữ case giám khảo tạo (SO-10-AC04) | **Owner** |
| `npm run eval:q08 -- --models <a>,<b> --runs 3` | Thử model Groq (Q-08): chỉ in ước tính; thêm `--confirm` mới gọi Groq (tốn tiền, cần `GROQ_API_KEY` trong `.env`). `--list-models` liệt kê model đang có. Tuỳ chọn: `--price-in/--price-out` (mỗi 1M token), `--resume`/`--fresh`, `--limit N`, `--retry-failed`, `--concurrency N`, `--reuse-signals-from <tag>`, `--no-json-mode <models>`, `--reasoning-format hidden\|parsed`, `--reasoning-effort <v>` | Đội; **hỏi owner trước khi `--confirm`** |
| `npm run eval -- --set dev` | Chạy eval tập dev (tốn tiền LLM) | Hỏi owner nếu chạy toàn bộ nhiều lần |

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
