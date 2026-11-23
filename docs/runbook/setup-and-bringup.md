# Cài đặt và bring-up (local)

**Trạng thái (21/11/2026):** bản nháp, có slice nền móng, schema P0 (chưa seed/reset) và runner thử model S2 (nhánh `feat/model-spike`, đã chạy Groq thật 21/11). Phần deploy (Supabase, Vercel) là việc của owner, xem [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay).

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

## 2. Postgres local (Docker)

- Image `postgres:${POSTGRES_VERSION}-bookworm` (Debian, glibc). Không dùng alpine vì musl có thể sắp xếp/so khớp chuỗi khác với Postgres managed. Đặt `POSTGRES_VERSION` trùng major version của project Supabase (kiểm trên dashboard lúc tạo project; mặc định 17 chỉ là giá trị tạm).
- Cổng chỉ mở ở `127.0.0.1`. Dữ liệu ở volume `scamshield-pgdata`.
- Dừng: `docker compose down`. **Xoá cả dữ liệu:** `docker compose down -v` (chỉ làm khi muốn DB trống).
- Container chỉ nhận biến `POSTGRES_*`; `GROQ_API_KEY` không vào container.

## 3. Đổi API key hoặc chuỗi kết nối

| Muốn đổi | Local | Vercel |
|---|---|---|
| `GROQ_API_KEY` | Sửa `.env`, khởi động lại `npm run dev` | Sửa biến trong project settings, redeploy |
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

## 4. Migration

- `npm run db:generate`: sinh SQL từ schema (đọc lại file trước khi commit).
- `npm run db:migrate`: dùng `DATABASE_URL_MIGRATE`, nếu trống thì `DATABASE_URL`. Với DB local thì tự chạy được; với DB đã deploy chỉ owner chạy.
- Migration `0000_p0_tables` (8 bảng P0) đã có; test tích hợp `*.int.test.ts` chỉ chạy khi đặt `DATABASE_URL` trỏ tới Postgres local.

## 5. Lỗi thường gặp

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `/api/health` trả 503 | `docker compose ps` chưa healthy; mật khẩu trong `DATABASE_URL` lệch `POSTGRES_PASSWORD`; chưa có `.env`. Nhật ký chỉ ghi `timeout`, `connect_failed` hoặc `config_missing` |
| Đổi `POSTGRES_PASSWORD` mà vẫn sai mật khẩu | Volume cũ giữ mật khẩu cũ; xem §3 |
| `docker compose up` báo thiếu `POSTGRES_PASSWORD` | Chưa tạo `.env` |
| Cổng 5432 bận | Đặt `POSTGRES_PORT` khác trong `.env` và sửa cổng trong `DATABASE_URL` |

## 6. Deploy (owner)

Thứ tự cho lần đầu (chi tiết và lý do ở [system-design §8](../architecture/system-design.md#8-việc-owner-phải-làm-agent-không-làm-thay)):

1. Tạo project Supabase ở region Singapore. Ghi lại major version Postgres và đặt `POSTGRES_VERSION` local cho khớp.
2. Tắt Data API của project.
3. Tạo project Vercel nối repo GitHub, root là gốc repo, region function gần Singapore.
4. Đặt `DATABASE_URL` (chuỗi transaction pooler) **chỉ cho môi trường Production** (D-03). Preview không có DB, `/api/health` ở preview trả 503 là đúng.
5. Merge PR vào `main` để deploy production.
6. Có bảng rồi thì chạy migration từ máy owner: đặt `DATABASE_URL_MIGRATE` (kết nối trực tiếp hoặc session) trong `.env`, chạy `npm run db:migrate`. Không bao giờ chạy trong build.

**Kiểm sau mỗi lần deploy production:**
- `curl -i https://<domain>/api/health` trả 200, có `Cache-Control: no-store`, `version` khớp commit vừa merge.
- Gọi lại sau vài giây: `time` phải khác lần trước (không bị cache lúc build).
- Mở `/` ở chế độ ẩn danh trên điện thoại: có disclaimer, không cuộn ngang.

**Giữ link sống 03/12–11/12:** xem D-04 ở system-design §9 và lịch kiểm hằng ngày ở [demo.md §5](./demo.md#5-giai-đoạn-chấm-0312112).

