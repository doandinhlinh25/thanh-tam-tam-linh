# Prompt 12 — Fine-tune reranker, biến thể C

**Tuần 4 · Phụ thuộc:** Prompt 10–11; dataset và quyền sử dụng đã được xác nhận.  
**Commit duy nhất:** `feat(retrieval): train reproducible reranker variant C`

## Tiền kiểm bắt buộc trước khi thực hiện

Đọc `AGENTS.md`, [lộ trình](README.md) và **tất cả Prompt 01–11 trong thư mục này theo đúng thứ tự**, không chỉ các prompt ghi ở dòng phụ thuộc. Với từng prompt trước, đối chiếu đầu ra và kết quả kiểm tra được ghi với cây dự án hiện tại: Git status, mã liên quan, contract, migration/cấu hình, test và báo cáo mới nhất. Prompt hoặc commit cũ không tự chứng minh chức năng đã hoàn thành.

Trước khi áp dụng yêu cầu bên dưới, ghi ngắn gọn phần **đã có / còn thiếu / lệch contract / bị chặn**, kèm đường dẫn hoặc lệnh kiểm chứng và ảnh hưởng đến prompt hiện tại. Chỉ áp dụng mục **Dừng khi phụ thuộc người khác** bên dưới nếu công việc thuộc trách nhiệm của Duy Tâm, Thanh Tâm hoặc Thanh là điều kiện cần cho prompt hiện tại và chưa hoàn thành. Không dùng mock hay số liệu giả để báo một phụ thuộc là đã đạt.

Tôi là Linh. Hãy viết training/evaluation pipeline cho reranker fine-tuned C từ dataset v1. Cố định seed, split, base checkpoint, tokenizer, hyperparameter và version output; lưu script/config và checksum/reference của checkpoint, không commit model lớn hoặc dữ liệu không được phép chia sẻ. Runner so sánh A dense, B reranker gốc, C fine-tuned trên cùng test set với Recall@K, MRR@K, nDCG@K, latency và failure cases.

Commit này chỉ gồm pipeline/config C, kiểm tra tái lập và báo cáo số đo từ lần chạy thật. Không thay C thành mặc định nếu metrics hoặc latency không đạt tiêu chí đã thống nhất với Người 4. Nếu thiếu GPU/dataset/checkpoint, ghi trạng thái chưa đánh giá thay vì điền kết quả giả.

Đọc `AGENTS.md`, giữ thay đổi người khác, không hardcode bí mật hoặc đường dẫn máy cá nhân. Chạy các phép kiểm tra có thể chạy, ghi giới hạn thực tế và tạo đúng **một commit** như trên nếu có thay đổi được kiểm chứng. Không push.

## Mốc quản lý và phân công

**Sau khi nghiệm thu:** Có pipeline huấn luyện C tái lập được và báo cáo A/B/C trên cùng test set; chỉ chọn C làm mặc định nếu tiêu chí chất lượng/latency đã thống nhất thật sự đạt.

| Mã | Chủ việc | Việc cụ thể | Bằng chứng bàn giao |
| --- | --- | --- | --- |
| F12-1 | Linh | Kiểm quyền dataset/checkpoint và đối chiếu split/version từ Prompt 10–11. | Manifest nguồn, quyền sử dụng và checksum/reference; không commit model lớn. |
| F12-2 | Linh | Cố định seed, base checkpoint, tokenizer, hyperparameter và output version. | Script/config và lệnh tái lập; không hardcode đường dẫn máy cá nhân. |
| F12-3 | Linh | Chạy đánh giá A/B/C cùng test set, ghi metrics, latency và failure cases. | Báo cáo số đo thật kèm dataset/config/checkpoint version. |
| F12-4 | Thanh Tâm | Review tiêu chí faithfulness/citation và quyết định C có đủ điều kiện để dùng hay chưa. | Quyết định có bằng chứng; thiếu GPU/dataset thì ghi chưa đánh giá. |

**Cổng nghiệm thu:** Pipeline/config có thể chạy lại, split không rò, bảng A/B/C so sánh cùng điều kiện và kết luận không vượt bằng chứng. Báo cáo F12-1–F12-4, nguồn lực còn thiếu và rủi ro triển khai C.

## Bảng theo dõi tiến độ

Sau mỗi lượt làm, cập nhật từng mã dưới đây theo trạng thái TODO / DOING / PASS / FAIL / BLOCKED. PASS cần gắn bằng chứng; BLOCKED cần ghi người gỡ và bước tiếp theo. Đánh dấu cả prompt DONE chỉ khi cổng nghiệm thu phía trên đã được chứng minh. Thông điệp commit ở đầu file chỉ là dự kiến; không commit hoặc push nếu người dùng chưa cho phép rõ ràng.

| Mã việc | Chủ việc | Trạng thái | Bằng chứng hoặc lệnh kiểm tra | Vướng mắc / người gỡ | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| F12-1 | Linh |  |  |  |  |
| F12-2 | Linh |  |  |  |  |
| F12-3 | Linh |  |  |  |  |
| F12-4 | Thanh Tâm |  |  |  |  |

## Dừng khi phụ thuộc người khác

Trong tiền kiểm hoặc bất kỳ bước nào, **chỉ dừng prompt hiện tại** khi xác định một công việc thuộc trách nhiệm của **Duy Tâm, Thanh Tâm hoặc Thanh** là điều kiện cần cho prompt này **và công việc đó chưa hoàn thành**. Khi điều kiện này xảy ra, dừng tại điểm phát hiện; không tiếp tục phần còn lại, không thay bằng mock/giả định, không đánh dấu DONE và không tạo commit cho prompt đang bị chặn. Nếu công việc của họ đã hoàn thành, tiếp tục phần việc của Linh; các vấn đề khác được xử lý và báo cáo theo kết quả thực tế, không tự áp dụng quy tắc dừng này.

Ngay khi dừng, tạo hoặc cập nhật báo cáo `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-12.md` và đánh dấu **BLOCKED**. Với từng phụ thuộc, ghi rõ người phụ trách, việc cụ thể họ phải hoàn thành, đầu ra/bằng chứng cần bàn giao, phần việc hoặc ca nghiệm thu bị ảnh hưởng, những gì đã làm trước khi dừng và điều kiện kiểm chứng để tiếp tục. Dẫn đường dẫn báo cáo trong phản hồi; chỉ tiếp tục prompt này sau khi đã đối chiếu đầu ra thực tế với mã, contract và kết quả kiểm tra hiện tại. Không ghi secret hoặc dữ liệu nhạy cảm.

## Báo cáo Markdown sau khi thực hiện

Sau khi kết thúc công việc của Prompt 12, tạo hoặc cập nhật file `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-12.md` (thay ngày bằng ngày thực hiện). Đây là đầu ra bắt buộc để bàn giao, kể cả khi công việc chỉ đạt **PARTIAL** hoặc bị **BLOCKED**; không đánh dấu **DONE** nếu chưa đủ bằng chứng theo cổng nghiệm thu.

Báo cáo ghi: mục tiêu và phạm vi thực tế; thay đổi cùng đường dẫn file/contract liên quan; trạng thái từng mã việc và ca nghiệm thu trong prompt; lệnh kiểm tra, kết quả và bằng chứng có thể đối chiếu; việc chưa chạy hoặc chưa chứng minh; blocker, người phụ trách và bước tiếp theo; kết luận **DONE / PARTIAL / BLOCKED** cùng nội dung bàn giao cho prompt kế tiếp. Không ghi secret hoặc dữ liệu nhạy cảm. Dẫn đường dẫn file báo cáo trong phần phản hồi hoàn thành.

## Quy chuẩn bắt buộc nếu phát sinh API hoặc service mới

Chỉ thêm API/service khi **phạm vi prompt này cho phép** và contract đã được đối chiếu với mã hiện tại. Với prompt chỉ làm test, schema hoặc tài liệu, không tự mở endpoint/service để tiện triển khai; ghi đề xuất, owner và phụ thuộc để xử lý ở prompt được duyệt riêng.

- **API và cấu trúc mã:** Lấy services/document-service/README.md và mã đang chạy làm mẫu phân tách trách nhiệm: controller chỉ xử lý HTTP; dto/request và dto/response giữ dữ liệu biên; services chứa business rule qua interface/implementation; authorization, queue, storage là adapter; repository/entity chỉ sở hữu dữ liệu Document; exception handler chuẩn hóa lỗi; constants và cấu hình giữ giá trị dùng lại. Cập nhật OpenAPI/event contract có version trước hoặc cùng thay đổi API, gồm request, response, status/error code và ví dụ. Không sao chép nguyên package Java sang Python/Node; giữ cùng ranh giới trách nhiệm theo stack của service đó.
- **Service mới và ranh giới dự án:** Đọc docs/architecture/service-boundaries.md. Chỉ tách service khi xác định owner nghiệp vụ/dữ liệu, API/event với service khác, credential nội bộ, migration/DBML riêng, cấu hình môi trường, health/readiness, cách build/test/deploy và README. Không truy vấn DB service khác, không chia sẻ entity/repository/business rule; shared packages chỉ chứa tiện ích kỹ thuật. Service Node theo template và docs/development/coding-conventions.md; Java theo cấu trúc Document Service; Python theo stack hiện có và contract đã chốt.
- **Quyền và chất lượng:** Xác thực danh tính và quyền tenant/course qua Auth/Tenant hoặc contract tin cậy; không tin user/tenant header do client tự gửi, không mở route nội bộ qua public gateway. Không hardcode route/status/error/secret/giá trị nghiệp vụ trong logic; dùng constant, enum hoặc env có tên rõ. Public class/method Java có Javadoc; API công khai ở ngôn ngữ khác có tài liệu tương ứng. Không khai báo biến trong vòng lặp; phương thức validation trong service trả boolean.
- **Bằng chứng hoàn thành:** Có test cho thành công, lỗi, thiếu quyền, chéo tenant, dependency lỗi và idempotency/version nếu contract áp dụng; chạy check đúng stack (Maven cho Document, npm cho Node, test Python cho inference). Cập nhật README, env example và migration/contract khi liên quan. Ghi rõ phép kiểm tra chưa chạy; không báo API/service đạt khi chỉ có mock hoặc tài liệu.
