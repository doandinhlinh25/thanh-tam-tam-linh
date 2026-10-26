# Prompt 01 — Kiểm chứng upload PDF xuyên service

**Thời gian mục tiêu:** Tuần 1, 26/10–01/11/2026.  
**Chủ việc:** Linh — Document & Retrieval.  
**Người mở phụ thuộc:** Duy Tâm — Platform, Auth & Tenant.  
**Phạm vi:** Kiểm thử luồng upload hiện có; chưa triển khai worker, retrieval, Chat hoặc UI.  
**Commit dự kiến khi được cho phép:** `test(document): verify authorized upload end to end`.

## Tiền kiểm bắt buộc trước khi thực hiện

Đây là Prompt 01 nên chưa có prompt trước để đối chiếu. Đọc `AGENTS.md`, [lộ trình](README.md) và báo cáo dự án mới nhất; kiểm tra Git status, mã Document/Auth/Tenant đang có, contract, migration/cấu hình và test liên quan. Ghi rõ **đã có / còn thiếu / lệch contract / bị chặn** cùng bằng chứng trước khi áp dụng yêu cầu bên dưới. Không coi nội dung prompt hoặc báo cáo cũ là bằng chứng chức năng đã chạy.

## Mốc dự án sẽ đạt được

Nhóm có một phép kiểm thử tích hợp **chạy lại được** cho `POST /api/v1/courses/{courseId}/documents`: phiên và quyền course được xác minh qua Auth/Tenant; Document ghi metadata vào PostgreSQL, lưu PDF private vào S3 và phát ingestion event vào Redis. Yêu cầu không được phép không tạo metadata, object hoặc event. Gửi lặp cùng idempotency key và cùng PDF không tạo tài liệu trùng.

Đây là **mốc upload được kiểm chứng**, chưa phải MVP xuyên suốt. `202` chỉ chứng minh hệ thống nhận upload; chưa chứng minh worker đưa tài liệu tới `READY`, retrieval trả evidence hay Chat tạo citation. Không gộp các mốc sau vào trạng thái hoàn thành của prompt này.

## Căn cứ phải đọc trước khi làm

- `AGENTS.md` và `docs/reports/2026-10-26/2026-10-26-project-progress-and-owners.md` để nhận đúng trạng thái mã và chủ việc.
- `contracts/openapi/document.v1.yaml`, `contracts/events/document-ingest-requested.v1.schema.json` và `services/document-service/README.md` để xác nhận HTTP contract, event và cách chạy.
- Các test trong `services/document-service/src/test/`. Test dùng mock hiện có không thay thế bằng chứng chạy với Auth, Tenant, PostgreSQL, Redis và S3 thật hoặc container tương ứng.
- Mã Auth/Tenant và cấu hình đang chạy để xác nhận cookie `tokenAdmin`, course ObjectId thật, endpoint quyền nội bộ và service credential. Không lấy ví dụ trong tài liệu làm bằng chứng môi trường đã sẵn sàng.

## Phân công và bàn giao

| Mã | Người chịu trách nhiệm | Việc phải làm | Bằng chứng hoàn thành |
| --- | --- | --- | --- |
| P1 | Duy Tâm | Cung cấp cách khởi động Auth, Tenant, PostgreSQL, Redis và S3 cùng Document; cấu hình service token. Chuẩn bị course thật, một phiên có quyền upload và một phiên hợp lệ nhưng không có quyền. | Lệnh/cấu hình chạy lại được, health dependency, course ID và cách tạo phiên thử. Chỉ bàn giao tên biến hoặc secret mẫu; không đưa giá trị thật vào Git. |
| P2 | Linh | Xác nhận P1; ghi rõ URL gọi trực tiếp Document và, nếu đã cấu hình, URL public qua gateway. Dùng dữ liệu thử cô lập theo run ID. | Danh sách dependency PASS/BLOCKED, nguồn course/session và cách dọn dữ liệu thử an toàn. |
| P3 | Linh | Viết test và fixture upload qua HTTP với dependency thật hoặc container test repo hỗ trợ. Không mock Tenant authorization, repository, object store hay Redis trong ca gọi là E2E. | Test kiểm tra HTTP cùng PostgreSQL metadata, S3 object và Redis Stream; có lệnh chạy lại và cleanup fixture. |
| P4 | Linh | Chạy ma trận U1–U7 bên dưới và ghi kết quả từng ca. | PASS/FAIL/BLOCKED cho từng ca, log che dữ liệu nhạy cảm, số bản ghi/object/event trước–sau. |
| P5 | Linh + Duy Tâm | Phân loại lỗi cấu hình, quyền hoặc service credential; giao cho đúng người sửa. Linh không sửa Auth/Tenant chỉ để test xanh. | Issue/blocker có owner, bước tái hiện, kết quả mong đợi/thực tế và ca phải chạy lại. |
| P6 | Linh | Bàn giao kết quả upload cho Thanh để nối UI ở bước sau; nêu trạng thái/event cần cho các bước ingestion và RAG tiếp theo của Thanh Tâm. | Tài liệu ngắn về `202/401/403/409/503`, document ID, trạng thái ban đầu và phần chưa kiểm chứng. |

Thanh và Thanh Tâm **không triển khai test upload trong prompt này**. Họ nhận kết quả cho các prompt sau. Nếu P1 chưa xong, Linh dừng prompt và báo cáo các đầu vào Duy Tâm cần hoàn thành; ghi ca E2E là **BLOCKED**, không đổi sang mock rồi báo PASS.

## Ma trận nghiệm thu bắt buộc

Mỗi lượt chạy dùng một run ID riêng; U4 và U5 cố ý dùng lại key của U1 trong cùng lượt để kiểm chứng idempotency. Ghi HTTP status, response/error code, document ID, số metadata row, S3 object key và số event `document-ingestion` liên quan. Đối chiếu theo tenant, course, uploader và idempotency key đã xác minh; ID do client tự khai không phải bằng chứng quyền.

| Ca | Thao tác | Kết quả HTTP | Tác dụng phụ phải xác nhận |
| --- | --- | --- | --- |
| U1 — Được phép | Cookie `tokenAdmin` thật của giảng viên/owner có quyền, course ObjectId thật, PDF hợp lệ, key mới. | `202`, document ID và danh tính đã xác minh. | Đúng một metadata row, một PDF private trên S3, một ingestion event hợp lệ. |
| U2 — Thiếu phiên | Upload không có cookie. | `401`. | Không thêm metadata, object hoặc event. |
| U3 — Không có quyền | Phiên hợp lệ của user không có quyền upload vào course. | `403`. | Không thêm metadata, object hoặc event. |
| U4 — Gửi lặp cùng nội dung | Lặp U1 với cùng phiên, course, key và bytes PDF. | Cùng document ID theo contract. | Không thêm object/event khi lần đầu đã publish thành công. Nếu lần đầu lỗi publish, ghi riêng hành vi retry. |
| U5 — Trùng key, khác nội dung | Dùng key của U1 nhưng đổi bytes PDF. | `409` với lỗi idempotency. | Không thêm metadata, object hoặc event mới. |
| U6 — Header giả | Gửi header tenant/user giả cùng một phiên thật, gồm giá trị thuộc tenant khác. | Header giả không nâng quyền; danh tính vẫn lấy từ Auth/Tenant. | Không ghi dưới tenant/user do client giả mạo. |
| U7 — Tenant không sẵn sàng | Tạm ngắt endpoint kiểm quyền trong môi trường thử cô lập rồi khôi phục. | `503` / `DOCUMENT_DEPENDENCY_UNAVAILABLE` theo mã hiện tại. | Không thêm metadata, object hoặc event. |

Nếu contract và mã thực tế khác một kỳ vọng, ghi rõ sai khác và người quyết định trước khi sửa test hoặc contract. Không sửa assertion để hợp thức hóa hành vi sai. Không báo PASS khi mới kiểm HTTP mà chưa kiểm tác dụng phụ.

## Thứ tự làm và điểm dừng

1. **Chốt môi trường:** P1–P2 hoàn tất; xác nhận Java 21, migration Document, Auth/Tenant, PostgreSQL, Redis Stream và S3 private hoạt động. Ghi cách tạo cookie/course ID mà không lưu secret.
2. **Tạo fixture:** PDF text nhỏ hợp lệ, PDF khác bytes cho U5, một phiên có quyền và một phiên hợp lệ nhưng không có quyền; key riêng theo run ID. Cleanup chỉ chạm dữ liệu của run ID.
3. **Viết và chạy test:** Ưu tiên U1–U5, tiếp đó U6–U7. Mỗi ca độc lập hoặc nêu rõ phụ thuộc U1; so số bản ghi/object/event trước–sau.
4. **Kiểm tra nền:** Chạy Maven test bằng wrapper tại `services/document-service` và phép kiểm thử mới; kiểm tra diff, dữ liệu nhạy cảm và Git status.
5. **Báo cáo:** Ghi từng ca PASS/FAIL/BLOCKED, môi trường, lệnh chạy, bằng chứng, blocker và owner. Chỉ đánh dấu prompt **DONE** khi U1–U7 chạy với dependency thật hoặc container tương ứng và đạt. Nếu thiếu hạ tầng, ghi **PARTIAL/BLOCKED** cùng bước tiếp theo.

## Mẫu cập nhật để quản lý tiến độ

Sau mỗi lượt làm, cập nhật một dòng cho từng P1–P6 và U1–U7 đã chạm tới. Không điền PASS chỉ vì đã viết code; trạng thái phải dựa trên bằng chứng chạy.

| Ngày cập nhật | Mã việc/ca | Người xử lý | Trạng thái (`TODO`/`DOING`/`PASS`/`FAIL`/`BLOCKED`) | Bằng chứng hoặc lệnh chạy | Vướng mắc và người gỡ | Bước tiếp theo |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

Trong phần kết luận, ghi riêng: **đã chứng minh** (các ca đạt với dependency thật), **chưa chứng minh** (ca thiếu môi trường/bằng chứng), **rủi ro còn mở** (issue và owner), và **bàn giao cho prompt tiếp theo**. Cách này cho phép người quản lý nhìn ra dự án tiến được tới đâu mà không nhầm test đơn vị với E2E.

## Giới hạn thay đổi và đầu ra

- Chỉ thêm/sửa test, fixture và hướng dẫn chạy cần thiết trong phạm vi Document. Không sửa Auth/Tenant để ép test đạt, không mở endpoint nội bộ qua Kong, không đưa `.env`, cookie, token hoặc secret thật vào Git.
- Phân biệt gọi trực tiếp Document với đường public qua gateway. Nếu gateway chưa cấu hình, báo kết quả là **Document + Auth/Tenant integration**, không gọi là public gateway E2E.
- Giữ thay đổi của người khác. Chuẩn bị tối đa một commit với thông điệp trên; **chỉ commit khi người dùng cho phép rõ ràng**, không push.
- Đầu ra gồm: đường dẫn test/fixture, lệnh dựng và chạy, bảng kết quả U1–U7, bằng chứng tác dụng phụ, blocker có owner và kết luận chính xác mốc upload đã đạt hay chưa. Không dùng tỷ lệ phần trăm thay cho bằng chứng.

## Dừng khi phụ thuộc người khác

Trong tiền kiểm hoặc bất kỳ bước nào, **chỉ dừng prompt hiện tại** khi xác định một công việc thuộc trách nhiệm của **Duy Tâm, Thanh Tâm hoặc Thanh** là điều kiện cần cho prompt này **và công việc đó chưa hoàn thành**. Khi điều kiện này xảy ra, dừng tại điểm phát hiện; không tiếp tục phần còn lại, không thay bằng mock/giả định, không đánh dấu DONE và không tạo commit cho prompt đang bị chặn. Nếu công việc của họ đã hoàn thành, tiếp tục phần việc của Linh; các vấn đề khác được xử lý và báo cáo theo kết quả thực tế, không tự áp dụng quy tắc dừng này.

Ngay khi dừng, tạo hoặc cập nhật báo cáo `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-01.md` và đánh dấu **BLOCKED**. Với từng phụ thuộc, ghi rõ người phụ trách, việc cụ thể họ phải hoàn thành, đầu ra/bằng chứng cần bàn giao, phần việc hoặc ca nghiệm thu bị ảnh hưởng, những gì đã làm trước khi dừng và điều kiện kiểm chứng để tiếp tục. Dẫn đường dẫn báo cáo trong phản hồi; chỉ tiếp tục prompt này sau khi đã đối chiếu đầu ra thực tế với mã, contract và kết quả kiểm tra hiện tại. Không ghi secret hoặc dữ liệu nhạy cảm.

## Báo cáo Markdown sau khi thực hiện

Sau khi kết thúc công việc của Prompt 01, tạo hoặc cập nhật file `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-01.md` (thay ngày bằng ngày thực hiện). Đây là đầu ra bắt buộc để bàn giao, kể cả khi công việc chỉ đạt **PARTIAL** hoặc bị **BLOCKED**; không đánh dấu **DONE** nếu chưa đủ bằng chứng theo cổng nghiệm thu.

Báo cáo ghi: mục tiêu và phạm vi thực tế; thay đổi cùng đường dẫn file/contract liên quan; trạng thái từng mã việc và ca nghiệm thu trong prompt; lệnh kiểm tra, kết quả và bằng chứng có thể đối chiếu; việc chưa chạy hoặc chưa chứng minh; blocker, người phụ trách và bước tiếp theo; kết luận **DONE / PARTIAL / BLOCKED** cùng nội dung bàn giao cho prompt kế tiếp. Không ghi secret hoặc dữ liệu nhạy cảm. Dẫn đường dẫn file báo cáo trong phần phản hồi hoàn thành.

## Quy chuẩn bắt buộc nếu phát sinh API hoặc service mới

Chỉ thêm API/service khi **phạm vi prompt này cho phép** và contract đã được đối chiếu với mã hiện tại. Với prompt chỉ làm test, schema hoặc tài liệu, không tự mở endpoint/service để tiện triển khai; ghi đề xuất, owner và phụ thuộc để xử lý ở prompt được duyệt riêng.

- **API và cấu trúc mã:** Lấy services/document-service/README.md và mã đang chạy làm mẫu phân tách trách nhiệm: controller chỉ xử lý HTTP; dto/request và dto/response giữ dữ liệu biên; services chứa business rule qua interface/implementation; authorization, queue, storage là adapter; repository/entity chỉ sở hữu dữ liệu Document; exception handler chuẩn hóa lỗi; constants và cấu hình giữ giá trị dùng lại. Cập nhật OpenAPI/event contract có version trước hoặc cùng thay đổi API, gồm request, response, status/error code và ví dụ. Không sao chép nguyên package Java sang Python/Node; giữ cùng ranh giới trách nhiệm theo stack của service đó.
- **Service mới và ranh giới dự án:** Đọc docs/architecture/service-boundaries.md. Chỉ tách service khi xác định owner nghiệp vụ/dữ liệu, API/event với service khác, credential nội bộ, migration/DBML riêng, cấu hình môi trường, health/readiness, cách build/test/deploy và README. Không truy vấn DB service khác, không chia sẻ entity/repository/business rule; shared packages chỉ chứa tiện ích kỹ thuật. Service Node theo template và docs/development/coding-conventions.md; Java theo cấu trúc Document Service; Python theo stack hiện có và contract đã chốt.
- **Quyền và chất lượng:** Xác thực danh tính và quyền tenant/course qua Auth/Tenant hoặc contract tin cậy; không tin user/tenant header do client tự gửi, không mở route nội bộ qua public gateway. Không hardcode route/status/error/secret/giá trị nghiệp vụ trong logic; dùng constant, enum hoặc env có tên rõ. Public class/method Java có Javadoc; API công khai ở ngôn ngữ khác có tài liệu tương ứng. Không khai báo biến trong vòng lặp; phương thức validation trong service trả boolean.
- **Bằng chứng hoàn thành:** Có test cho thành công, lỗi, thiếu quyền, chéo tenant, dependency lỗi và idempotency/version nếu contract áp dụng; chạy check đúng stack (Maven cho Document, npm cho Node, test Python cho inference). Cập nhật README, env example và migration/contract khi liên quan. Ghi rõ phép kiểm tra chưa chạy; không báo API/service đạt khi chỉ có mock hoặc tài liệu.
