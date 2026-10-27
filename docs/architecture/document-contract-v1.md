# Hợp đồng Document v1 — đề xuất để rà soát

**Trạng thái:** Đã có API upload đầu tiên và bản di trú cơ sở dữ liệu; chưa có tiến trình xử lý hàng đợi, API truy xuất hay tích hợp quyền Tenant thực tế.
**Người phụ trách:** Người 3. **Cần rà soát:** Người 2 (Platform/Tenant), Người 4 (Chat/RAG), Người 1 (UI).

## Các file hợp đồng

- `contracts/openapi/document.v1.yaml`: API công khai và API truy xuất nội bộ.
- `contracts/events/document-ingest-requested.v1.schema.json`: dữ liệu thông điệp hàng đợi có phiên bản.
- `services/document-service/database/schema.dbml`: dữ liệu chỉ do Document Service sở hữu.

API thành công dùng `ApiResponse` của `@saas/common`; API lỗi dùng `ApiFailureResponse` trong `contracts/openapi/common.yaml`. Tên trường JSON theo quy ước `camelCase` của hợp đồng v1. Lược đồ cơ sở dữ liệu dùng `snake_case`.

## Quyền và ranh giới dữ liệu

1. Gateway xác thực yêu cầu công khai. Document Service vẫn kiểm tra quyền quản lý hoặc xem tài liệu bằng API của Tenant Service. Không coi `tenantId`, `actorUserId`, vai trò hoặc header do client tự gửi là bằng chứng cấp quyền.
2. `/internal/v1/retrieval/search` chỉ cho Chat Service gọi bằng thông tin xác thực giữa các service và không mở qua Kong. Document Service kiểm tra lại quyền môn học hiện tại của `actorUserId` với Tenant Service. Xác thực service gọi không thay thế việc kiểm tra quyền của người hỏi.
3. Truy xuất giới hạn theo tenant, môn học, quyền tài liệu, trạng thái `READY`, phiên bản tài liệu và phiên bản chỉ mục đang hoạt động **trước khi trả các ứng viên**. `COURSE` dành cho người có quyền môn học; `RESTRICTED` yêu cầu thêm quyền được cấp theo người dùng. Không đọc trực tiếp cơ sở dữ liệu Tenant/Identity/Chat.
4. Khi xóa, ghi nhận `DELETING` trước khi dọn tệp, chunk và vector. Truy xuất loại `DELETING` và `DELETED` ngay; tiến trình xử lý hàng đợi phải kiểm tra lại trạng thái trước khi ghi dữ liệu hoặc chuyển sang `READY`.
5. `evidenceId` chỉ định một ứng viên trong phản hồi truy xuất; Chat lưu ảnh chụp tập bằng chứng của lượt hỏi và chỉ chấp nhận ID trích dẫn thuộc tập đó. `chunkId` là ID ổn định của chunk thuộc một phiên bản tài liệu.

## Xử lý tài liệu và chống xử lý trùng

`UPLOADED → QUEUED → PROCESSING → READY` hoặc `FAILED`; xóa đi qua `DELETING → DELETED`. Khi tải lên, máy chủ xác minh MIME, chữ ký tệp, kích thước và mã băm SHA-256; sau đó lưu tệp ở kho riêng tư và tạo tác vụ theo `(documentId, documentVersion)`. Cùng `Idempotency-Key` và cùng nội dung yêu cầu sẽ trả về tài liệu đã tạo; cùng khóa nhưng nội dung khác trả `409`. Tiến trình xử lý hàng đợi đọc lại dữ liệu Document, xác minh tenant, phiên bản và trạng thái; thử lại có giới hạn và không tạo trùng chunk hoặc embedding. PDF dạng ảnh không có lớp văn bản chuyển sang `FAILED` với mã `PDF_TEXT_NOT_FOUND`.

`ingestion_jobs` ghi trạng thái từng phiên bản và số lần thử. `chunks` có ràng buộc duy nhất `(document_id, document_version, chunk_index)`; `embeddings` có ràng buộc duy nhất `(chunk_id, model_version, index_version)`. Dữ liệu thuộc phiên bản cũ không được truy xuất. Khi đổi bộ tách văn bản, cách chia chunk hoặc mô hình embedding, cần lập chỉ mục lại có phiên bản và chỉ kích hoạt một chỉ mục đồng nhất.

## Mã lỗi đề xuất

| Mã | Tình huống |
|---|---|
| `DOCUMENT_FILE_INVALID` | File không phải PDF hợp lệ |
| `DOCUMENT_FILE_TOO_LARGE` | Vượt giới hạn cấu hình |
| `DOCUMENT_IDEMPOTENCY_CONFLICT` | Dùng lại khóa với nội dung khác |
| `DOCUMENT_NOT_FOUND` | Không tồn tại hoặc đã xóa |
| `DOCUMENT_ACCESS_DENIED` | Không có quyền môn học hoặc tài liệu |
| `PDF_TEXT_NOT_FOUND` | PDF dạng ảnh hoặc không có lớp văn bản |
| `INDEX_VERSION_MISMATCH` | Phiên bản chỉ mục yêu cầu khác phiên bản đang hoạt động |
| `RETRIEVAL_UNAVAILABLE` | Không thể kiểm tra quyền hoặc truy xuất index |
| `DOCUMENT_DEPENDENCY_UNAVAILABLE` | Dịch vụ xác minh quyền upload chưa sẵn sàng |

Lỗi kỹ thuật dùng `successful: false`; không diễn giải thành `insufficient_evidence`. Hạn mức, kích thước tệp tối đa, số lần thử lại và `candidateK` tối đa lấy từ cấu hình khi triển khai.

## Cần xác nhận trước khi triển khai

| Người | Quyết định cần chốt |
|---|---|
| Người 2 | Cookie/CSRF qua gateway, thông tin xác thực giữa các service, API kiểm tra quyền môn học, mã lỗi chung, PostgreSQL/pgvector, Redis, kho lưu trữ tệp và hạn mức tải lên. |
| Người 4 | Tên trường trong phản hồi truy xuất, vòng đời `evidenceId`, ảnh chụp tập bằng chứng, `candidateK`, phiên bản chỉ mục đang hoạt động và cách xử lý tài liệu bị xóa trong lúc chat. |
| Người 1 | Cách hiển thị tiến độ/trạng thái, mã lỗi PDF dạng ảnh, thông tin tài liệu và trang trích dẫn. |

Khi chốt mô hình embedding, bản di trú cơ sở dữ liệu phải khai báo số chiều vector cố định và chỉ mục tương ứng. Không chọn mô hình, số chiều, giới hạn tệp hay ngưỡng truy xuất chỉ dựa trên giá trị ví dụ trong sổ tay.
