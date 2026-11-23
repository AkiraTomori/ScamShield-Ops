# Chấm tiếng Việt: openai/gpt-oss-20b

Thang: 1 = sai/khó hiểu, 2 = đúng nhưng vụng, 3 = tự nhiên. Ghi thêm nếu giải thích nêu sự kiện ngoài signal (SO-03-AC05).

## dev-001 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, brand_domain_mismatch, urgency, threat, credential_request`
- Giải thích: Tin nhắn xưng là của một tổ chức nhưng tên miền không khớp với tên miền chính thức của tổ chức đó. Tin tạo áp lực phải xử lý gấp, đe dọa hậu quả nếu không làm theo và đòi cung cấp mã OTP hoặc thông tin đăng nhập. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-002 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, lookalike_domain, urgency, credential_request`
- Giải thích: Tin nhắn xưng là của một tổ chức. Địa chỉ trong tin giống tên miền chính thức nhưng khác một vài ký tự. Tin tạo áp lực phải làm ngay và đòi cung cấp mã OTP hoặc thông tin đăng nhập. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-003 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa hẹn thưởng nếu bạn chuyển tiền. Tin nhắn yêu cầu bạn chuyển tiền. Bạn nên kiểm tra lại qua kênh chính thức trước khi thực hiện.
- Điểm: 2
## dev-004 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải xử lý gấp và đòi bạn chuyển tiền. Đây là dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-005 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, threat, urgency, payment_request`
- Giải thích: Tin nhắn xưng là của một tổ chức, tạo áp lực phải hành động ngay và đe dọa hậu quả nếu không làm theo. Nó cũng yêu cầu chuyển tiền. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-006 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, threat, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải xử lý gấp. Tin còn đe dọa hậu quả nếu bạn không thực hiện. Tin yêu cầu bạn chuyển tiền hoặc thanh toán. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 2
## dev-007 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa hẹn thưởng và yêu cầu chuyển tiền. Đây là dấu hiệu thường gặp trong tin lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi thực hiện.
- Điểm: 3
## dev-008 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, credential_request`
- Giải thích: Tin nhắn xưng là của một tổ chức và đòi bạn cung cấp mã OTP hoặc thông tin đăng nhập. Đây là dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-009 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro được phát hiện trong quá trình kiểm tra. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-010 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro được phát hiện. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-011 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro được phát hiện trong quá trình kiểm tra. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-012 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro được phát hiện. Bạn có thể tiếp tục như bình thường.
- Điểm: 1
## dev-013 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro được phát hiện trong quá trình kiểm tra. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-014 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: (không có: llm_invalid_output)
- Điểm: n/a
## dev-015 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu lừa đảo được phát hiện. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-016 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu lừa đảo được phát hiện. Bạn có thể tiếp tục sử dụng bình thường.
- Điểm: 1
## dev-017 (ambiguous)
- Đầu vào giải thích: verdict `suspicious`, signal `payment_request`
- Giải thích: Tin nhắn đòi chuyển tiền. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 2
## dev-018 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, claims_organization, urgency, credential_request, brand_domain_mismatch`
- Giải thích: Tin nhắn có nội dung hướng dẫn thao tác cụ thể, tuy nhiên nó tự xưng là của một tổ chức mà tên miền không khớp với tên thương hiệu. Tin còn tạo cảm giác gấp gáp và yêu cầu bạn cung cấp mã OTP hoặc thông tin đăng nhập. Đây là dấu hiệu thường thấy trong tin lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi thực hiện.
- Điểm: 2
## dev-019 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, payment_request`
- Giải thích: Tin nhắn có lệnh điều khiển công cụ đọc tin và yêu cầu chuyển tiền. Đây là dấu hiệu lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức trước khi thực hiện.
- Điểm: 2
## dev-020 (prompt_injection)
- Đầu vào giải thích: verdict `suspicious`, signal `ai_directed_instruction`
- Giải thích: Tin nhắn có câu cố điều khiển công cụ đọc tin. Đây là dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 2