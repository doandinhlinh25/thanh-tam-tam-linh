# Prompt 13 — API inference nội bộ có version

**Tuần 4 · Phụ thuộc:** Prompt 11–12; contract và service credential thống nhất với Người 2/4.  
**Commit duy nhất:** `feat(retrieval): expose versioned reranker inference API`

## Tiền kiểm bắt buộc trước khi thực hiện

Đọc `AGENTS.md`, [lộ trình](README.md) và **tất cả Prompt 01–12 trong thư mục này theo đúng thứ tự**, không chỉ các prompt ghi ở dòng phụ thuộc. Với từng prompt trước, đối chiếu đầu ra và kết quả kiểm tra được ghi với cây dự án hiện tại: Git status, mã liên quan, contract, migration/cấu hình, test và báo cáo mới nhất. Prompt hoặc commit cũ không tự chứng minh chức năng đã hoàn thành.

Trước khi áp dụng yêu cầu bên dưới, ghi ngắn gọn phần **đã có / còn thiếu / lệch contract / bị chặn**, kèm đường dẫn hoặc lệnh kiểm chứng và ảnh hưởng đến prompt hiện tại. Chỉ áp dụng mục **Dừng khi phụ thuộc người khác** bên dưới nếu công việc thuộc trách nhiệm của Duy Tâm, Thanh Tâm hoặc Thanh là điều kiện cần cho prompt hiện tại và chưa hoàn thành. Không dùng mock hay số liệu giả để báo một phụ thuộc là đã đạt.

Tôi là Linh. Hãy triển khai Python HTTP inference nội bộ cho reranker B/C theo contract đã chốt; biến thể A tiếp tục dùng dense retrieval, không gọi reranker. Endpoint yêu cầu service credential, timeout, giới hạn kích thước và version model; trả thứ tự/score ứng viên cùng model version, request ID và lỗi có cấu trúc. Không nhận tài liệu ngoài tập candidates hợp quyền do Document retrieval đưa vào. Cung cấp health/readiness dựa trên model thực, cấu hình checkpoint qua env và hướng dẫn chạy local/container.

Commit này chỉ làm ranh giới inference và adapter gọi từ Document/Chat nếu contract yêu cầu; không sửa pipeline Chat thuộc Người 4 ngoài một interface đã thống nhất. Test token sai, timeout, version không có, input quá giới hạn và output ổn định từ fixture.

Đọc `AGENTS.md`, giữ thay đổi chưa commit, không commit model/secret. Chạy test service và contract, kiểm tra diff, tạo đúng **một commit** như trên. Không push.

## Mốc quản lý và phân công

**Sau khi nghiệm thu:** B/C có inference API nội bộ có auth/version/giới hạn; A tiếp tục dùng dense retrieval. Chưa coi public API hay Chat đã tự động tích hợp nếu adapter chưa được kiểm chứng.

| Mã | Chủ việc | Việc cụ thể | Bằng chứng bàn giao |
| --- | --- | --- | --- |
| I13-1 | Duy Tâm | Chốt service credential, mạng nội bộ và cách cấp secret cho inference. | Contract caller và cấu hình an toàn, không mở public gateway. |
| I13-2 | Linh | Triển khai endpoint B/C, model version, request ID, timeout, size limit, lỗi cấu trúc và readiness model thật. | OpenAPI/contract, test token sai/version không có/input quá giới hạn. |
| I13-3 | Linh | Nối adapter đúng contract, chỉ nhận candidates đã qua ACL; giữ A không gọi reranker. | Test thứ tự/score ổn định, timeout và không thêm tài liệu ngoài tập đầu vào. |
| I13-4 | Thanh Tâm | Xác nhận cách Chat gọi và xử lý lỗi/fallback của inference. | Ví dụ tích hợp và quyết định interface được hai bên thống nhất. |

**Cổng nghiệm thu:** Secret không vào Git, endpoint chỉ nội bộ, readiness phản ánh model thật, lỗi/version được báo rõ và adapter không nới ACL. Báo cáo I13-1–I13-4 cùng kết quả chạy local/container.

## Bảng theo dõi tiến độ

Sau mỗi lượt làm, cập nhật từng mã dưới đây theo trạng thái TODO / DOING / PASS / FAIL / BLOCKED. PASS cần gắn bằng chứng; BLOCKED cần ghi người gỡ và bước tiếp theo. Đánh dấu cả prompt DONE chỉ khi cổng nghiệm thu phía trên đã được chứng minh. Thông điệp commit ở đầu file chỉ là dự kiến; không commit hoặc push nếu người dùng chưa cho phép rõ ràng.

| Mã việc | Chủ việc | Trạng thái | Bằng chứng hoặc lệnh kiểm tra | Vướng mắc / người gỡ | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- |
| I13-1 | Duy Tâm |  |  |  |  |
| I13-2 | Linh |  |  |  |  |
| I13-3 | Linh |  |  |  |  |
| I13-4 | Thanh Tâm |  |  |  |  |

## Dừng khi phụ thuộc người khác

Trong tiền kiểm hoặc bất kỳ bước nào, **chỉ dừng prompt hiện tại** khi xác định một công việc thuộc trách nhiệm của **Duy Tâm, Thanh Tâm hoặc Thanh** là điều kiện cần cho prompt này **và công việc đó chưa hoàn thành**. Khi điều kiện này xảy ra, dừng tại điểm phát hiện; không tiếp tục phần còn lại, không thay bằng mock/giả định, không đánh dấu DONE và không tạo commit cho prompt đang bị chặn. Nếu công việc của họ đã hoàn thành, tiếp tục phần việc của Linh; các vấn đề khác được xử lý và báo cáo theo kết quả thực tế, không tự áp dụng quy tắc dừng này.

Ngay khi dừng, tạo hoặc cập nhật báo cáo `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-13.md` và đánh dấu **BLOCKED**. Với từng phụ thuộc, ghi rõ người phụ trách, việc cụ thể họ phải hoàn thành, đầu ra/bằng chứng cần bàn giao, phần việc hoặc ca nghiệm thu bị ảnh hưởng, những gì đã làm trước khi dừng và điều kiện kiểm chứng để tiếp tục. Dẫn đường dẫn báo cáo trong phản hồi; chỉ tiếp tục prompt này sau khi đã đối chiếu đầu ra thực tế với mã, contract và kết quả kiểm tra hiện tại. Không ghi secret hoặc dữ liệu nhạy cảm.

## Báo cáo Markdown sau khi thực hiện

Sau khi kết thúc công việc của Prompt 13, tạo hoặc cập nhật file `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-13.md` (thay ngày bằng ngày thực hiện). Đây là đầu ra bắt buộc để bàn giao, kể cả khi công việc chỉ đạt **PARTIAL** hoặc bị **BLOCKED**; không đánh dấu **DONE** nếu chưa đủ bằng chứng theo cổng nghiệm thu.

Báo cáo ghi: mục tiêu và phạm vi thực tế; thay đổi cùng đường dẫn file/contract liên quan; trạng thái từng mã việc và ca nghiệm thu trong prompt; lệnh kiểm tra, kết quả và bằng chứng có thể đối chiếu; việc chưa chạy hoặc chưa chứng minh; blocker, người phụ trách và bước tiếp theo; kết luận **DONE / PARTIAL / BLOCKED** cùng nội dung bàn giao cho prompt kế tiếp. Không ghi secret hoặc dữ liệu nhạy cảm. Dẫn đường dẫn file báo cáo trong phần phản hồi hoàn thành.

## Quy chuẩn bắt buộc nếu phát sinh API hoặc service mới

Chỉ thêm API/service khi **phạm vi prompt này cho phép** và contract đã được đối chiếu với mã hiện tại. Với prompt chỉ làm test, schema hoặc tài liệu, không tự mở endpoint/service để tiện triển khai; ghi đề xuất, owner và phụ thuộc để xử lý ở prompt được duyệt riêng.

- **API và cấu trúc mã:** Lấy services/document-service/README.md và mã đang chạy làm mẫu phân tách trách nhiệm: controller chỉ xử lý HTTP; dto/request và dto/response giữ dữ liệu biên; services chứa business rule qua interface/implementation; authorization, queue, storage là adapter; repository/entity chỉ sở hữu dữ liệu Document; exception handler chuẩn hóa lỗi; constants và cấu hình giữ giá trị dùng lại. Cập nhật OpenAPI/event contract có version trước hoặc cùng thay đổi API, gồm request, response, status/error code và ví dụ. Không sao chép nguyên package Java sang Python/Node; giữ cùng ranh giới trách nhiệm theo stack của service đó.
- **Service mới và ranh giới dự án:** Đọc docs/architecture/service-boundaries.md. Chỉ tách service khi xác định owner nghiệp vụ/dữ liệu, API/event với service khác, credential nội bộ, migration/DBML riêng, cấu hình môi trường, health/readiness, cách build/test/deploy và README. Không truy vấn DB service khác, không chia sẻ entity/repository/business rule; shared packages chỉ chứa tiện ích kỹ thuật. Service Node theo template và docs/development/coding-conventions.md; Java theo cấu trúc Document Service; Python theo stack hiện có và contract đã chốt.
- **Quyền và chất lượng:** Xác thực danh tính và quyền tenant/course qua Auth/Tenant hoặc contract tin cậy; không tin user/tenant header do client tự gửi, không mở route nội bộ qua public gateway. Không hardcode route/status/error/secret/giá trị nghiệp vụ trong logic; dùng constant, enum hoặc env có tên rõ. Public class/method Java có Javadoc; API công khai ở ngôn ngữ khác có tài liệu tương ứng. Không khai báo biến trong vòng lặp; phương thức validation trong service trả boolean.
- **Bằng chứng hoàn thành:** Có test cho thành công, lỗi, thiếu quyền, chéo tenant, dependency lỗi và idempotency/version nếu contract áp dụng; chạy check đúng stack (Maven cho Document, npm cho Node, test Python cho inference). Cập nhật README, env example và migration/contract khi liên quan. Ghi rõ phép kiểm tra chưa chạy; không báo API/service đạt khi chỉ có mock hoặc tài liệu.
