# Khảo sát Prompt 01 — kiểm chứng upload PDF xuyên service

## 1. Yêu cầu và phạm vi

Yêu cầu của người dùng: “thực hiện công việc trong file docs\prompts\ai01\linh\01-upload-e2e.md”. Prompt yêu cầu test HTTP thực với Auth, Tenant, Document, PostgreSQL, S3 và Redis; ghi kết quả U1–U7 và báo cáo Markdown. Theo `AGENTS.md` và `docs/workflow/README.md`, lượt này chỉ thực hiện giai đoạn Scout, chưa sửa test hoặc service.

## 2. Tổng quan liên quan

- **Đã xác minh:** `services/document-service/pom.xml` dùng Spring Boot 3.5.16/Java 21 cùng JPA, PostgreSQL, Redis và AWS S3 SDK. `services/document-service/README.md` xác nhận phạm vi đang triển khai là upload; `contracts/openapi/document.v1.yaml` còn mô tả GET/DELETE/retrieval chưa được chứng minh bởi mã.
- **Đã xác minh:** `services/tenant-service/routes/internal.route.ts` bảo vệ `POST /internal/authorization/course` bằng service token và `verifyToken`; `services/tenant-service/controllers/internal.controller.ts` lấy tenant/user từ course và phiên đã xác minh, kiểm tra quyền `document:upload`.

## 3. Trạng thái Git và base

- **Đã xác minh:** `git status --short --branch` cho thấy nhánh `Linh` tại `fbc9c03`, theo dõi `origin/Linh` và báo ahead 17/behind 1 theo ref lưu cục bộ. Nhánh `main` hiện tại ở `82157f1`; chưa xác minh được trạng thái remote trực tiếp. Không dùng `origin/main` làm bằng chứng mới nhất.
- **Đã xác minh:** Có thay đổi tracked ở `docs/documents/assignments/02-platform-saas-Duy-Tam.md` và các mục chưa theo dõi `docs/handoffs/2026-10-25-bt2-ad001.md`, `docs/prompts/`, `docs/reports/2026-10-25/`, `docs/reports/2026-10-26/`, `output/`. Giữ nguyên mọi phần việc này. `git worktree list` còn ghi một worktree detached tại `C:/Users/User/.codex/worktrees/f1ab/thanh-tam-tam-linh`.
- **Đã xác minh:** Scout Document trước đó tại `docs/reports/2026-10-26/2026-10-26-document-service-scout.md` ghi base `f6b1b02`. `git log f6b1b02..HEAD -- services/document-service` có thêm `cae12d1` và `fbc9c03` về interceptor và cấu hình Tenant, nên báo cáo cũ chỉ dùng làm điểm tham chiếu.

## 4. File và vai trò

| File | Vai trò đã xác minh |
| --- | --- |
| `docs/prompts/ai01/linh/01-upload-e2e.md` | Phạm vi P1–P6, U1–U7, giới hạn chỉ sửa test/fixture/hướng dẫn và yêu cầu báo cáo. |
| `services/document-service/src/main/java/com/linh/document/controller/UploadController.java` | Nhận multipart PDF và trả 202 sau khi service xử lý. |
| `services/document-service/src/main/java/com/linh/document/services/authorization/UploadCourseAuthorizationInterceptor.java` và `.../impl/HttpCourseAuthorizationGatewayImpl.java` | Chuyển cookie gốc tới Tenant; ánh xạ thiếu phiên 401, thiếu quyền 403 và dependency lỗi 503. |
| `services/document-service/src/main/java/com/linh/document/services/business/impl/UploadServiceImpl.java` | Tính checksum, kiểm tra idempotency, ghi S3, metadata, rồi gửi Redis. |
| `services/document-service/src/main/java/com/linh/document/repository/DocumentsRepository.java` và `database/migrations/001_document_upload.sql` | Lưu documents/ingestion_jobs, unique key theo tenant/course/uploader/idempotency key. |
| `services/document-service/src/main/java/com/linh/document/services/storage/impl/S3DocumentObjectStoreImpl.java` và `.../queue/impl/RedisIngestionQueueImpl.java` | Ghi object private và publish payload vào stream `document-ingestion`. |
| `services/document-service/src/test/java/com/linh/document/controller/UploadHttpTest.java` và `.../authorization/impl/HttpCourseAuthorizationGatewayImplTest.java` | Mock MVC/service và HTTP server giả; chưa kiểm chứng toàn bộ dependency. |
| `contracts/openapi/document.v1.yaml` và `contracts/events/document-ingest-requested.v1.schema.json` | Contract HTTP và event v1 để đối chiếu assertion. |

## 5. Hiện trạng và quy ước

- **Đã có:** Upload direct HTTP, Tenant authorization và đường ghi PostgreSQL/S3/Redis theo các file ở mục 4. `test/platform.integration.ts` có ca gọi Tenant authorization với phiên lecturer/student/admin nhưng không chạy Java Document hay ba dependency lưu trữ cùng nhau.
- **Còn thiếu:** Không thấy test E2E U1–U7 trong `services/document-service/src/test/`; các test hiện tại dùng mock hoặc HTTP server giả. Chưa có bằng chứng đếm row, S3 object và Redis event trước/sau request thực.
- **Lệch contract cần ghi nhận:** OpenAPI mô tả PDF có lớp văn bản trong `contracts/openapi/document.v1.yaml`; `UploadController.java` và `UploadRequest.java` hiện chỉ kiểm tra MIME/chữ ký/kích thước, chưa xác nhận lớp văn bản. Prompt 01 chỉ kiểm thử upload, không được tự mở rộng sang worker/parser.
- **Quy ước:** `docs/development/coding-conventions.md` và hướng dẫn của người dùng yêu cầu tên constant/config rõ nghĩa, không khai báo biến trong vòng lặp, Javadoc cho public Java API và validation service trả `boolean`. `docs/architecture/service-boundaries.md` giữ dữ liệu Tenant ở Tenant Service.

## 6. Lệnh và baseline

- **Có sẵn:** `.\mvnw.cmd test` trong `services/document-service`; `npm run test:platform` ở repo root. `package.json` cho thấy root npm build/typecheck/test không bao gồm Java. Scout Document và báo cáo dự án ngày 2026-10-26 đã ghi Maven test và platform test PASS, nhưng chỉ trong phạm vi mock/local server hoặc Auth/Tenant; lượt Scout này không chạy lại vì mã tương ứng chưa thay đổi sau báo cáo tiến độ tại `fbc9c03`.
- **Đã xác minh:** `Test-Path` trả false cho ba file `.env` của Auth, Tenant và Document. `docker info --format '{{.ServerVersion}}'` thất bại do không có pipe Docker Desktop Linux Engine. Có `java.exe` Java 21, `docker.exe`, `psql.exe`; không thấy `redis-cli` hay `mc` trong `Get-Command`. Các dữ kiện này không chứng minh có hoặc không có service bên ngoài đang chạy.
- **Chưa chạy:** U1–U7 với dependency thật, migration trên PostgreSQL thật và kiểm chứng qua public gateway.

## 7. Rủi ro, giả định và câu hỏi mở

- **Bị chặn hiện tại:** Chưa có cấu hình môi trường/cách tạo course và hai phiên thử đã xác minh; Docker daemon không hoạt động. P1 của Duy Tâm là phụ thuộc để chạy E2E. Cần xác nhận có thể dùng dịch vụ ngoài Docker hay không trước khi kết luận hạ tầng hoàn toàn không sẵn sàng.
- **Rủi ro:** `UploadServiceImpl.java` gửi Redis trước khi `DocumentsRepository.markQueued` cập nhật PostgreSQL; test cần kiểm riêng trạng thái và event trong trường hợp retry/lỗi giữa hai bước. Không suy ra bảo đảm transaction xuyên Redis/PostgreSQL từ mã hiện có.
- **Giả định chưa xác minh:** Đường direct Document sẽ dùng cổng trong `services/document-service/.env.example`; không coi giá trị ví dụ là môi trường chạy thật. `infrastructure/gateway` có cấu hình nhưng chưa chứng minh route public upload đã hoạt động.
- **Câu hỏi cần Duy Tâm trả lời ở bước kế tiếp:** Cách khởi động an toàn Auth/Tenant/MongoDB/PostgreSQL/Redis/S3 với credential thử; cách tạo course và hai phiên có/không có quyền; service token giữa Tenant và Document. Không ghi secret vào tài liệu.

## 8. Bước tiếp theo

Đi tới `$plan` vì Prompt 01 đã xác định phạm vi và ma trận U1–U7. Kế hoạch cần tách phần viết fixture/test có thể làm độc lập khỏi phần chạy thật phụ thuộc P1, và ghi cách xác nhận/cleanup dữ liệu theo run ID. Chỉ sau khi kế hoạch được duyệt mới bắt đầu `$cook` theo workflow của repo.
