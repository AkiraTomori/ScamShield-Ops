# ScamShield Ops — Public Dataset Catalog & Source Review

**Trạng thái:** Danh mục nguồn đề xuất (24/11/2026), **chưa tải, làm sạch hoặc tích hợp vào engine**. Các số mẫu/giấy phép lấy từ trang công bố vào thời điểm nghiên cứu; **phải xác nhận lại phiên bản, license, phương thức thu thập, quyền phân phối lại, dữ liệu PII trước khi ingest**. Data public không đồng nghĩa luôn an toàn/được sử dụng không điều kiện.

## 1. Nhu cầu dữ liệu

**Ba nhiệm vụ khác nhau** không được gộp nhãn:
1. **Message-level risk:** văn bản tin nhắn tiếng Việt; semantic signals và câu hỏi đánh giá `high_risk / suspicious / no_signal / inconclusive`.
2. **URL / indicator-level:** URL/domain, nhãn phishing hoặc legitimate và metadata; chỉ đánh giá các phép kiểm URL, **không tự nâng nhãn URL thành verdict tin nhắn**.
3. **FraudOps case/workflow:** report, case, analyst decision, timestamps, evidence; **dùng synthetic cases** với kịch bản công khai ghi là giả lập, không mượn danh data MoMo.

## 2. Dataset candidates và quyết định nghiên cứu

| ID | Dataset / nguồn | Thông tin từ nhà phát hành | Cách dùng đề xuất | Giới hạn / action |
|---|---|---|---|---|
| D1 | [Vietnamese Quality-Assured SMS Scam Dataset](https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_dataset) | `full_dataset.csv`: **2.991** tin, `message_id,date,message,label`, CC BY 4.0 theo dataset card | **Ưu tiên nghiên cứu đầu tiên** cho language/generalization, mẫu hợp lệ dễ nhầm | Kiểm tập nhãn, class balance, tình trạng khử PII và trùng mẫu; không dùng SMS spam=fraud tự động |
| D2 | [Vietnamese SMS Phishing Sample](https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_phishing_sample) | Sample public **300** tin, CC BY 4.0, tài liệu nói có multi-annotator + near-duplicate dedup | Independent **challenge set** sau khi chốt engine | Có thể trùng/được rút từ D1; **coi hai nguồn có nguy cơ overlap**, kiểm fingerprint theo template trước mọi split |
| D3 | [PhishVN](https://github.com/vuthainguyen1602/phishvn) / [Datasheet](https://github.com/vuthainguyen1602/phishvn/blob/master/docs/datasheet.md) | **53.116 URL** (18.997 core gồm 2.587 phishing + 16.410 legitimate; 34.119 community/feed bronze); lexical features, tiers, dates; data CC BY 4.0 theo datasheet | **Ưu tiên** kiểm indicator extractor, normalized domain và lexical checks | Tiers khác độ tin cậy; nhãn cộng đồng trộn gambling/investment/other scam với credential phishing; dùng **gold/silver trước**, ghi tier/source và version |
| D4 | [UCI SMS Spam Collection](https://archive.ics.uci.edu/dataset/228/sms+spam+collection) | **5.574** tin nhắn tiếng Anh ham/spam; CC BY 4.0 | Baseline phụ tiếng Anh hoặc regression không ảnh hưởng KPI tiếng Việt | Ham/spam ≠ safe/scam; không dùng làm benchmark chính |
| D5 | [PhishTank developer feed](https://data.dev.phishtank.com/developer_info.php) | Verified/online phishing feeds có key/quota và thay đổi theo thời gian | Tham khảo enrichment hoặc external challenge theo snapshot | Kiểm [Terms](https://phishtank.org/terms.php); không tự fetch URL bên trong feed |
| D6 | [Tranco top sites](https://tranco-list.eu/) | Ranking nghiên cứu của các domain phổ biến, có snapshot theo list ID | Tạo candidate negative domains sau khi kiểm chứng | Popular ≠ benign; contamination và brand impersonation cần kiểm |
| D7 | [OpenPhish](https://openphish.com/) | Danh sách phishing URL cập nhật | Optional challenge feed | Kiểm điều kiện/license/quota theo gói; không đưa vào core P0 mặc định |

**Không nên sử dụng trực tiếp** public threat feeds làm authoritative blacklist hay “dữ liệu đã xác minh” của hệ thống khi không có provenance, timestamp và quy tắc validation. Bản ghi đã hết hiệu lực, bị gắn nhãn sai hoặc trùng với train/dev làm sai evaluation.

## 3. Quy tắc license, provenance và quản lý dữ liệu

Với **mỗi snapshot** được đội lựa chọn, cần manifest với các trường:

```yaml
dataset_id: D1
name: Vietnamese Quality-Assured SMS Scam Dataset
source_url: https://huggingface.co/datasets/trannguyenthaituan/vietnamese_sms_dataset
version_or_commit: TO_VERIFY
retrieved_at_utc: TO_FILL
license_claim: CC-BY-4.0
license_verified_by: TO_FILL
row_count_declared: 2991
row_count_loaded: TO_FILL
sha256: TO_FILL
label_mapping_version: TO_FILL
pii_review_status: pending
intended_use: external_message_challenge
split_policy: grouped_holdout_no_overlap
redistribution_allowed: pending_review
notes: do_not_commit_raw_without_approval
```

- Giữ URL gốc, ngày truy cập, version/commit/hash, tác giả, license và attribution khi công bố kết quả.
- **Không commit dữ liệu raw** nếu chứa PII, secret, URL lừa đảo còn hoạt động hoặc quyền phân phối lại chưa rõ; chỉ commit manifest, thống kê tổng hợp và mẫu đã redacted/sanitized.
- Dùng **offline string parsing** trên URL; không mở trang, không render, không `curl` từng URL trong bộ dữ liệu; không chạy crawler.
- Tin nhắn cần che OTP, số thẻ, mật khẩu; số điện thoại/tài khoản cũng có thể là dữ liệu cá nhân, phải xét riêng cho mục đích giữ làm indicator.
- Không tin nhãn dataset tuyệt đối; tách **reported label**, **source confidence**, **manual review** và **ground truth chấp nhận cho eval**.
- Khi có phiên bản mới, lưu snapshot bất biến; không thay dữ liệu rồi vẫn báo cùng một kết quả.

## 4. Policy tránh leakage và sai lệch

**Những điều phải chặn trước khi đo:**
- Duplicate/near-duplicate template của cùng chiến dịch trong cả dev và held-out (thay số điện thoại/URL nhưng giữ câu chữ).
- Overlap **D1 ↔ D2**; dùng cùng sample cho prompt tuning và “external evaluation”.
- URL của cùng registrable domain/campaign xuất hiện ở cả hai tập; PhishVN đã có grouped temporal split — không phá split gốc tùy tiện.
- Dữ liệu tạo nhân tạo đồng dạng quá nhiều làm precision/recall không đại diện ngoài đời.
- “Safe” được suy ra từ URL chưa bị blacklist, tin OTP hợp lệ bị gán phishing chỉ vì có từ OTP.
- Đánh đồng score Q-08 (signal extraction) với precision/recall của end-to-end scam detection.

**Đề xuất:** giữ `eval/cases/dev.jsonl` và `heldout.jsonl` hiện tại làm bộ đánh giá theo SO-09; các public dataset ở `external challenge` riêng, báo riêng theo nguồn/tier/label, không đổi số held-out đã đóng băng.

## 5. Quy trình đưa một nguồn vào sử dụng *(chưa phải task đã làm)*

1. Owner và một người review độc lập xác minh URL, phiên bản, license và khả năng tái phân phối.
2. Inspect schema, thống kê nhãn, sample PII, duplicates; **không mở URL độc hại**.
3. Viết mapping từ nhãn gốc → taxonomy nội bộ; chỗ nào không đủ evidence để suy verdict thì để `unknown`/không dùng cho scoring.
4. Gắn `source_id, source_row_id, hash, tier, split, annotation_status`; nhóm theo template/domain trước split.
5. Sanitize, kiểm dữ liệu nhạy cảm, xuất file aggregate và một số mẫu synthetic cho demo.
6. Chạy evaluation protocol ở [evaluation-protocol.md](evaluation-protocol.md), báo cả failures, exclusions, sample size và confidence limitations.

**Ưu tiên theo thời gian:** D1 + D3 để nghiên cứu; D2 giữ làm challenge, các nguồn còn lại để sau S3. **Không trì hoãn vertical slice** để tải hoặc gán nhãn hàng nghìn mẫu.
