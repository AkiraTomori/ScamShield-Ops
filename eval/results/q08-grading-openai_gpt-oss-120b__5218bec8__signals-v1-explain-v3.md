# Chấm tiếng Việt: openai/gpt-oss-120b

Thang: 1 = sai/khó hiểu, 2 = đúng nhưng vụng, 3 = tự nhiên. Ghi thêm nếu giải thích nêu sự kiện ngoài signal (SO-03-AC05).

## dev-001 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, brand_domain_mismatch, urgency, threat, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức nhưng tên miền không khớp với thương hiệu, đồng thời tạo áp lực phải hành động ngay và kèm đe dọa hậu quả nếu không làm; nó còn yêu cầu bạn cung cấp mã xác thực hoặc thông tin đăng nhập. Bạn nên không thực hiện và xác minh qua kênh chính thức của tổ chức trước khi phản hồi.
- Điểm: 2
## dev-002 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, lookalike_domain, urgency, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức và dùng tên miền gần giống tên miền chính thức. Tin nhắn tạo áp lực phải thực hiện ngay và yêu cầu bạn cung cấp mã xác thực hoặc thông tin đăng nhập. Bạn nên xác minh thông tin qua kênh chính thức của tổ chức trước khi thực hiện bất kỳ hành động nào.
- Điểm: 3
## dev-003 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa sẽ nhận được phần thưởng hoặc lợi ích và đồng thời yêu cầu bạn chuyển tiền hoặc thanh toán. Đây là những dấu hiệu thường gặp trong các tin lừa đảo. Bạn nên không thực hiện và kiểm tra lại thông tin qua kênh chính thức trước khi hành động.
- Điểm: 2
## dev-004 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải thực hiện ngay và yêu cầu bạn chuyển tiền. Đây là các dấu hiệu thường gặp trong tin lừa đảo. Bạn nên xác minh thông tin qua kênh chính thức trước khi thực hiện bất kỳ hành động nào.
- Điểm: 3
## dev-005 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, threat, urgency, payment_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức, đồng thời đe dọa hậu quả nếu không thực hiện. Nó còn tạo áp lực phải hành động ngay và yêu cầu bạn chuyển tiền. Những dấu hiệu này thường xuất hiện trong các tin lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi thực hiện bất kỳ yêu cầu nào.
- Điểm: 3
## dev-006 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, threat, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải thực hiện ngay, đe dọa hậu quả nếu không làm và yêu cầu bạn chuyển tiền. Đây là các dấu hiệu thường gặp trong tin lừa đảo. Bạn nên không thực hiện và xác minh thông tin qua kênh chính thức trước khi hành động.
- Điểm: 2
## dev-007 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa thưởng hoặc lợi ích và đồng thời yêu cầu bạn chuyển tiền. Đây là những dấu hiệu thường gặp trong các tin lừa đảo. Bạn nên không thực hiện yêu cầu và xác nhận lại thông tin qua kênh chính thức của tổ chức trước khi hành động.
- Điểm: 2
## dev-008 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức và yêu cầu bạn cung cấp thông tin đăng nhập hoặc mã xác thực. Đây là các dấu hiệu thường gặp trong tin lừa đảo. Bạn nên xác minh lại thông tin qua kênh chính thức trước khi thực hiện bất kỳ yêu cầu nào.
- Điểm: 3
## dev-009 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-010 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Trong tin nhắn này không phát hiện thấy bất kỳ dấu hiệu rủi ro nào được hệ thống kiểm tra. Bạn nên vẫn xác minh thông tin qua kênh chính thức trước khi thực hiện bất kỳ yêu cầu nào.
- Điểm: 2
## dev-011 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Trong tin nhắn không phát hiện dấu hiệu rủi ro nào. Bạn có thể tiếp tục xử lý nhưng vẫn nên thận trọng.
- Điểm: 2
## dev-012 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Trong tin nhắn không phát hiện dấu hiệu rủi ro nào. Bạn vẫn nên thận trọng và xác nhận thông tin qua kênh chính thức nếu cần.
- Điểm: 3
## dev-013 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Trong tin nhắn này không phát hiện dấu hiệu rủi ro nào. Bạn vẫn nên thận trọng khi xử lý thông tin.
- Điểm: 3
## dev-014 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Trong tin nhắn này không có dấu hiệu rủi ro nào được phát hiện. Bạn nên thận trọng và xác minh lại thông tin qua kênh chính thức trước khi thực hiện bất kỳ hành động nào.
- Điểm: 2
## dev-015 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra. Bạn nên vẫn cẩn trọng và xác nhận thông tin qua kênh chính thức nếu có yêu cầu nào.
- Điểm: 2
## dev-016 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Tin nhắn không có dấu hiệu rủi ro nào được phát hiện, vì không có yếu tố như yêu cầu thông tin cá nhân, tạo áp lực hay liên kết đáng ngờ. Do đó hệ thống không thể khẳng định đây là tin lừa đảo hay không. Bạn nên kiểm tra lại qua kênh chính thức nếu có bất kỳ yêu cầu nào.
- Điểm: 2
## dev-017 (ambiguous)
- Đầu vào giải thích: verdict `suspicious`, signal `payment_request`
- Giải thích: Tin nhắn yêu cầu bạn chuyển tiền hoặc thanh toán. Bạn nên xác minh lại qua kênh chính thức trước khi thực hiện.
- Điểm: 3
## dev-018 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, claims_organization, urgency, credential_request, brand_domain_mismatch`
- Giải thích: Tin nhắn tự xưng là của một tổ chức và yêu cầu bạn cung cấp thông tin đăng nhập. Nó tạo áp lực phải thực hiện ngay và có chỉ dẫn để thực hiện hành động. Địa chỉ web được nhắc tới không khớp với tên miền chính thức của thương hiệu. Bạn nên xác minh lại qua kênh chính thức trước khi thực hiện bất kỳ yêu cầu nào.
- Điểm: 2
## dev-019 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, payment_request`
- Giải thích: Tin nhắn chứa yêu cầu thực hiện hành động do một chỉ dẫn tự động đưa ra. Nó cũng yêu cầu bạn thực hiện thanh toán hoặc chuyển tiền. Bạn nên không thực hiện và xác minh lại thông tin qua kênh chính thức trước khi hành động.
- Điểm: 2
## dev-020 (prompt_injection)
- Đầu vào giải thích: verdict `suspicious`, signal `ai_directed_instruction`
- Giải thích: Tin nhắn có chứa chỉ dẫn yêu cầu công cụ thực hiện một hành động. Bạn nên không thực hiện và xác minh lại thông tin qua kênh chính thức trước khi làm bất kỳ việc gì.
- Điểm: 2