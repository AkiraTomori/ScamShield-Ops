# Cài đặt và bring-up (local)

**Trạng thái (28/11/2026):** bản nháp; đăng nhập FraudOps (T-060, đã merge, PR #51); có `POST /api/analyses` (PR #46, đã merge, chưa deploy); runner eval dev (§3c) đã merge (PR #47); có slice nền móng, schema P0 (chưa seed/reset) và runner thử model S2 (đã merge vào `main`, PR #4; đã chạy Groq thật 21–23/11). Phần deploy (Supabase, Vercel) là việc của owner, xem [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay).

## 1. Chạy lần đầu

```bash
cp .env.example .env        # .env đã gitignore; mọi bí mật chỉ ở file này
# sửa POSTGRES_PASSWORD, và cùng mật khẩu đó trong DATABASE_URL
docker compose up -d --wait # Postgres local, chờ tới khi healthy
npm ci
npm run dev
curl -i http://localhost:3000/api/health   # 200 {"status":"ok","db":"ok",...}
npm run verify
```

- Một file `.env` ở gốc repo cho tất cả: Docker Compose, Next.js (qua `next.config.ts`), `drizzle-kit`. Biến đã có sẵn trong môi trường (shell, Vercel) thắng giá trị trong `.env`; thiếu `.env` (CI, Vercel) vẫn chạy.
- Test tích hợp (`*.int.test.ts`) chỉ chạy khi có `DATABASE_URL` trong môi trường: `set -a; . ./.env; set +a; npx vitest run`. Thiếu thì tự bỏ qua. Test không bao giờ đọc `.env` tự động, để không chạm DB thật nhầm.

### Gọi thử `POST /api/analyses`

Cần đã chạy migration (§4) và đặt trong `.env`: `GROQ_API_KEY`, `GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN`, `RATE_LIMIT_SALT` (xem `.env.example`). Mỗi lượt gọi Groq thật 1–3 lần.

```bash
curl -s http://localhost:3000/api/analyses -H 'content-type: application/json' \
  -d '{"content":"Tài khoản của bạn sẽ bị khoá trong 2 giờ. Xác minh tại vi-xac-minh.example và nhập mã OTP."}'
```

Server log `llm_call_failed` với `unavailable_429` nghĩa là Groq đang giới hạn tần suất; `config_401` là sai `GROQ_API_KEY`, `config_404` là sai tên model.

### Đăng nhập FraudOps ở local

1. Cần đã chạy migration (§4) và đặt trong `.env`: `RATE_LIMIT_SALT`, `DEMO_STAFF_PASSWORDS` (5 mật khẩu ngăn bởi dấu phẩy, mỗi mật khẩu ít nhất 12 ký tự).
2. `npm run demo:seed`: tạo hoặc cập nhật `judge1…judge5` trên DB mà `DATABASE_URL` trỏ tới. **Kiểm `DATABASE_URL` trước khi chạy**; với DB deploy chỉ owner chạy. Chưa chèn hồ sơ mẫu (T-090).
3. `npm run dev`, mở `http://localhost:3000/ops`. Đăng nhập quá 5 lượt trong một phút thì nhận 429.

Trên Vercel (khi deploy): sau migration, owner chạy `demo:seed` với `DATABASE_URL` của production, rồi kiểm ngay một lượt đăng nhập. Nếu nhận 403 `forbidden_origin` thì header `Host` hoặc `x-forwarded-proto` sau proxy không khớp `Origin` ([fraudops §11](../design/fraudops.md#11-ghi-chú-cài-đặt-28112026)).

## 2. Postgres local (Docker)

- Image `postgres:${POSTGRES_VERSION}-bookworm` (Debian, glibc). Không dùng alpine vì musl có thể sắp xếp/so khớp chuỗi khác với Postgres managed. Đặt `POSTGRES_VERSION` trùng major version của project Supabase (kiểm trên dashboard lúc tạo project; mặc định 17 chỉ là giá trị tạm).
- Cổng chỉ mở ở `127.0.0.1`. Dữ liệu ở volume `scamshield-pgdata`.
- Dừng: `docker compose down`. **Xoá cả dữ liệu:** `docker compose down -v` (chỉ làm khi muốn DB trống).
- Container chỉ nhận biến `POSTGRES_*`; `GROQ_API_KEY` không vào container.

## 3. Đổi API key hoặc chuỗi kết nối

| Muốn đổi | Local | Vercel |
|---|---|---|
| `GROQ_API_KEY` | Sửa `.env`, khởi động lại `npm run dev` | Sửa biến trong project settings, redeploy |
| Đổi sang model dự phòng (`GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN`) | Như trên | Như trên |
| Trỏ `DATABASE_URL` từ Docker sang Supabase | Sửa một dòng trong `.env` (dùng transaction pooler), khởi động lại | Biến Production |
| Mật khẩu Postgres local | Đổi `POSTGRES_PASSWORD` **và** mật khẩu trong `DATABASE_URL`; mật khẩu chỉ có hiệu lực khi volume mới: `docker compose down -v` rồi `up` | Không áp dụng |

Không dán key vào chat, commit hay dòng lệnh.

## 3b. Thử model Groq (slice S2)

```bash
npm run eval:q08 -- --list-models                          # cần GROQ_API_KEY trong .env; chỉ liệt kê model
npm run eval:q08 -- --models <a>,<b> --runs 3 --price-in 0.5,0.2 --price-out 1,0.4   # chỉ in ước tính, không gọi
npm run eval:q08 -- --models <a>,<b> --runs 3 --confirm    # chạy thật (tốn tiền): báo ước tính cho owner trước
```

- Runner đọc `.env` qua `process.loadEnvFile`; thiếu `GROQ_API_KEY` thì báo lỗi, không đoán.
- Đầu ra thô ở `eval/.cache/q08/` (gitignore); kết quả đã tổng hợp ở `eval/results/q08-<ngày>-<commit>.json` và bảng chấm tiếng Việt `eval/results/q08-grading-<model>__<hash câu>__<tag prompt>.md` (commit được; runner không ghi đè bảng đã có điểm). Dừng bằng Ctrl+C rồi chạy lại với `--resume`.
- Tên model không ghi cứng: lấy từ `--list-models`, ghi vào [research A.6](../research/result.md).

## 3c. Eval cả pipeline trên tập dev (slice S10, một phần)

```bash
npm run eval -- --set dev --gap-ms 65000        # chỉ in ước tính, không gọi
npm run eval -- --set dev --gap-ms 65000 --yes  # chạy thật (tốn tiền, hơn 1 giờ): hỏi owner trước
```

- Cần `GROQ_API_KEY`, `GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN` trong `.env` hoặc môi trường (`GROQ_REASONING_EFFORT` mặc định `low`). Không cần DB: không lưu, không rate limit, không trần gọi, không tra cứu ngoài.
- Không tự thử lại khi Groq trả 429, giống production; lượt đó vẫn được tính. `--gap-ms` giãn cách các lượt.
- Bị ngắt thì chạy lại cùng lệnh: lượt đã xong đọc từ `eval/.cache/pipeline/`. Khoá cache gồm commit HEAD, không gồm thay đổi chưa commit: sửa pipeline mà chưa commit thì xoá cache trước khi chạy lại.
- Kết quả: `eval/results/<ngày>-dev-<commit>.json` và `…-summary.md` (có sẵn một dòng cho [research B.4](../research/result.md)). File cùng ngày và commit đã có thì lượt mới ghi thành `…-2`, `…-3`; lệnh chạy thử (không `--yes`) in tên sẽ dùng.

## 4. Migration

- `npm run db:generate`: sinh SQL từ schema (đọc lại file trước khi commit).
- `npm run db:migrate`: dùng `DATABASE_URL_MIGRATE`, nếu trống thì `DATABASE_URL`. Với DB local thì tự chạy được; với DB đã deploy chỉ owner chạy. Khi `DATABASE_URL_MIGRATE` đang trỏ DB deploy mà cần migrate DB local, chạy `DATABASE_URL_MIGRATE= npm run db:migrate` (biến rỗng thắng giá trị trong `.env`, rồi rơi về `DATABASE_URL`).
- Migration `0001_confirmed_indicators` (bảng chỉ dấu đã xác minh, T-082, nhánh `feat/s8-confirmed-indicators`): DB đã migrate trước đó phải chạy lại `npm run db:migrate`. Với DB deploy, owner chạy **trước** khi deploy mã.
- Migration `0000_p0_tables` (8 bảng P0) đã có; test tích hợp `*.int.test.ts` chỉ chạy khi đặt `DATABASE_URL` trỏ tới Postgres local.

## 5. Lỗi thường gặp

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `/api/health` trả 503 | `docker compose ps` chưa healthy; mật khẩu trong `DATABASE_URL` lệch `POSTGRES_PASSWORD`; chưa có `.env`. Nhật ký chỉ ghi `timeout`, `connect_failed` hoặc `config_missing` |
| Đổi `POSTGRES_PASSWORD` mà vẫn sai mật khẩu | Volume cũ giữ mật khẩu cũ; xem §3 |
| Gửi báo cáo có ghi chú dài trả 500, log `report_failed` | DB local đã migrate trước 27/11 vẫn giữ CHECK ghi chú 500 ký tự (RP-01 sửa thẳng `0000_p0_tables`, drizzle không chạy lại). Chạy `ALTER TABLE cases DROP CONSTRAINT cases_reporter_note_len, ADD CONSTRAINT cases_reporter_note_len CHECK (reporter_note IS NULL OR char_length(reporter_note) <= 1000);` bằng `docker compose exec postgres psql`, hoặc xoá cả volume (`docker compose down -v`, **mất dữ liệu**) rồi migrate lại |
| Kiểm tin có link, SĐT hay số tài khoản trả 500, log `verified_lookup_failed` rồi `analysis_failed` | DB chưa có bảng `confirmed_indicators`: chạy `npm run db:migrate` (§4). Tin không có chỉ dấu vẫn chạy bình thường |
| `/ops/chi-dau` hiện "Không tải được danh sách." | DB chưa có bảng `confirmed_indicators`: chạy `npm run db:migrate` (§4) |
| Lưu kết luận "Xác nhận lừa đảo" trả 500, log `ops_decision_failed` | DB chưa có bảng `confirmed_indicators`: chạy `npm run db:migrate` (§4) |
| `docker compose up` báo thiếu `POSTGRES_PASSWORD` | Chưa tạo `.env` |
| Cổng 5432 bận | Đặt `POSTGRES_PORT` khác trong `.env` và sửa cổng trong `DATABASE_URL` |

## 6. Deploy (owner)

Thứ tự cho lần đầu (chi tiết và lý do ở [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay)):

1. Tạo project Supabase ở region Singapore. Ghi lại major version Postgres và đặt `POSTGRES_VERSION` local cho khớp.
2. Tắt Data API của project.
3. Tạo project Vercel nối repo GitHub, root là gốc repo, region function gần Singapore.
4. Đặt `DATABASE_URL` (chuỗi transaction pooler) **chỉ cho môi trường Production** (D-03). Từ slice S3 đặt thêm `GROQ_API_KEY`, `GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN`, `RATE_LIMIT_SALT`, và kiểm gói Vercel cho phép `maxDuration` 30 s cùng header `x-forwarded-for` đáng tin. Preview không có DB, `/api/health` ở preview trả 503 là đúng.
5. Merge PR vào `main` để deploy production.
6. Có bảng rồi thì chạy migration từ máy owner: đặt `DATABASE_URL_MIGRATE` (kết nối trực tiếp hoặc session) trong `.env`, chạy `npm run db:migrate`. Không bao giờ chạy trong build.

**Kiểm sau mỗi lần deploy production:**
- `curl -i https://<domain>/api/health` trả 200, có `Cache-Control: no-store`, `version` khớp commit vừa merge.
- Gọi lại sau vài giây: `time` phải khác lần trước (không bị cache lúc build).
- Mở `/` ở chế độ ẩn danh trên điện thoại: có disclaimer, không cuộn ngang.

**Giữ link sống 03/12–11/12:** xem D-04 ở system-design §9 và lịch kiểm hằng ngày ở [demo.md §5](./demo.md#5-giai-đoạn-chấm-03121112).

