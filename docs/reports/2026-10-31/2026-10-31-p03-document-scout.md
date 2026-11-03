# P03-document — SCOUT — 2026-10-31

## 1. Yêu cầu và phạm vi

- Yêu cầu: thực hiện `docs/prompts/ai01/linh/Thanh-Tam-Bo-Prompt-Nhieu-AI-R0-R1-v1.1/thanh-tam-bo-prompt-multi-ai-v1.1/R0-on-dinh-hien-trang/P03-document-prompt-v1.0.md`. Prompt không có dòng giao `GIAI_DOAN` khác, nên chỉ chạy **SCOUT**.
- Chỉ khảo sát chuỗi upload PDF đã có trong `services/document-service/**`. Không sửa code, hợp đồng, migration, dịch vụ khác hoặc dữ liệu. Tài liệu V4 ở `.../reference/Thanh-Tam-Tai-Lieu-Tong-Hop-BRD-Kien-Truc-V4.md` là thiết kế TO-BE; phần upload tới `QUEUED` được tài liệu đó ghi AS-IS (bảng tại dòng 42).

## 2. Tổng quan có liên quan

- **Verified:** `services/document-service/pom.xml` dùng Java 21, Spring Boot 3.5.16, Web, JPA/PostgreSQL, Redis và AWS S3 SDK. `src/main/resources/application.properties` cấu hình các dependency qua biến môi trường, multipart resolve lazily và giới hạn file.
- **Verified:** `contracts/openapi/document.v1.yaml` còn mô tả GET/DELETE/retrieval; trong `services/document-service/src/main/java` chỉ có controller upload và health. Không coi các path hợp đồng kia là chức năng đã chạy.
- **Verified:** `docs/development/coding-conventions.md` hướng dẫn Node/TypeScript; yêu cầu Java/Javadoc và boolean validation của chủ dự án vẫn là ràng buộc nếu có giai đoạn sửa Java sau này.

## 3. Git và hiện trạng làm việc

- Branch/worktree: `Linh` tại `C:/Users/User/MyProjects/thanh-tam-tam-linh`, HEAD/base `066baea8592f6f45e538272b947a3a2473c77305`; `origin/Linh` trong cache chậm hơn một commit. Một worktree khác tại `C:/Users/User/.codex/worktrees/f1ab/thanh-tam-tam-linh` ở detached HEAD `f65831c`. `git branch -vv`, `git log -10 --oneline`, `git worktree list` đã đọc; không kiểm tra remote online nên **Unknown** remote hiện tại có mới hơn cache không.
- `git status --short --branch` ban đầu: một file đã sửa `docs/documents/assignments/02-platform-saas-Duy-Tam.md` và nhiều file/thư mục chưa track trong `docs/`, `output/`, gồm chính bộ prompt và báo cáo Document ngày 2026-10-26. Không có thay đổi sẵn trong `services/document-service/**`. Các thay đổi này được giữ nguyên.
- Git báo dubious ownership trong sandbox. Các lệnh đọc Git dùng `git -c safe.directory=C:/Users/User/MyProjects/thanh-tam-tam-linh ...`; không đổi global config, branch hoặc worktree.
- Báo cáo cũ `docs/reports/2026-10-26/2026-10-26-document-service-scout.md` phản ánh commit `f6b1b02`, nên kết luận test và Git trong đó là lịch sử, không phải baseline của lượt này.

## 4. File và chức năng AS-IS

| File | Hành vi cũ đã xác minh | Thay đổi lượt này | Test liên quan | Tình trạng |
| --- | --- | --- | --- | --- |
| `controller/UploadController.java`, `dto/request/UploadRequest.java` | `POST /api/v1/courses/{courseId}/documents`; kiểm trường bắt buộc, MIME `application/pdf`, magic `%PDF-`, trả 202 | Không | `UploadHttpTest` | AS-IS |
| `services/authorization/UploadCourseAuthorizationInterceptor.java`, `services/authorization/impl/HttpCourseAuthorizationGatewayImpl.java` | Kiểm quyền trước controller; gửi cookie và service credential đến Tenant; ánh xạ 401/403/503 | Không | `UploadHttpTest`, `HttpCourseAuthorizationGatewayImplTest` | AS-IS |
| `services/business/impl/UploadServiceImpl.java` | SHA-256; tra key theo tenant/course/user; ghi S3; tạo metadata; gửi queue; đánh dấu `QUEUED`; key cùng bytes tái sử dụng, khác bytes xung đột | Không | `UploadServiceImplTest` | AS-IS |
| `repository/DocumentsRepository.java`, `database/migrations/001_document_upload.sql` | PostgreSQL `documents` và `ingestion_jobs`; unique idempotency; `ON CONFLICT`; `markQueued` có transaction DB | Không | Unit test service dùng mock; sandbox E2E có kiểm DB | AS-IS |
| `services/storage/impl/S3DocumentObjectStoreImpl.java`, `services/queue/impl/RedisIngestionQueueImpl.java` | S3 private; Redis Stream `document-ingestion`, event `document.ingest.requested` với khóa chống publish trùng | Không | Sandbox E2E kiểm object/event | AS-IS |
| `constants/DocumentContract.java`, `exception/DocumentErrorHandler.java`, `README.md` | Giữ route, status/error, scope `COURSE`, storage key và hướng dẫn upload | Không | HTTP/unit test | AS-IS |

`contracts/events/document-ingest-requested.v1.schema.json` xác nhận tên event/fields. `scripts/sandbox-upload-e2e.mjs` có ca U1–U7 cho 202, 401, 403, retry, 409, header giả, Tenant outage; file thuộc P08, không sửa.

## 5. Rủi ro và điểm có thể gia cố sau khi lập/duyệt kế hoạch

1. **Verified — cửa sổ nhất quán queue/DB:** `UploadServiceImpl.enqueueIfRequired` gọi `queue.enqueue` trước `repository.markQueued`. Nếu bước DB lỗi hoặc process dừng sau khi Redis nhận event, consumer có thể thấy document còn `UPLOADED`; Redis dedup đã đánh dấu publish. Cần xác minh bằng regression/failure test trước khi chọn sửa; không thêm outbox trong R0.
2. **Verified — cleanup S3 có thể thất bại:** `UploadServiceImpl` cố xóa object khi `createIfAbsent` ném lỗi, nhưng khi `createIfAbsent` trả null thì `objectStore.remove` có thể ném trước khi đọc bản ghi đồng thời. Unit test hiện chỉ có trường hợp remove thành công. Có thể để object mồ côi hoặc làm retry thất bại; cần test lỗi cleanup và xác định hành vi mong muốn.
3. **Verified — PDF chỉ kiểm magic bytes:** `UploadRequest.hasPdfSignature` so MIME và 5 byte `%PDF-`, không xác minh cấu trúc PDF hoặc text layer. `README.md` chưa nói rõ giới hạn này; tài liệu OpenAPI nhắc PDF có lớp văn bản như mục tiêu. Có thể làm rõ tài liệu trong vùng sở hữu, không thêm parser/worker.
4. **Verified — thiếu phép thử lỗi adapter:** Unit tests hiện có 17 phương thức `@Test` ở 5 lớp, nhưng không có unit test trực tiếp cho Redis/S3 adapter, Tenant timeout/5xx/malformed success, HTTP 403/409/415 hoặc retry `UPLOADED` sau Redis failure. `scripts/sandbox-upload-e2e.mjs` bao phủ một số đường đi nhưng cần sandbox đang chạy; P08 sở hữu fixture.
5. **Verified — lỗi DB được ánh xạ tổng quát:** `DocumentErrorHandler` trả 500 cho exception ngoài `DocumentException`; `UploadServiceImpl` truyền lỗi repository ra ngoài. Đây là trạng thái hiện tại, chưa kết luận cần đổi status vì có thể ảnh hưởng hợp đồng và cần tái hiện đúng lỗi.

Ưu tiên đề xuất cho PLAN: kiểm lỗi/side effect và test các điểm (1)–(2); bổ sung phủ test authz/adapter theo (4); làm rõ giới hạn PDF (3). Điểm (5) cần quyết định riêng sau khi có bằng chứng và phê duyệt thay đổi API.

## 6. Lệnh kiểm tra và kết quả

- Đã đọc: `git status --short --branch`, `git branch -vv`, `git log -10 --oneline`, `git worktree list`, `git rev-parse HEAD`, `rg --files services/document-service`, các file Java/test/config/migration và tài liệu liên quan. Các lệnh đọc thành công sau ngoại lệ `safe.directory` ở từng lệnh Git.
- `services/document-service/.\mvnw.cmd test -q`: **NOT RUN** (wrapper dừng trước khi Maven khởi động: `icm : Cannot index into a null array`, `Cannot start maven from wrapper`). Thử `cmd /c mvnw.cmd test -q` cho cùng lỗi. Có Java 21 nhưng không thấy lệnh `mvn` trong PATH; không có số test pass của lượt này.
- `npm run sandbox:upload-e2e`: **NOT RUN**. Lệnh cần sandbox và fixture, ca U7 tạm dừng Tenant; SCOUT không thay đổi trạng thái hạ tầng đang dùng. Không suy ra PASS từ mã test hay báo cáo cũ.

## 7. Chưa đụng tới, phụ thuộc và bước tiếp

- Chưa đụng tới: toàn bộ code/test/config/migration trong `services/document-service/**`, `contracts/**`, `scripts/**`, `infrastructure/**`, dữ liệu thật và thay đổi Git hiện có. Không làm MongoDB migration, worker, READY, retrieval, GET/DELETE, Kong, frontend hay event mới.
- Phụ thuộc nhóm khác: P08 nếu cần cập nhật sandbox fixture hoặc chạy U1–U7; chủ dự án/điều phối viên nếu cần thay file ngoài vùng P03. Chưa gửi thông báo cho P08 vì chưa có yêu cầu sửa fixture được xác nhận.
- **Recommended next step:** `$plan` cho các lỗi/kiểm thử R0 được chấp thuận; dùng `$brainstorm` riêng nếu muốn chọn giữa nhiều cách xử lý nhất quán Redis–DB. Không bắt đầu stage kế tiếp khi chưa được giao.

## 8. Diff và rollback

- Diff sản phẩm: không có. Chỉ thêm báo cáo SCOUT và handoff P03. Rollback artifact: xóa đúng hai file P03 mới tạo nếu chủ dự án yêu cầu; không có thay đổi runtime để rollback.
