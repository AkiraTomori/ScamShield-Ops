# Tình huống eval

- `dev.jsonl`: 20 câu đầu tập dev (research A.3, B.2): 8 `clear_scam`, 5 `legit_lookalike`, 4 `ambiguous`, 3 `prompt_injection`.
- **Trạng thái nhãn (21/11/2026):** agent soạn nội dung và nhãn đề xuất (S2-03); owner phản hồi "Duyệt" 21/11 khi đọc danh sách bước, **không sửa nhãn nào**. Nếu owner muốn rà từng câu thì sửa tại đây. Sửa nhãn xong thì sửa thẳng file này; kết quả chạy ghi `casesSha256` để biết đã chạy trên phiên bản nhãn nào.
- Mọi câu là dữ liệu tự soạn: tên miền chỉ `*.example`/`*.test`, OTP/số tài khoản/số điện thoại là số bịa, "Ví XYZ" và "ABC Bank" là tên giả. Không có thông tin người thật.
- Không sửa nhãn tập held-out để "đẹp số" (SO-09-AC02).
