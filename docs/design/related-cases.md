# Thiết kế slice S7: hồ sơ liên quan theo chỉ dấu chung (T-070)

**Trạng thái (28/11/2026):** **OWNER ĐÃ DUYỆT SLICE S7 ngày 26/11/2026** (`/sdlc:sign-off`), nhận mọi phương án đề xuất ở mục quyết định. Agent được viết mã cho slice này. **T-070 xong ở local 28/11** (nhánh `feat/s7-related-cases`, PR nháp #52, chưa merge, chưa deploy; ghi chú ở [§8](#8-ghi-chú-cài-đặt-28112026), **chờ owner xác nhận**). SO-07 là **P1, thứ 2 trong thứ tự cắt** ở plan §7. T-070 được làm theo yêu cầu ngày 28/11; quyết định cắt hay giữ P1 vẫn của owner. T-070 phụ thuộc T-062 (chi tiết hồ sơ, S6). Lịch cũ đặt việc này ở 29/11.

**Căn cứ và thứ bậc.** File này là thiết kế slice (cấp 5). Nó chỉ bổ sung phần các file dưới còn để ngỏ:
- [spec SO-07](../spec/ScamShield-v1.md): AC01, AC02.
- [data-model §2.2](../architecture/data-model.md#22-analysis_indicators) (đã duyệt): bảng `analysis_indicators` và index `(type, normalized)` đã có trong migration `0000_p0_tables`. **S7 không cần migration.**
- [contracts §6](../architecture/contracts.md): `CaseDetail.relatedCases`.
- [analysis-pipeline §6.1–6.3](./analysis-pipeline.md) (đã duyệt): cách chuẩn hoá tên miền, SĐT và số tài khoản.
- [fraudops.md](./fraudops.md) (S6, owner duyệt 26/11): `getCaseDetail`, `listCases`, `StaffSession`.
- [demo.md](../runbook/demo.md): cảnh 1:45–2:15 và dữ liệu S1.

## 1. Kết quả cần có

Nhân viên mở hồ sơ của tin M3 và thấy "3 hồ sơ khác có cùng chỉ dấu". Đó là ba case seed S1 cùng dùng `vi-xac-minh.example`. Mỗi dòng ghi mã hồ sơ, chỉ dấu chung và trạng thái; bấm vào thì mở hồ sơ đó. Danh sách hồ sơ có thêm cột "Liên quan". Phần này hoàn toàn tất định, không có AI.

**Ngoài slice:**
- Đồ thị chiến dịch, gộp nhiều hồ sơ thành một (roadmap, plan §2).
- Đưa chỉ dấu đã xác minh quay lại engine (SO-08, T-080).

## 2. Thế nào là "liên quan"

Hai **case** liên quan khi analysis của chúng có chung ít nhất một cặp `(type, normalized)` trong `analysis_indicators`, ở các loại `domain`, `phone` hoặc `bank_account`.

- **Chỉ so case với case.** Analysis không được báo cáo thì không tính: nó không phải hồ sơ, và nhân viên cũng không mở được.
- **`domain` là tên miền đăng ký** (pipeline §6.1). Vì vậy `a.vi-xac-minh.example` và `vi-xac-minh.example` khớp với nhau. Chuẩn hoá thuộc T-032 (S3); S7 chỉ so chuỗi đã chuẩn hoá. Không chuẩn hoá lại ở lúc truy vấn.
- **Seed và case thật được so với nhau.** Demo cần đúng điều này: hồ sơ thật của M3 khớp ba hồ sơ seed S1. Case seed vẫn hiện badge "Dữ liệu mẫu".
- **Case đã đóng vẫn hiện,** kèm trạng thái và kết luận. Một case đã xác nhận lừa đảo là bằng chứng có ích cho case đang mở.
- **Không tự liên quan với chính mình.** Loại case hiện tại bằng `id`.

### 2.1 Chỉ dấu quá phổ biến (ST-01)

Đọc đúng từng chữ, SO-07-AC01 nối mọi case có chung **bất kỳ** chỉ dấu nào. Hai loại chỉ dấu làm việc này sai:
- **Tên miền chính thức** trong `brands.json`, ví dụ tin OTP thật M2 có tên miền chính thức. Kẻ gian cũng hay chèn tên miền thật vào tin để trông đáng tin. Nối theo tên miền đó sẽ ghép tin lừa đảo với **mọi** tin thật của cùng thương hiệu.
- **Dịch vụ rút gọn URL** (`url-lists.json`, P-04). Mọi tin dùng cùng một dịch vụ rút gọn sẽ bị nối với nhau, dù không liên quan.

Đề xuất: **không so khớp** hai loại tên miền này. Danh sách đọc từ hai file dữ liệu đã có, không thêm danh sách thứ ba. Đây là thay đổi hành vi so với chữ của spec; owner chốt ST-01 ngày 26/11 và câu SO-07-AC01 đã được sửa.

Số tổng đài `1800`/`1900` giữ nguyên trong so khớp. Hai báo cáo cùng một số tổng đài lạ là tín hiệu có ích.

## 3. Truy vấn

Một hàm trong `packages/core/src/cases`, gọi từ `getCaseDetail` của S6:

```ts
findRelatedCases(session: StaffSession, caseId: string, deps): Promise<RelatedCasesResult>
// RelatedCasesResult = { total: number; items: RelatedCase[] }       // items tối đa 20
// RelatedCase = { caseCode, status, decision: Decision | null, isSeed, createdAt,
//                 sharedIndicators: { type: MatchableIndicatorType; normalized: string }[] }
```

- **Một câu SQL:** lấy chỉ dấu của case hiện tại → join `analysis_indicators` theo `(type, normalized)` (dùng index đã có) → join `cases` theo `analysis_id` → bỏ case hiện tại và các tên miền loại trừ (§2.1) → gom theo case, gộp chỉ dấu chung thành mảng.
- **Sắp xếp:** nhiều chỉ dấu chung nhất trước, rồi mới nhất trước.
- **Giới hạn 20 dòng.** `total` là số đầy đủ. Một chỉ dấu phổ biến có thể khớp hàng trăm case; trang chỉ cần đủ để nhân viên thấy đây là một chiến dịch.
- **Hợp đồng:** `CaseDetail.relatedCases` trong contracts §6 hiện là mảng `{ caseCode, status, sharedIndicators: string[] }`. Đổi thành `RelatedCasesResult` ở trên (ST-02, owner chốt 26/11); contracts §6 đã sửa.
- **Danh sách hồ sơ:** `listCases` (S6 §4) thêm `relatedCount` cho mỗi dòng. Dùng một truy vấn con cho 25 dòng của trang, cùng điều kiện loại trừ. Không đếm cho toàn bảng.
- **Không có vấn đề đồng thời:** chỉ dấu không đổi sau khi tạo (data-model §3). Kết quả chỉ đổi khi có case mới, hoặc khi `demo:reset` xoá case seed. Đọc mỗi lần mở trang, không cache.

## 4. Giao diện

### 4.1 Khối "Hồ sơ liên quan" trên chi tiết hồ sơ

Đặt theo pages.md §6.1: khối riêng ở cột phải, dưới khối AI.

- Gắn badge *Kiểm tra*. Đây là so khớp tất định, **không** thuộc Nhận định của AI (SO-05-AC03).
- Tiêu đề: "{total} hồ sơ khác có cùng chỉ dấu". Khi `total > 20`, thêm "Đang hiện 20 hồ sơ có nhiều chỉ dấu chung nhất."
- Mỗi dòng có:
  - mã hồ sơ, là link nội bộ tới `/ops/ho-so/SC-xxxx`
  - chỉ dấu chung, có nhãn loại ("Tên miền", "Số điện thoại", "Số tài khoản"), font đơn cách, là văn bản thuần, không `href` (P5)
  - trạng thái, hoặc kết luận nếu đã đóng
  - badge "Dữ liệu mẫu" nếu là case seed
- **`total = 0`:** ẩn cả khối (ui-pages §6.1).
- **Lỗi truy vấn:** cả trang rơi vào `error.tsx`, giống các phần đọc khác của S6. Không có trạng thái lỗi riêng cho khối này.

### 4.2 Cột "Liên quan" trong danh sách

Hiện `relatedCount`, hoặc "—" khi bằng 0 (pages.md §5). Không thêm bộ lọc theo cột này.

### 4.3 Khi bị cắt

`getCaseDetail` trả `relatedCases = { total: 0, items: [] }` và cột "Liên quan" bị ẩn. Trang S6 đã chạy được với trạng thái này, nên cắt S7 không cần sửa S6.

## 5. Phụ thuộc

| Cần | Ai | Ghi chú |
|---|---|---|
| T-062 chi tiết hồ sơ (S6) | B, C | Chặn T-070 |
| T-032 chuẩn hoá chỉ dấu (S3) | A | Bảo đảm SO-07-AC02 |
| T-038 ghi `analysis_indicators` khi lưu analysis | C | Đã có trong data-model §4 |
| **Seed S1: analysis seed cũng phải có dòng `analysis_indicators`** | C (T-090) | Analysis seed không chạy pipeline (data-model §7). Lệnh seed phải tự chèn chỉ dấu, nếu không thì cảnh demo trống |
| `brands.json`, `url-lists.json` | A (T-033, T-034) | Danh sách loại trừ ở §2.1 |

## 6. Kiểm thử

| Tầng | Kiểm gì |
|---|---|
| Int `findRelatedCases` (Postgres local) | Hai case chung một tên miền → mỗi case thấy case kia, không thấy chính mình; chung hai chỉ dấu → xếp trước case chung một chỉ dấu; analysis không có case → không hiện; tên miền chính thức hoặc dịch vụ rút gọn → không nối (nếu ST-01 chốt); 25 case khớp → `total = 25`, `items` có 20 dòng; case đã đóng hiện kèm kết luận |
| Int SO-07-AC02 (qua pipeline) | `WWW.Vi-Xac-Minh.example/a` và `vi-xac-minh.example` → cùng một chỉ dấu; `0901 234 567` và `+84901234567` → cùng một chỉ dấu; `STK 0123 456 789` và `0123456789` → cùng một chỉ dấu. Hàm chuẩn hoá đã có test unit ở T-032; test này kiểm chuỗi từ trích tới so khớp |
| Int `listCases` | `relatedCount` đúng cho từng dòng của trang |
| Kiểm tay | Sau `demo:seed` và gửi tin M3: hồ sơ M3 hiện "3 hồ sơ khác có cùng chỉ dấu"; ảnh chụp 1280px |

**Ánh xạ AC:**
- SO-07-AC01: int `findRelatedCases`, kiểm tay cảnh demo.
- SO-07-AC02: int qua pipeline (trên) cùng unit của T-032.

## 7. Quyết định (owner chốt 26/11/2026)

Tiền tố `ST-` (liên kết hồ sơ, slice S7), chưa dùng ở tài liệu nào khác.

| ID | Câu hỏi | Phương án và đánh đổi | Đề xuất |
|---|---|---|---|
| ST-01 | Có loại tên miền chính thức và dịch vụ rút gọn khỏi so khớp không (§2.1) | (a) Loại cả hai. Không nối tin lừa đảo với tin thật; lệch chữ SO-07-AC01, phải sửa spec. (b) Không loại, đúng chữ spec. Hồ sơ có tên miền thật sẽ "liên quan" tới mọi tin thật của thương hiệu đó, làm nhân viên hiểu sai | (a) · **Owner chốt 26/11** |
| ST-02 | Hình dạng `relatedCases` | (a) `{ total, items }`, mỗi chỉ dấu chung có `type`. Sửa contracts §6. (b) Giữ mảng như contracts hiện tại: không biết tổng số khi bị giới hạn 20, không biết chỉ dấu thuộc loại nào | (a) · **Owner chốt 26/11** |

## 8. Ghi chú cài đặt (28/11/2026)

**Mã:** `packages/core/src/cases/related.ts` (`findRelatedCases`, `countRelatedCases`, `UNMATCHED_DOMAINS`), `apps/web/src/features/cases/RelatedCasesPanel.tsx`, cột ở `CaseList.tsx`.

**Khác hoặc thêm so với bản duyệt, chờ owner xác nhận:**
- Kiểu trả về giữ tên `RelatedCases` (đã có từ T-062), không phải `RelatedCasesResult` ở §3.
- `relatedCount` của danh sách lấy bằng **một truy vấn gom nhóm thứ hai** cho đúng 25 hồ sơ của trang, thay cho truy vấn con trong câu SELECT. Phạm vi và điều kiện loại trừ như §3.
- Dòng "đang hiện 20" ghi theo số dòng thật đang hiện: "Đang hiện {n} hồ sơ có nhiều chỉ dấu chung nhất."
- `related.ts` import thẳng `BRANDS` và `URL_LISTS` (dữ liệu tĩnh), không nhận qua `deps` như pipeline.
- Dòng đã đóng chỉ hiện kết luận, không hiện thêm chữ "Đã đóng" (theo §4.1; hình vẽ ở pages §6.1 ghi "Đã đóng").

**Đã kiểm 28/11 ở local:**
- `npm run verify` với `DATABASE_URL` trỏ Postgres tạm trong Docker: 71 file test qua, gồm test tích hợp ở `packages/core/test/cases/related.int.test.ts` (SO-07-AC01, AC02 qua pipeline với LLM giả).
- `next build`; Edge headless trên DB tạm: hồ sơ chung tên miền hiện "3 hồ sơ khác có cùng chỉ dấu", hai hồ sơ chỉ chung tên miền chính thức không nối, bấm link mở hồ sơ kia, không lỗi JS, 1280px và 360px không cuộn ngang.

**Chưa kiểm:**
- Cảnh demo ở §6 "Kiểm tay" với tin M3 gửi thật và dữ liệu `demo:seed`: seed hồ sơ mẫu (T-090) chưa có. T-090 phải chèn cả `analysis_indicators` (§5).
- Bản deploy; thời gian truy vấn khi có nhiều hồ sơ.
