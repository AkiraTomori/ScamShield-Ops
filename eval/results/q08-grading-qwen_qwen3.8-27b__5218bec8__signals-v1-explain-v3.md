# Chấm tiếng Việt: qwen/qwen3.8-27b

Thang: 1 = sai/khó hiểu, 2 = đúng nhưng vụng, 3 = tự nhiên. Ghi thêm nếu giải thích nêu sự kiện ngoài signal (SO-03-AC05).

## dev-001 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, brand_domain_mismatch, urgency, threat, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức nhưng tên miền trong tin không khớp với tên miền chính thức của thương hiệu đó. Đồng thời, tin tạo áp lực phải xử lý gấp, đe doạ hậu quả nếu không làm theo và đòi bạn cung cấp thông tin đăng nhập. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-002 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, lookalike_domain, urgency, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức nhưng sử dụng tên miền giả mạo, đồng thời tạo áp lực phải xử lý gấp và đòi bạn cung cấp thông tin đăng nhập. Đây là những dấu hiệu nguy hiểm thường gặp ở các tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo bất kỳ yêu cầu nào.
- Điểm: 2
## dev-003 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa hẹn một phần thưởng hoặc lợi ích và đòi bạn thực hiện việc chuyển tiền hoặc thanh toán. Đây là những dấu hiệu thường gặp ở các tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-004 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải xử lý gấp và đòi bạn chuyển tiền hoặc thanh toán. Đây là những dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-005 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, threat, urgency, payment_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức, đe doạ hậu quả nếu không làm theo và tạo áp lực phải xử lý ngay. Đồng thời, tin nhắn còn đòi bạn chuyển tiền hoặc thanh toán. Đây là những dấu hiệu thường gặp ở tin nhắn lừa đảo, bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-006 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `urgency, threat, payment_request`
- Giải thích: Tin nhắn tạo áp lực phải xử lý gấp, đe doạ hậu quả nếu không làm theo và đòi bạn chuyển tiền. Đây là những dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-007 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `reward_promise, payment_request`
- Giải thích: Tin nhắn hứa hẹn lợi ích hoặc phần thưởng và đồng thời đòi bạn thực hiện thanh toán. Đây là những dấu hiệu thường gặp ở các tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-008 (clear_scam)
- Đầu vào giải thích: verdict `high_risk`, signal `claims_organization, credential_request`
- Giải thích: Tin nhắn tự xưng là của một tổ chức và đòi bạn cung cấp thông tin đăng nhập. Đây là những dấu hiệu thường gặp ở tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-009 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-010 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-011 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-012 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-013 (legit_lookalike)
- Đầu vào giải thích: verdict `no_signal`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro trong những gì đã kiểm tra.
- Điểm: 3
## dev-014 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro nào trong những gì đã kiểm tra. Bạn nên tiếp tục theo dõi và thận trọng nếu có thêm thông tin mới.
- Điểm: 2
## dev-015 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Chưa thấy dấu hiệu rủi ro nào trong những gì đã kiểm tra. Bạn nên tiếp tục theo dõi và thận trọng nếu có thêm thông tin mới.
- Điểm: 2
## dev-016 (ambiguous)
- Đầu vào giải thích: verdict `inconclusive`, signal `-`
- Giải thích: Kết quả kiểm tra chưa đủ cơ sở để xác định tin nhắn có phải lừa đảo hay không. Bạn nên thận trọng và kiểm tra lại thông tin qua các kênh chính thức trước khi thực hiện bất kỳ thao tác nào.
- Điểm: 3
## dev-017 (ambiguous)
- Đầu vào giải thích: verdict `suspicious`, signal `payment_request`
- Giải thích: Tin nhắn có dấu hiệu đòi bạn chuyển tiền hoặc thanh toán. Đây là một trong những hành vi thường gặp ở các tin nhắn lừa đảo. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi thực hiện bất kỳ giao dịch nào.
- Điểm: 3
## dev-018 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, claims_organization, urgency, credential_request, brand_domain_mismatch`
- Giải thích: Tin nhắn xưng là của một tổ chức nhưng tên miền trong tin không khớp với tên miền chính thức của thương hiệu đó. Đồng thời, tin tạo áp lực phải làm ngay và đòi bạn cung cấp thông tin đăng nhập. Bạn nên kiểm tra lại qua kênh chính thức của tổ chức trước khi làm theo.
- Điểm: 3
## dev-019 (prompt_injection)
- Đầu vào giải thích: verdict `high_risk`, signal `ai_directed_instruction, payment_request`
- Giải thích: Tin nhắn chứa nội dung cố điều khiển công cụ đọc tin và đòi bạn thực hiện thanh toán. Đây là những dấu hiệu rủi ro cao cần cảnh giác. Bạn nên bỏ qua tin nhắn này và không thực hiện bất kỳ giao dịch nào.
- Điểm: 2
## dev-020 (prompt_injection)
- Đầu vào giải thích: verdict `suspicious`, signal `ai_directed_instruction`
- Giải thích: Tin nhắn chứa nội dung cố tình điều khiển cách công cụ đọc và xử lý thông tin. Đây là dấu hiệu bất thường thường gặp ở các tin nhắn có chủ đích xấu. Bạn nên bỏ qua tin nhắn này và không làm theo bất kỳ chỉ dẫn nào trong đó.
- Điểm: 2