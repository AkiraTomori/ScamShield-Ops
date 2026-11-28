# Cài đặt và bring-up (local)

**Trạng thái (28/11/2026):** bản nháp; thêm mục E2E (§1) và viết lại mục deploy Vercel (§6), chưa deploy lần nào; đăng nhập FraudOps (T-060, đã merge, PR #51); có `POST /api/analyses` (PR #46, đã merge, chưa deploy); runner eval dev (§3c) đã merge (PR #47); có slice nền móng, schema P0 (seed/reset T-090 xong ở local, seed đã chạy trên Supabase, chưa merge) và runner thử model S2 (đã merge vào `main`, PR #4; đã chạy Groq thật 21–23/11). Phần deploy (Supabase, Vercel) là việc của owner, xem [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay).

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
2. `npm run demo:seed`: tạo hoặc cập nhật `judge1…judge5` trên DB mà `DATABASE_URL` trỏ tới, rồi xoá và chèn lại 24 hồ sơ mẫu `SC-0001…SC-0024`. **Kiểm `DATABASE_URL` trước khi chạy**; với DB deploy chỉ owner chạy. Muốn tra được `SC-0001` ở `/tra-cuu` thì đặt `DEMO_LOOKUP_SECRET` (8 chữ hoặc số, không có U). `npm run demo:reset` chỉ làm mới hồ sơ mẫu, không đổi tài khoản.
3. `npm run dev`, mở `http://localhost:3000/ops`. Đăng nhập quá 5 lượt trong một phút thì nhận 429.

Trên Vercel (khi deploy): sau migration, owner chạy `demo:seed` với `DATABASE_URL` của production, rồi kiểm ngay một lượt đăng nhập. Nếu nhận 403 `forbidden_origin` thì header `Host` hoặc `x-forwarded-proto` sau proxy không khớp `Origin` ([fraudops §11](../design/fraudops.md#11-ghi-chú-cài-đặt-28112026)).

### Chạy seed trên production (chỉ owner)

1. Chạy migration `0000_p0_tables` và `0001_confirmed_indicators` trên DB deploy trước.
2. Trong `.env` của máy chạy lệnh: `DATABASE_URL` của production, `DEMO_STAFF_PASSWORDS`, và (nên có) `DEMO_LOOKUP_SECRET`. Chạy xong thì trả `DATABASE_URL` về DB local.
3. `npm run demo:seed`. Lệnh chỉ in số dòng đã xoá và chèn.
4. Kiểm: đăng nhập `judge1`, chọn trạng thái "Tất cả", thấy 24 hồ sơ "Dữ liệu mẫu"; mở `/tra-cuu` với `SC-0001` và mã bí mật; `/ops/chi-dau` không có `vi-xac-minh.example`.
5. Về sau chạy `npm run demo:reset`. Hồ sơ và kết luận không phải mẫu được giữ; kết luận của giám khảo trên hồ sơ mẫu bị xoá. Nên chạy ngoài giờ chấm: ai đang mở hoặc đang lưu kết luận trên hồ sơ mẫu lúc đó có thể gặp 404 hoặc một lỗi; tải lại trang là được.

### Chạy E2E luồng demo (T-092)

E2E luôn chạy trên Postgres **local**, với file env riêng `.env.e2e` (gitignored).

```bash
docker compose up -d --wait
npx playwright install chromium   # lần đầu trên máy
npm run e2e:setup                 # lần đầu, hoặc muốn làm mới dữ liệu mẫu
npm run test:e2e                  # tự bật server ở cổng 3100; tắt `npm run dev` trước
```

- `e2e:setup` viết `.env.e2e` nếu chưa có (DB `scamshield_e2e` trên Docker của `.env`, mật khẩu và salt ngẫu nhiên), rồi tạo DB, migrate và seed. Lệnh chỉ đọc địa chỉ DB từ `.env.e2e` và từ chối host không phải máy này.
- `test:e2e` không bao giờ dùng `DATABASE_URL` trong `.env`, kể cả khi nó trỏ Supabase. Khoá model (`GROQ_*`) vẫn lấy từ `.env`.
- Mỗi lần chạy gọi Groq thật khoảng 3 lượt và tạo một hồ sơ đã đóng trong DB local.
- Chạy trên bản deploy: chạy tay, tối đa một lần ở mốc đóng băng. `E2E_BASE_URL` **chỉ đọc từ shell** (ghi trong file env thì bị bỏ qua), mật khẩu `judge1` của bản đó đặt ở `E2E_JUDGE_PASSWORD` trong `.env`: `E2E_BASE_URL=https://<domain> npm run test:e2e`.
- Trên bản deploy, test không giữ file nào khi hỏng. Chạy local thì `apps/web/test-results/` (gitignored) có ảnh và nội dung trang, có thể gồm mã bí mật của hồ sơ thử trong DB local.

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
| Request đầu sau một lúc không dùng trả 500, log có mã `rate_limit`; gọi lại thì được | Mở kết nối mới tới DB ở xa lâu hơn hạn 1 giây của bước giới hạn tần suất (đã thấy 28/11 khi chạy app ở local trỏ Supabase, [demo-data §12](../design/demo-data.md#12-kiểm-trên-db-supabase-28112026)). Kiểm region của Supabase và của function |
| `docker compose up` báo thiếu `POSTGRES_PASSWORD` | Chưa tạo `.env` |
| Cổng 5432 bận | Đặt `POSTGRES_PORT` khác trong `.env` và sửa cổng trong `DATABASE_URL` |

## 6. Deploy (owner)

Thứ tự cho lần đầu (lý do ở [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay)). Chưa chạy lần nào trên Vercel.

### 6.1 Supabase

1. Tạo project ở region Singapore. Tắt Data API. Ghi lại major version Postgres và đặt `POSTGRES_VERSION` local cho khớp.
2. Lấy hai chuỗi kết nối, không trộn lẫn:

| Biến | Chuỗi của Supabase | Đặt ở đâu |
|---|---|---|
| `DATABASE_URL_MIGRATE` | Session pooler (hoặc direct), cổng 5432 | Chỉ `.env` trên máy owner |
| `DATABASE_URL` | Transaction pooler, cổng 6543 | Vercel Production |

Khi `.env` trên máy owner trỏ `DATABASE_URL` tới Supabase thì `npm run dev`, `db:migrate`, `demo:seed` và `demo:reset` đều chạm DB thật. Test tích hợp tự từ chối host không phải local.

### 6.2 Migration

*(Đã chạy trên Supabase: kiểm 28/11 thấy 2 migration.)* Đặt `DATABASE_URL_MIGRATE` trong `.env` (đúng tên này; `grep -o '^[A-Z_]*=' .env` chỉ in tên biến), rồi chạy `npm run db:migrate` từ máy owner (`0000` và `0001`). Làm **trước** lần deploy đầu. Chừng nào biến này còn trỏ Supabase thì mọi `db:migrate` đều chạy lên production; muốn migrate DB local thì dùng `DATABASE_URL_MIGRATE= npm run db:migrate`. Không bao giờ chạy migration trong build.

### 6.3 File biến môi trường để import vào Vercel

Tạo `.env.vercel` ở gốc repo. File này đã nằm trong `.gitignore` (`.env.*`); không commit, không dán vào chat. Hai lệnh dưới không để giá trị nào lên dòng lệnh:

```bash
grep -E '^(GROQ_API_KEY|GROQ_MODEL_SIGNALS|GROQ_MODEL_EXPLAIN|GROQ_REASONING_EFFORT|LLM_DAILY_CALL_CAP)=.+' .env > .env.vercel
echo "RATE_LIMIT_SALT=$(openssl rand -hex 32)" >> .env.vercel
```

Rồi mở file bằng editor, thêm một dòng `DATABASE_URL=` với chuỗi **transaction pooler**.

| Biến | Bắt buộc |
|---|---|
| `DATABASE_URL`, `GROQ_API_KEY`, `GROQ_MODEL_SIGNALS`, `GROQ_MODEL_EXPLAIN`, `RATE_LIMIT_SALT` | Có |
| `GROQ_REASONING_EFFORT`, `LLM_DAILY_CALL_CAP` | Không |

**Không** đưa lên Vercel: `DATABASE_URL_MIGRATE`, `DEMO_STAFF_PASSWORDS`, `DEMO_LOOKUP_SECRET`, `E2E_*`, `POSTGRES_*`.

### 6.4 Project Vercel

1. Add New → Project, nối repo GitHub. **Chưa nhập biến môi trường ở màn hình này** (tài liệu Vercel không nói biến nhập ở đây áp cho môi trường nào).
2. **Root Directory: `apps/web`.** Giữ bật tuỳ chọn cho build đọc file ngoài Root Directory (mặc định bật).
3. `apps/web/vercel.json` đặt sẵn lệnh cài `cd ../.. && npm ci` và region `sin1` (Singapore). Không có lệnh cài này thì build hỏng với `Can't resolve '@scamshield/core'` (đã thử trên bản sao ở local 28/11). File này chưa có trên `main` cho tới khi merge `feat/s9-demo-seed`; muốn deploy `main` trước thì đặt Install Command và Function Region tương đương trong dashboard.
4. Deploy lần đầu. Chưa có biến nên `/api/health` trả 503, đúng như dự kiến.
5. Settings → Build and Deployment → Node.js Version: chọn **24.x** cho khớp `.nvmrc` (Vercel mặc định 26.x và không đọc `engines` ở gốc repo khi Root Directory là `apps/web`).
6. Settings → Environment Variables → **Import .env**, chọn `.env.vercel`, chỉ tick **Production** (D-03). Kiểm lại danh sách: không biến nào hiện Preview hay Development.
7. **Xoá `.env.vercel` khỏi máy** (`rm .env.vercel`). File này chứa key thật; `.gitignore` không chặn nó lọt vào file `.zip` nếu nén cả thư mục.
8. Redeploy để biến có hiệu lực. Đổi biến về sau cũng phải redeploy.

Gói Hobby cho một region và `maxDuration` tới 300 s (route phân tích đặt 30 s), theo tài liệu Vercel đọc ngày 28/11. Chưa kiểm: header `x-forwarded-for` trên bản deploy, điều khoản sử dụng của gói Hobby.

Sau đó seed theo [Chạy seed trên production](#chạy-seed-trên-production-chỉ-owner).

**Kiểm sau mỗi lần deploy production:**
- `curl -i https://<domain>/api/health` trả 200, có `Cache-Control: no-store`, `version` khớp commit vừa merge.
- Gọi lại sau vài giây: `time` phải khác lần trước (không bị cache lúc build).
- Mở `/` ở chế độ ẩn danh trên điện thoại: có disclaimer, không cuộn ngang.

**Giữ link sống 03/12–11/12:** xem D-04 ở system-design §9 và lịch kiểm hằng ngày ở [demo.md §5](./demo.md#5-giai-đoạn-chấm-03121112).

