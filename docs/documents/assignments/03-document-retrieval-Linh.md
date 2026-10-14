# Người 3 — Document, Retrieval & Fine-tuning Lead

**Trạng thái:** Chưa có Document Service, worker, dữ liệu huấn luyện hoặc Python inference.<br>
**Nguồn:** Sổ tay AI-01, mục 5.3–5.4, 6–7, 9.3, 10 và 14.<br>
**Phạm vi mã nguồn dự kiến:** `services/document-service/`, `services/document-worker/`, `ai/datasets/`, `ai/training/`, `ai/inference/`, `ai/reports/` và contract giao tiếp liên quan. Chỉ tạo các thư mục này khi có mã/dữ liệu phù hợp.

## Mục tiêu

Biến PDF text thành chunk có nguồn/trang rõ ràng, truy xuất được theo quyền tenant/course và tạo reranker đã fine-tune có thể đánh giá lại. Document Service sở hữu document, chunk, embedding và ingestion state; worker xử lý queue theo cùng ranh giới dữ liệu, không sở hữu database riêng.

## Công việc theo thứ tự

1. **Tuần 1 — hợp đồng:** thống nhất với Người 4 request/response retrieval, evidence ID, page range, model version và lỗi; với Người 2 chốt API kiểm tra quyền course, storage, PostgreSQL/pgvector và Redis. Công bố contract có phiên bản trước khi ghép service.
2. **Tuần 2–3 — ingestion:** tạo Document Service từ template hiện tại, DBML và migration riêng; API upload xác thực MIME/size, checksum, object storage private, trạng thái UPLOADED/QUEUED/PROCESSING/READY/FAILED. Queue job theo document ID + version, retry có giới hạn và xử lý idempotent.
3. **Tuần 3 — worker và retrieval:** parse text theo trang, phát hiện PDF scan không hỗ trợ, chunk giữ page range, tạo embedding có model version và lưu pgvector. API search lọc tenant/course/document ACL **trước khi trả candidates**; tài liệu đã xóa không được truy xuất.
4. **Tuần 3–4 — dữ liệu và mô hình:** xây guideline gán nhãn question–evidence, hard negatives và split theo document/course để tránh rò dữ liệu. Chạy A: dense retrieval, B: dense + reranker gốc, C: dense + reranker fine-tuned trên cùng test set và cấu hình có thể lặp lại.
5. **Tuần 4–5 — inference và báo cáo:** triển khai Python HTTP inference nội bộ có xác thực service, timeout và version; ghi checkpoint reference, config, seed, dữ liệu được phép chia sẻ, Recall@K/MRR@K/nDCG@K, latency và failure cases. Cung cấp ba variant cho Người 4 chạy end-to-end evaluation.

## Phụ thuộc và bàn giao cho nhóm

| Cần từ | Nội dung |
|---|---|
| Người 2 | Tenant/Course authorization, database, storage, Redis, service credential và cấu hình Compose |
| Người 4 | Retrieval/evidence contract, tiêu chí citation, bộ câu hỏi đánh giá và review nhãn |
| Người 1 | Yêu cầu hiển thị tiến độ, lỗi ingestion, document metadata và citation page |

**Sản phẩm bàn giao:** Document Service + worker, OpenAPI/event contract, DBML/migration, dataset v1 theo quyền chia sẻ, training script/config, checkpoint reference, inference API và báo cáo A/B/C.

## Điều kiện nghiệm thu

- PDF text đi từ upload đến READY; citation truy về đúng document và trang. PDF scan trả trạng thái lỗi có cấu trúc.
- Truy vấn của tenant/course không bao giờ trả chunk ngoài quyền; xóa/retry không tạo chunk trùng hoặc lộ dữ liệu cũ.
- Kết quả A/B/C tái lập được từ version dataset/config/checkpoint; không tuyên bố C tốt hơn B khi metrics không chứng minh.
- Test xử lý upload, retry, xóa khi job chạy, lọc ACL và sai model version; build/typecheck/test cho phần Node đạt.
