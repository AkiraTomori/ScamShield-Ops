# Thư viện được phép dùng

Thêm thư viện ngoài danh sách này phải hỏi owner ([plan §5](../runbook/plan.md#5-charter-coding-agent-được-tự-quyết-tới-đâu)). Phiên bản chính xác ghim trong `package.json` lúc cài, không ghi ở đây.

| Thư viện | Dùng để | Duyệt |
|---|---|---|
| `next`, `react`, `react-dom` | Web và API (route handlers) | Stack chốt 20/11/2026 |
| `typescript` | Ngôn ngữ, chế độ strict | Stack chốt 20/11/2026 |
| `zod` | Schema request/response, đầu ra LLM, biến môi trường | AGENTS.md |
| `drizzle-orm`, `drizzle-kit` | Truy vấn có kiểu, sinh và chạy migration SQL | D-02, 20/11/2026 |
| `postgres` (postgres.js) | Driver PostgreSQL | D-02, 20/11/2026 |
| `vitest` | Unit và integration test | D-02, 20/11/2026 |
| `eslint` + cấu hình ESLint của Next.js, `prettier` | Lint, format | D-02, 20/11/2026 |
| `tailwindcss` (+ plugin PostCSS/tích hợp Next.js theo tài liệu chính thức của phiên bản ghim) | Styling | O-05, 20/11/2026 ([ui-pages §8](../product/ui-pages.md#8-quyết-định-mở-cho-giao-diện)) |
| `@playwright/test` | Test end-to-end luồng demo | C-01, 20/11/2026 ([frontend §9](./frontend.md#9-quyết-định)) |

Nguồn: [system-design §9](../architecture/system-design.md#9-quyết-định-cần-owner-chốt).
