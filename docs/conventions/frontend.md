# Quy ước frontend

**Trạng thái (20/11/2026):** BẢN NHÁP. Áp dụng cho `apps/web` (Next.js App Router, Tailwind). Trang và trạng thái ở [ui-pages.md](../product/ui-pages.md); token, component, câu chữ ở [design-system.md](../product/design-system.md).

## 1. Cấu trúc

```
apps/web/src/
  app/              route (page, layout, route handler)
    (public)/       trang ScamShield
    ops/            trang FraudOps (layout kiểm đăng nhập)
    api/            route handlers (xem backend.md)
  components/       component dùng chung (design-system §4), mỗi file một component
  features/         component + hook gắn với một màn hình (analysis, report, case, …)
  copy/vi.ts        chữ hiển thị tiếng Việt
  styles/globals.css  token CSS (design-system §2) + Tailwind
```

## 2. Server và client component

- Mặc định là **server component**. Chỉ thêm `"use client"` cho phần cần tương tác (form, nút sao chép, bộ lọc), và đặt ranh giới client càng thấp càng tốt.
- **Ghi dữ liệu** (tạo analysis, gửi báo cáo, kết luận, gỡ chỉ dấu) **luôn** đi qua route handler `/api/*` bằng `fetch`, không dùng Server Actions. Lý do: một bề mặt API duy nhất, được parse bằng zod, dùng chung cho UI, `curl` và kiểm thử.
- **Đọc dữ liệu** ở trang FraudOps: server component được gọi thẳng hàm đọc của `packages/core`, **sau khi** gọi cùng hàm kiểm phiên mà route handler dùng. Trang ScamShield không đọc DB trực tiếp.
- Không truy cập biến môi trường bí mật trong client component; không có biến `NEXT_PUBLIC_` nào chứa bí mật.

## 3. Styling (Tailwind)

- Màu, cỡ chữ, khoảng cách lấy từ token (design-system §2). **Không** viết mã màu hex hay giá trị tuỳ ý (`text-[#123456]`, `p-[13px]`) trong component.
- Biến thể component (primary/secondary, 4 verdict) gom trong component, không rải chuỗi class lặp lại khắp nơi.
- Thiết kế cho 360px trước (ScamShield), mở rộng bằng breakpoint; FraudOps tối ưu từ 1024px.

## 4. Câu chữ

- Mọi chữ hiển thị nằm ở `copy/vi.ts` hoặc (với thông báo lỗi API) ở enum lỗi trong `packages/shared`. Không viết chuỗi tiếng Việt rải rác trong JSX ngoài nội dung động.
- Câu spec ghi nguyên văn (disclaimer, gửi quá nhanh, chỉ dấu đã xác minh, nhãn verdict, trạng thái case) có test so chuỗi với bảng design-system §3.
- Không có chữ "an toàn" làm verdict hay trạng thái, không hiển thị phần trăm, không gọi một người là kẻ lừa đảo (P1, SO-03-AC03, AC04).
- Disclaimer có ở mọi trang ScamShield, kể cả trang lỗi và trang skeleton.

## 5. An toàn hiển thị

- Nội dung người dùng gửi (tin nhắn, ghi chú) và chỉ dấu luôn render như **văn bản**. Cấm `dangerouslySetInnerHTML` (bật luật ESLint `react/no-danger`).
- URL và tên miền người dùng gửi **không bao giờ** là `<a href>`, ảnh, iframe hay preview (P5); hiển thị bằng font đơn cách, ngắt dòng được.
- Không nhúng script, font hay ảnh từ bên thứ ba lúc chạy; font qua `next/font` (tự host).

## 6. Trạng thái và gọi API

- Mỗi màn hình cài **đủ** các trạng thái trong ui-pages (đang tải, trống, lỗi, xung đột, …). Không có spinner không giới hạn.
- Nút gửi khoá trong lúc chờ để tránh gửi trùng.
- Validate form phía client bằng **cùng zod schema** với server (contracts.md §2); vẫn xử lý lỗi `validation_failed` từ server.
- Lỗi mạng giữ nguyên dữ liệu người dùng đã nhập.

## 7. A11y

Theo design-system §5. Tối thiểu khi review:
- Mọi ô nhập có `label`.
- Lỗi được nối vào ô bằng `aria-describedby` + `aria-invalid`.
- Kết quả phân tích nằm trong vùng `aria-live`.
- Làm được toàn bộ thao tác bằng bàn phím.
- Vòng focus nhìn thấy được.

## 8. Test giao diện

- Logic thuần ở client (định dạng mã, ánh xạ verdict → nhãn, bộ đếm ký tự) test bằng Vitest như backend.
- **End-to-end:** Playwright (C-01), 1–2 kịch bản theo luồng 6 bước ở plan §1, file trong `apps/web/e2e/`, tên test ghi mã AC. Chạy local với Postgres local và chạy tay trên bản deploy; không đưa vào CI nếu cần DB. Kịch bản chỉ dùng tin mẫu có tên miền `*.example`.
- **Không** có test render component (không dùng Testing Library). AC giao diện ngoài kịch bản E2E được kiểm tay có bằng chứng (ảnh chụp ở 360px và 1280px), ghi trong báo cáo `/sdlc:verify`.

## 9. Quyết định

| ID | Câu hỏi | Quyết định | Trạng thái |
|---|---|---|---|
| C-01 | Thêm công cụ test giao diện? | Chỉ **Playwright** cho end-to-end; không Testing Library | Đã chốt 20/11 |
