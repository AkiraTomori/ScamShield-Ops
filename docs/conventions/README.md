# Quy ước viết code

**Trạng thái (20/11/2026):** BẢN NHÁP. Áp dụng từ slice nền móng. Mục ghi *(đề xuất, chờ owner)* chưa được duyệt.

Thứ bậc: [spec](../spec/ScamShield-v1.md) > [system-design](../architecture/system-design.md) > contracts/api > **conventions**. Quy ước lệch với tài liệu cấp trên thì dừng và báo owner.

| File | Nội dung |
|---|---|
| [backend.md](./backend.md) | Route handler, module trong `packages/core`, DB, LLM, gọi ra ngoài, log, test phía server |
| [frontend.md](./frontend.md) | Trang Next.js, component, Tailwind, câu chữ, a11y, test giao diện |
| [contracts.md](./contracts.md) | Zod schema dùng chung, mã lỗi, đặt tên trường, đổi hợp đồng |
| [libraries.md](./libraries.md) | Thư viện được phép dùng; thêm thư viện phải hỏi owner |

## Chung cho mọi code

**Ngôn ngữ.** Mã, tên biến, comment, commit, tên test: tiếng Anh. Chữ hiện trên UI và thông báo lỗi cho người dùng: tiếng Việt. Tài liệu: tiếng Việt.

**TypeScript.**
- `strict: true`, thêm `noUncheckedIndexedAccess`. Không dùng `any`; dữ liệu chưa biết hình dạng là `unknown` rồi parse bằng zod.
- Không dùng `!` (non-null assertion) ngoài file test.
- Named export. Default export chỉ ở những file Next.js bắt buộc (`page.tsx`, `layout.tsx`, …) và file cấu hình công cụ.
- Không dùng `enum` của TypeScript; dùng `z.enum([...])` và kiểu suy ra từ đó.

**Đặt tên.**
- Tên file và thư mục: `kebab-case` (`verdict-rules.ts`, `verdict-banner.tsx`).
- Kiểu và component: `PascalCase`. Hàm, biến: `camelCase`. Hằng cấu hình: `SCREAMING_SNAKE_CASE`.
- Giá trị enum nghiệp vụ giữ đúng spec, `snake_case` tiếng Anh: `high_risk`, `pending_review`, `confirmed_scam`.

**Ranh giới module** (system-design §3): `apps/web` → `packages/core` → `packages/shared`. Mỗi module trong `packages/core/src/<module>/` chỉ lộ API qua `index.ts`; module khác không import file bên trong. Cấm vòng phụ thuộc.

**Git.**
- Nhánh `feat/<slice>`, `fix/<việc>`, `docs/<việc>`, `chore/<việc>`.
- Commit `type(scope): description` (Conventional Commits, tiếng Anh). Scope là module hoặc app: `feat(analysis): …`, `chore(web): …`.
- Không commit, push, mở PR, merge hay deploy khi owner chưa yêu cầu (AGENTS.md).

**Dữ liệu mẫu và test.** Chỉ dùng tên miền dành riêng (`*.example`, `example.com`, `*.test`) cho phía kẻ gửi tin. Tên thương hiệu thật chỉ xuất hiện trong file dữ liệu thương hiệu (Q-10) và trong nội dung tin nhắn mẫu được phân tích.

**Định nghĩa xong** (AGENTS.md):
- `npm run verify` xanh.
- Mỗi AC của slice có test ghi mã `SO-xx-ACnn` trong tên test, hoặc có bước kiểm tay kèm bằng chứng.
- Đổi prompt hoặc quy tắc verdict thì chạy lại eval tập dev và ghi kết quả.

**Thêm thư viện.** Hỏi owner trước; được duyệt thì thêm một dòng vào [libraries.md](./libraries.md) **cùng PR** với lần cài.
