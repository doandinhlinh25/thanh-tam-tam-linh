# Prompt 05 — Tách văn bản PDF theo trang

**Tuần 2 · Phụ thuộc:** Prompt 04.  
**Commit duy nhất:** `feat(document): extract page-aware PDF text`

## Tiền kiểm bắt buộc trước khi thực hiện

Đọc `AGENTS.md`, [lộ trình](README.md) và **tất cả Prompt 01–04 trong thư mục này theo đúng thứ tự**, không chỉ các prompt ghi ở dòng phụ thuộc. Với từng prompt trước, đối chiếu đầu ra và kết quả kiểm tra được ghi với cây dự án hiện tại: Git status, mã liên quan, contract, migration/cấu hình, test và báo cáo mới nhất. Prompt hoặc commit cũ không tự chứng minh chức năng đã hoàn thành.

Trước khi áp dụng yêu cầu bên dưới, ghi ngắn gọn phần **đã có / còn thiếu / lệch contract / bị chặn**, kèm đường dẫn hoặc lệnh kiểm chứng và ảnh hưởng đến prompt hiện tại. Chỉ áp dụng mục **Dừng khi phụ thuộc người khác** bên dưới nếu công việc thuộc trách nhiệm của Duy Tâm, Thanh Tâm hoặc Thanh là điều kiện cần cho prompt hiện tại và chưa hoàn thành. Không dùng mock hay số liệu giả để báo một phụ thuộc là đã đạt.

Tôi là Linh. Hãy thêm bước đọc PDF từ object storage, kiểm tra định dạng và tách văn bản theo trang cho worker. Lưu chunk có thứ tự và `pageFrom/pageTo` chính xác theo migration ở Prompt 03. PDF dạng ảnh hoặc không có text phải đi tới `FAILED` với mã `PDF_TEXT_NOT_FOUND`; PDF hỏng trả mã lỗi kỹ thuật phù hợp. Tránh đưa nội dung nhạy cảm của PDF vào log. Xử lý retry không tạo chunk trùng.

Commit này chỉ phụ trách PDF extraction/chunking, chưa gọi embedding model hay mở retrieval API. Giới hạn kích thước và thuật toán chia chunk lấy từ cấu hình đã chốt; test bằng PDF text nhiều trang, PDF scan và file hỏng với assertion về page range, thứ tự và trạng thái.

Đọc `AGENTS.md`, giữ thay đổi chưa commit. Với Java, thêm Javadoc cho mọi public class/method, không hardcode cấu hình, không khai báo biến trong vòng lặp và dùng `boolean` cho validation service. Chạy test liên quan, kiểm tra diff, tạo đúng **một commit** như trên. Không push.

## Mốc quản lý và phân công

**Sau khi nghiệm thu:** Worker tách văn bản PDF theo trang thành chunk có thứ tự; PDF scan và PDF hỏng có trạng thái lỗi rõ. Chưa tạo embedding hoặc mở search.

| Mã | Chủ việc | Việc cụ thể | Bằng chứng bàn giao |
| --- | --- | --- | --- |
| T05-1 | Linh | Chuẩn bị PDF text nhiều trang, scan, file hỏng và đáp án trang/chunk mong đợi. | Fixture nhỏ không chứa dữ liệu riêng tư. |
| T05-2 | Linh | Đọc PDF từ S3 private, tách theo trang và lưu chunk theo document/version. | Test thứ tự, pageFrom/pageTo và log không lộ nội dung PDF. |
| T05-3 | Linh | Xử lý scan không text, PDF hỏng và retry. | PDF_TEXT_NOT_FOUND cho scan; lỗi kỹ thuật cho file hỏng; không nhân đôi chunk. |
| T05-4 | Thanh Tâm | Xác nhận metadata trang/chunk đủ cho citation ở bước sau. | Phản hồi trường còn thiếu; không triển khai Chat trong prompt này. |

**Cổng nghiệm thu:** PDF nhiều trang cho chunk đúng trang/thứ tự, scan đi FAILED đúng mã, retry giữ số chunk ổn định và test chạy lại được. Báo cáo T05-1–T05-4 và phần phụ thuộc Prompt 06.

## Bảng theo dõi tiến độ

Sau mỗi lượt làm, cập nhật từng mã dưới đây theo trạng thái TODO / DOING / PASS / FAIL / BLOCKED. PASS cần gắn bằng chứng; BLOCKED cần ghi người gỡ và bước tiếp theo. Đánh dấu cả prompt DONE chỉ khi cổng nghiệm thu phía trên đã được chứng minh. Thông điệp commit ở đầu file chỉ là dự kiến; không commit hoặc push nếu người dùng chưa cho phép rõ ràng.

| Mã việc | Chủ việc | Trạng thái | Bằng chứng hoặc lệnh kiểm tra | Vướng mắc / người gỡ | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| T05-1 | Linh |  |  |  |  |
| T05-2 | Linh |  |  |  |  |
| T05-3 | Linh |  |  |  |  |
| T05-4 | Thanh Tâm |  |  |  |  |

## Dừng khi phụ thuộc người khác

Trong tiền kiểm hoặc bất kỳ bước nào, **chỉ dừng prompt hiện tại** khi xác định một công việc thuộc trách nhiệm của **Duy Tâm, Thanh Tâm hoặc Thanh** là điều kiện cần cho prompt này **và công việc đó chưa hoàn thành**. Khi điều kiện này xảy ra, dừng tại điểm phát hiện; không tiếp tục phần còn lại, không thay bằng mock/giả định, không đánh dấu DONE và không tạo commit cho prompt đang bị chặn. Nếu công việc của họ đã hoàn thành, tiếp tục phần việc của Linh; các vấn đề khác được xử lý và báo cáo theo kết quả thực tế, không tự áp dụng quy tắc dừng này.

Ngay khi dừng, tạo hoặc cập nhật báo cáo `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-05.md` và đánh dấu **BLOCKED**. Với từng phụ thuộc, ghi rõ người phụ trách, việc cụ thể họ phải hoàn thành, đầu ra/bằng chứng cần bàn giao, phần việc hoặc ca nghiệm thu bị ảnh hưởng, những gì đã làm trước khi dừng và điều kiện kiểm chứng để tiếp tục. Dẫn đường dẫn báo cáo trong phản hồi; chỉ tiếp tục prompt này sau khi đã đối chiếu đầu ra thực tế với mã, contract và kết quả kiểm tra hiện tại. Không ghi secret hoặc dữ liệu nhạy cảm.

## Báo cáo Markdown sau khi thực hiện

Sau khi kết thúc công việc của Prompt 05, tạo hoặc cập nhật file `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-05.md` (thay ngày bằng ngày thực hiện). Đây là đầu ra bắt buộc để bàn giao, kể cả khi công việc chỉ đạt **PARTIAL** hoặc bị **BLOCKED**; không đánh dấu **DONE** nếu chưa đủ bằng chứng theo cổng nghiệm thu.

Báo cáo ghi: mục tiêu và phạm vi thực tế; thay đổi cùng đường dẫn file/contract liên quan; trạng thái từng mã việc và ca nghiệm thu trong prompt; lệnh kiểm tra, kết quả và bằng chứng có thể đối chiếu; việc chưa chạy hoặc chưa chứng minh; blocker, người phụ trách và bước tiếp theo; kết luận **DONE / PARTIAL / BLOCKED** cùng nội dung bàn giao cho prompt kế tiếp. Không ghi secret hoặc dữ liệu nhạy cảm. Dẫn đường dẫn file báo cáo trong phần phản hồi hoàn thành.

## Quy chuẩn bắt buộc nếu phát sinh API hoặc service mới

Chỉ thêm API/service khi **phạm vi prompt này cho phép** và contract đã được đối chiếu với mã hiện tại. Với prompt chỉ làm test, schema hoặc tài liệu, không tự mở endpoint/service để tiện triển khai; ghi đề xuất, owner và phụ thuộc để xử lý ở prompt được duyệt riêng.

- **API và cấu trúc mã:** Lấy services/document-service/README.md và mã đang chạy làm mẫu phân tách trách nhiệm: controller chỉ xử lý HTTP; dto/request và dto/response giữ dữ liệu biên; services chứa business rule qua interface/implementation; authorization, queue, storage là adapter; repository/entity chỉ sở hữu dữ liệu Document; exception handler chuẩn hóa lỗi; constants và cấu hình giữ giá trị dùng lại. Cập nhật OpenAPI/event contract có version trước hoặc cùng thay đổi API, gồm request, response, status/error code và ví dụ. Không sao chép nguyên package Java sang Python/Node; giữ cùng ranh giới trách nhiệm theo stack của service đó.
- **Service mới và ranh giới dự án:** Đọc docs/architecture/service-boundaries.md. Chỉ tách service khi xác định owner nghiệp vụ/dữ liệu, API/event với service khác, credential nội bộ, migration/DBML riêng, cấu hình môi trường, health/readiness, cách build/test/deploy và README. Không truy vấn DB service khác, không chia sẻ entity/repository/business rule; shared packages chỉ chứa tiện ích kỹ thuật. Service Node theo template và docs/development/coding-conventions.md; Java theo cấu trúc Document Service; Python theo stack hiện có và contract đã chốt.
- **Quyền và chất lượng:** Xác thực danh tính và quyền tenant/course qua Auth/Tenant hoặc contract tin cậy; không tin user/tenant header do client tự gửi, không mở route nội bộ qua public gateway. Không hardcode route/status/error/secret/giá trị nghiệp vụ trong logic; dùng constant, enum hoặc env có tên rõ. Public class/method Java có Javadoc; API công khai ở ngôn ngữ khác có tài liệu tương ứng. Không khai báo biến trong vòng lặp; phương thức validation trong service trả boolean.
- **Bằng chứng hoàn thành:** Có test cho thành công, lỗi, thiếu quyền, chéo tenant, dependency lỗi và idempotency/version nếu contract áp dụng; chạy check đúng stack (Maven cho Document, npm cho Node, test Python cho inference). Cập nhật README, env example và migration/contract khi liên quan. Ghi rõ phép kiểm tra chưa chạy; không báo API/service đạt khi chỉ có mock hoặc tài liệu.
