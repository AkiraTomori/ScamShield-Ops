# Quy ước backend

**Trạng thái (20/11/2026):** BẢN NHÁP. "Backend" là route handlers trong `apps/web/src/app/api/` và module trong `packages/core` (system-design §2–§3).

## 1. Route handler: mỏng

Mỗi route handler chỉ làm bốn việc, theo thứ tự:

1. Kiểm quyền (route FraudOps: chưa đăng nhập thì 401, SO-06-AC01).
2. Parse request bằng schema trong `packages/shared`.
3. Gọi **một** hàm công khai của module trong `packages/core`.
4. Ánh xạ kết quả hoặc lỗi nghiệp vụ sang HTTP status + body theo [contracts.md §4](./contracts.md#4-lỗi).

Không đặt logic nghiệp vụ, truy vấn DB hay gọi LLM trực tiếp trong route handler. Route chạy Node.js runtime; route có I/O chậm khai báo `maxDuration` rõ ràng. Route trả dữ liệu động khai báo dynamic và `Cache-Control: no-store`.

## 2. Module trong `packages/core`

- Một thư mục mỗi module (`db`, `analysis`, `reports`, `cases`, `auth`, `indicators`, `llm`, `lookup`), API công khai ở `index.ts`.
- **Không import `next`** hay thứ gì chỉ có trong Next.js; eval runner (SO-09) gọi thẳng module.
- **Phụ thuộc truyền vào bằng tham số**, không dùng DI container, không đọc biến toàn cục bên trong logic: DB, LLM client, client tra cứu ngoài, đồng hồ (`now()`), bộ sinh ID. Hàm tạo phụ thuộc thật nằm ở một chỗ (`packages/core/src/deps.ts` hoặc tương đương) và được route handler, eval runner gọi.
- Logic tất định (trích chỉ dấu, kiểm URL, che dữ liệu, quy tắc verdict) là **hàm thuần**: không I/O, không đồng hồ, cùng đầu vào cùng đầu ra (SO-02-AC01, SO-03-AC02).
- Lỗi nghiệp vụ dự đoán được (không tìm thấy, xung đột, vượt giới hạn) trả về dạng kết quả có kiểu (`{ ok: false, error: { code } }`) hoặc ném lớp `AppError` có `code` thuộc enum lỗi chung; chọn một cách trong slice nền móng và dùng thống nhất. Lỗi không dự đoán được để ném lên, route handler trả `internal`.

## 3. Cơ sở dữ liệu (Drizzle + postgres.js)

- Định nghĩa bảng ở `packages/core/src/db/schema/`. Thiết kế bảng theo `/sdlc:database`.
- **Mọi bảng bật RLS và không có policy** (system-design §4).
- Thao tác ghi nhiều bảng (report + case, kết luận + chỉ dấu đã xác minh) chạy trong **một transaction**.
- Tính bất biến do **ràng buộc DB** bảo đảm, không chỉ do code kiểm trước:
  - Một analysis chỉ có một case: unique constraint (SO-04-AC03); tạo trùng thì bắt lỗi unique và trả case đã có.
  - Đóng hồ sơ: cập nhật có điều kiện `WHERE status = 'pending_review'`; không có dòng nào đổi thì trả `conflict` (ui-pages §6.2).
- Migration: `drizzle-kit generate` ra file SQL, **đọc lại file SQL** trước khi commit. Không sửa migration đã chạy trên DB deploy; sai thì viết migration mới. Chỉ owner chạy migrate lên DB deploy.
- Không ghép chuỗi SQL từ dữ liệu người dùng; dùng query builder hoặc `sql` template có tham số.

## 4. LLM (Groq) và nội dung người dùng

- Prompt nằm trong file riêng trong module `llm`, có hằng `PROMPT_VERSION`.
- Nội dung người dùng **đã che** (SO-01-AC03) mới được gửi đi, và luôn nằm trong khối phân tách rõ ở **tin nhắn user**, không bao giờ ghép vào system prompt (AGENTS.md). Chỉ dẫn trong prompt nói rõ nội dung trong khối là dữ liệu cần phân tích.
- Mọi lời gọi có timeout; tổng thời gian một analysis tôn trọng trần 20 giây (spec §9).
- Đầu ra parse bằng zod; sai thì thử lại đúng 1 lần (SO-03-AC01).
- LLM **không** trả verdict; verdict do quy tắc trong code (P4). Bước giải thích chỉ nhận signal và kết quả kiểm, không nhận nguồn khác (SO-03-AC05).
- Model và tham số đọc từ cấu hình, để đổi model dự phòng không cần sửa code (plan §8).

## 5. Gọi ra ngoài và P5

- **Không bao giờ** fetch, tải hay render URL do người dùng gửi, kể cả trong test, script, eval (P5).
- Mọi HTTP ra ngoài đi qua **một** client trong `packages/core/src/http/` có danh sách host cho phép (API Groq, RDAP, Safe Browsing). Host ngoài danh sách thì ném lỗi trước khi gửi.
- Cấu hình ESLint cấm dùng `fetch` toàn cục trong `packages/core` ngoài thư mục `http/` (`no-restricted-globals` / `no-restricted-syntax`), để vi phạm P5 bị chặn ở `npm run verify`.
- Tra cứu ngoài lỗi hoặc quá thời gian thì phép kiểm là `unavailable`, không phải "sạch" (SO-02-AC03).

## 6. Log và bí mật

- Log dạng JSON một dòng qua một logger nhỏ tự viết (`console` bên dưới); trường: `event`, `analysisId`/`caseId`, `code`, `durationMs`.
- **Không log:** nội dung tin nhắn (kể cả đã che), ghi chú người báo cáo, mã bí mật, mật khẩu, cookie, API key, chuỗi kết nối, IP thô.
- Bí mật chỉ đọc từ biến môi trường qua schema env (contracts.md §2).

## 7. Mật khẩu và phiên (FraudOps)

Chi tiết thuộc slice FraudOps. Định hướng để không thêm thư viện: băm mật khẩu và mã bí mật bằng `scrypt` của `node:crypto`, so sánh bằng `timingSafeEqual`; phiên là cookie `HttpOnly`, `Secure`, `SameSite=Lax`, ký hoặc tra bảng phiên trong DB. Đổi định hướng này (ví dụ thêm thư viện auth) phải hỏi owner.

## 8. Test phía server

- Vitest, file `*.test.ts` đặt cạnh file được test.
- Tên test bắt đầu bằng mã AC khi kiểm một tiêu chí: `it("SO-03-AC02: same signals always yield the same verdict", …)`.
- Unit test **không** gọi LLM hay mạng thật; dùng client giả truyền vào (§2).
- Test tích hợp DB chạy với Postgres local (`docker compose`), tự bỏ qua khi thiếu `DATABASE_URL`; mỗi test dọn dữ liệu của mình. Không bao giờ trỏ test vào DB deploy.
- Quy tắc verdict, che dữ liệu, trích chỉ dấu, kiểm URL viết theo `/sdlc:tdd`.
