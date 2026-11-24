# ScamShield Ops — Public Dataset Catalog

**Trạng thái (24/11/2026):** vai trò của từng dataset **owner đã chốt** ([spec Q-11](../spec/ScamShield-v1.md#7-quyết-định-mở-owner-chốt)). D1, D2 đã tải về máy tạm để kiểm số liệu (§3); **chưa dataset nào được đưa vào repo hay engine**. D3 chỉ kiểm qua tài liệu, chưa tải. Owner vẫn phải xác nhận license và quyền phân phối lại trước khi dùng (§5).

## 1. Tóm tắt trong 30 giây

- Số đo SO-09 (đưa lên README, slide) **chỉ** lấy từ câu **tự soạn** trong `eval/cases/*.jsonl`.
- Public data không cho ra số SO-09. Nó chỉ giúp **soạn câu** (D1) và **kiểm bộ tách URL** (D3).
- Mọi nguồn khác (D2, D4–D7) **không dùng cho v1**.
- Danh sách đen và tên miền chính thức dùng lúc chạy **không** thuộc catalog này: chúng đã chốt ở Q-03 (RDAP, Google Safe Browsing/Web Risk) và Q-10 (spec Phụ lục A).

## 2. Quyết định (owner chốt 24/11/2026, spec Q-11)

| Vai trò | Nguồn | Đo được | Không đo được / ràng buộc |
|---|---|---|---|
| **Nguồn số chính thức của SO-09** (dev + held-out) | **Tự soạn**, `eval/cases/*.jsonl`, 60–100 câu (SO-09-AC01) | Mọi chỉ số SO-09-AC03: precision, recall, FPR, đúng schema, độ trễ, `inconclusive`, chống injection, bám bằng chứng | Bộ nhỏ, tự soạn; slide phải nói giới hạn (SO-09-AC04) |
| Tham khảo khi soạn câu | D1 | Không báo số | Chỉ **viết lại theo mẫu**, không chép nguyên văn; thay mọi mã OTP, số dài, tên miền bằng giá trị bịa và `*.example`/`*.test`. Vì đã dùng để soạn câu, **D1 không còn là tập kiểm độc lập** |
| Kiểm bộ tách URL và phép kiểm từ vựng URL (offline) | D3 PhishVN, chỉ tầng gold/silver | Độ đúng của bộ tách chỉ dấu và chuẩn hoá tên miền trên URL thật | **Không mở, render hay tải URL** (P5); báo số riêng, không gộp vào SO-09; không commit dữ liệu thô; fixture trong test vẫn dùng `*.example`/`*.test` |
| Không dùng cho v1 (roadmap) | D2, D4, D5, D6, D7 | — | Lý do ở bảng §3 |

### Luật cho agent khi đụng tới dữ liệu public

1. Không thêm file dataset thô (CSV, JSON) vào repo. Chỉ được commit manifest (§4) và số thống kê tổng hợp.
2. Không chép câu từ D1/D2 vào `eval/cases/`, test hay seed. Viết câu mới, dùng số bịa và tên miền dành riêng.
3. Không mở, `curl`, render hay crawl bất kỳ URL nào lấy từ dataset. Chỉ xử lý URL như chuỗi.
4. Không báo số đo trên public data như số của SO-09, và không gọi nó là "held-out".
5. Muốn thêm nguồn mới hoặc đổi vai trò một nguồn: dừng và hỏi owner (`/sdlc:sign-off`).

## 3. Các nguồn và số liệu đã kiểm

Số liệu có ghi "đo 24/11" là do agent tải file về thư mục tạm (không vào repo) rồi tự đếm; phần còn lại lấy từ tài liệu của nhà phát hành.

| ID | Nguồn | Số liệu đã kiểm | Vai trò (Q-11) |
|---|---|---|---|
| D1 | [Vietnamese Quality-Assured SMS Scam Dataset](https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_dataset) (Hugging Face) | Xem §3.1 | Chỉ tham khảo khi soạn câu |
| D2 | [Vietnamese SMS Phishing Sample](https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_phishing_sample) (Hugging Face) | Đo 24/11: 300 dòng, chỉ 2 cột `message_id, text`, **không có nhãn**. Cả 300 `message_id` đều có trong D1; 214/300 câu trùng nguyên văn với D1 | Không dùng: không có nhãn và là tập con của D1 |
| D3 | [PhishVN](https://github.com/vuthainguyen1602/phishvn), [datasheet](https://github.com/vuthainguyen1602/phishvn/blob/master/docs/datasheet.md) | Xem §3.2 | Kiểm bộ tách URL offline |
| D4 | [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) | 5.574 tin tiếng Anh ham/spam, CC BY 4.0 (theo trang công bố, chưa kiểm lại) | Không dùng: tiếng Anh, ham/spam không phải lừa đảo |
| D5 | [PhishTank developer feed](https://data.dev.phishtank.com/developer_info.php) | Feed thay đổi liên tục, cần key; [terms](https://phishtank.org/terms.php) chưa kiểm | Không dùng: dùng làm enrichment là thêm tra cứu ngoài, trái Q-03 |
| D6 | [Tranco top sites](https://tranco-list.eu/) | Xếp hạng tên miền phổ biến (chưa kiểm) | Không dùng: trùng vai với danh sách Q-10; phổ biến không có nghĩa là lành |
| D7 | [OpenPhish](https://openphish.com/) | License theo gói, có thể giới hạn thương mại (chưa kiểm) | Không dùng |

### 3.1. D1: số đo ngày 24/11/2026

- **Phiên bản:** revision Hugging Face `a90e2bd7e8df2376939658075ba8094dcee488ad` (sửa lần cuối 07/08/2026). License trên thẻ dataset: CC BY 4.0.
- **Kích thước:** `full_dataset.csv` 2.991 dòng (khớp thẻ dataset), `train.csv` 2.394, `test.csv` 597. SHA-256 của `full_dataset.csv`: `8a29d50a6335c8938b8beef0a3daf57d276e880244394da453bc656f5a4c7847`.
- **Nhãn:** chỉ nhị phân, `0` = hợp lệ (2.193 dòng, 73%), `1` = spam **hoặc** lừa đảo (798 dòng, 27%). Không có nhóm, signal hay ca prompt injection, nên không đo được phần lớn chỉ số SO-09.
- **Trùng lặp:** 393 dòng trùng nguyên văn với một dòng khác (sau khi chuẩn hoá chữ thường và khoảng trắng). Trùng gần (cùng mẫu, đổi số) chưa đếm.
- **Dữ liệu cá nhân:**
  - Thẻ dataset nói mọi PII đã thay bằng token như `[PHONE]`, `[BANK_ACC]` và "không còn PII". Thực tế file **không có** token `[PHONE]` hay `[BANK_ACC]` nào. Token có thật: `[MONEY]`, `[NUMBER]`, `[TIME]`, `[DATE]`, `[NAME]` và vài token tên thương hiệu.
  - **173 dòng còn mã OTP dạng số** (gần như toàn bộ ở nhãn `0`) và **94 dòng còn dãy từ 9 chữ số trở lên** (mã giao dịch hoặc số tài khoản có thể có). 6 dòng có địa chỉ email.
  - Không thấy số điện thoại Việt Nam dạng `0…`/`84…` chưa che.
  - 1.336 dòng có URL thật (325 dòng ở nhãn `1`), một số là URL giả mạo ngân hàng.
  - Kết luận: **không chép bất kỳ câu nào của D1 vào repo**, kể cả câu nhãn `0`.

### 3.2. D3 PhishVN: theo tài liệu của nhà phát hành (kiểm 24/11/2026)

- **Phiên bản:** v3.1.1, DOI Mendeley [`10.17632/b97hxbxtpd.5`](https://doi.org/10.17632/b97hxbxtpd.5). Dữ liệu **không nằm trong repo GitHub**, phải tải tầng mở từ Mendeley. Repo GitHub kiểm ở commit `e1f87f7a6ba3a2945eed5e3b0916a2a5a8c21ddf`.
- **License:** dữ liệu CC BY 4.0, mã MIT. Ghi nguồn: NCSC "Tín Nhiệm Mạng" và danh sách Tranco. Ảnh chụp và HTML trang lừa đảo nằm ở tầng riêng, chỉ cấp theo yêu cầu: **không xin, không dùng**.
- **Kích thước:** 53.116 URL. Lõi đã kiểm chứng (gold + silver) 18.997 = 2.587 phishing (NCSC) + 16.410 hợp lệ; gold 9.593, silver 9.404. Tầng bronze 34.119 (ChongLuaDao, OpenPhish; nhãn cộng đồng, không có ngày).
- **Nhiễu nhãn** (bản kiểm của chính PhishVN): nhánh phishing 12/99 dòng thực ra hợp lệ (**12,1%**, CI 95% 7,1–20,0%; 11/12 dòng là bronze); nhánh hợp lệ 2/50 dòng thực ra độc hại (**4,0%**, cả hai là silver lấy từ Tranco). Chỉ 42,5% dòng phishing là lừa lấy thông tin đăng nhập; còn lại là cờ bạc, đầu tư và các loại lừa đảo khác.
- **Hệ quả cho ScamShield:** chỉ dùng gold/silver; vẫn coi nhãn là "nhãn nguồn", không phải sự thật tuyệt đối; khi báo số ghi rõ tầng và version.

## 4. Manifest bắt buộc trước khi dùng một nguồn

Mỗi lần dùng một bản dữ liệu, lưu một manifest như dưới (ví dụ đã điền cho D1). Manifest được commit; dữ liệu thô thì không.

```yaml
dataset_id: D1
name: Vietnamese Quality-Assured SMS Scam Dataset
source_url: https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_dataset
version_or_commit: a90e2bd7e8df2376939658075ba8094dcee488ad
retrieved_at_utc: 2026-11-24
license_claim: CC-BY-4.0
license_verified_by: TO_FILL        # owner
row_count_declared: 2991
row_count_loaded: 2991
sha256: 8a29d50a6335c8938b8beef0a3daf57d276e880244394da453bc656f5a4c7847  # full_dataset.csv
label_mapping_version: none          # không ánh xạ sang verdict; chỉ tham khảo
pii_review_status: failed            # còn OTP, dãy số dài, email (§3.1)
intended_use: authoring_reference_only   # Q-11
redistribution_allowed: not_needed   # không commit dữ liệu thô
notes: do_not_copy_text_into_repo
```

Với D3, `intended_use: offline_url_extractor_check`, `version_or_commit: 10.17632/b97hxbxtpd.5`; các trường số dòng và hash điền khi tải.

## 5. Quy tắc chung

**License và nguồn gốc**
- Giữ URL gốc, ngày tải, version hoặc hash, tác giả, license và ghi nguồn khi công bố kết quả.
- Owner (hoặc một người review) xác nhận license và quyền phân phối lại trước khi dùng.

**Dữ liệu cá nhân và an toàn**
- Không commit dữ liệu thô chứa PII, secret, URL lừa đảo còn hoạt động, hoặc chưa rõ quyền phân phối lại.
- Chỉ xử lý URL như chuỗi; không mở, render, `curl` hay crawl.
- Che OTP, số thẻ, mật khẩu (Q-04). Số điện thoại và số tài khoản cũng có thể là dữ liệu cá nhân.

**Nhãn**
- Không tin nhãn dataset tuyệt đối. Tách nhãn nguồn, độ tin cậy của nguồn, kết quả xem tay, và nhãn chấp nhận cho eval.
- Có phiên bản mới thì lưu manifest mới; không thay dữ liệu mà vẫn báo cùng một kết quả.

## 6. Chống leakage và hiểu sai số đo

Phải chặn trước khi đo:
- Câu trùng hoặc trùng gần (cùng mẫu, đổi số hay URL) nằm ở cả dev và held-out. D1 đã có 393 dòng trùng nguyên văn.
- URL cùng tên miền hoặc cùng chiến dịch nằm ở cả hai tập. PhishVN đã có cách chia theo nhóm và thời gian; không tự phá cách chia đó.
- Dữ liệu tự soạn quá giống nhau làm precision/recall đẹp hơn thực tế.
- Suy ra "lành" chỉ vì URL chưa nằm trong danh sách đen; gán lừa đảo chỉ vì tin có chữ OTP.
- Đánh đồng điểm Q-08 (trích signal) với precision/recall của toàn pipeline.

Bộ eval SO-09: `eval/cases/dev.jsonl` (hiện có 20 câu dev nháp) và `heldout.jsonl` (chưa có; tạo khi đủ 60–100 câu, xem [research Phần C](./result.md)). Cách đo ở [evaluation-protocol.md](evaluation-protocol.md).

## 7. Thứ tự làm việc

1. Soạn đủ 60–100 câu tự soạn (T-100) trước ngày đóng băng 30/11. Khi cần mẫu thì mở D1 để xem, rồi viết lại.
2. Khi S3 có bộ tách chỉ dấu: tải tầng mở D3 từ Mendeley về máy (không vào repo), chạy bộ tách trên URL gold/silver, báo riêng.
3. D2, D4–D7: không làm trong v1.

**Không trì hoãn vertical slice** để tải hoặc gán nhãn hàng nghìn mẫu.
