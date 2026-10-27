# Lộ trình prompt của Linh

Mỗi file dưới đây là một yêu cầu độc lập và tối đa một commit. Dùng theo thứ tự; một prompt bị chặn phải được ghi nhận trước khi làm prompt phụ thuộc. Nếu chức năng đã có, kiểm tra mã/test rồi bỏ qua commit rỗng.

**Quy tắc tiền kiểm cho mọi prompt:** Đọc toàn bộ prompt có số nhỏ hơn theo thứ tự, rồi đối chiếu đầu ra dự kiến của chúng với mã, contract, cấu hình, test, Git status và báo cáo mới nhất của dự án. Ghi bằng chứng phần đã có, thiếu hoặc bị chặn trước khi làm prompt hiện tại. Prompt 01 không có prompt trước; vẫn phải kiểm tra hiện trạng dự án. Chỉ tiếp tục phần phụ thuộc khi đầu vào thực tế đã sẵn sàng; một prompt hoặc commit cũ không tự chứng minh đã hoàn thành.

**Dừng khi phụ thuộc người khác:** Chỉ dừng prompt nếu một công việc thuộc trách nhiệm của Duy Tâm, Thanh Tâm hoặc Thanh là điều kiện cần cho prompt hiện tại và công việc đó chưa hoàn thành. Ghi báo cáo Markdown với việc người phụ trách cần hoàn thành, bằng chứng bàn giao và điều kiện tiếp tục; đánh dấu BLOCKED. Khi công việc của họ đã hoàn thành, tiếp tục phần việc của Linh và báo cáo các vấn đề khác theo kết quả thực tế.

**Quản lý thực hiện:** Prompt 02–15 có mã đầu việc, chủ việc, bằng chứng bàn giao, cổng nghiệm thu và bảng cập nhật trạng thái. Cập nhật TODO/DOING/PASS/FAIL/BLOCKED theo kết quả thật; ghi blocker, người gỡ và bước kế tiếp. Chỉ đánh dấu một prompt DONE khi cổng nghiệm thu của chính prompt đó có bằng chứng. Tên commit trong bảng là dự kiến, không phải quyền tự commit hoặc push; tuân thủ `AGENTS.md` và chỉ commit khi người dùng cho phép rõ ràng.

**Báo cáo sau mỗi prompt:** Sau khi kết thúc lượt thực hiện, tạo hoặc cập nhật một file Markdown riêng tại `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-NN.md` (thay ngày và số prompt thực tế), kể cả khi kết quả là PARTIAL hoặc BLOCKED. Mỗi prompt bên dưới nêu nội dung báo cáo bắt buộc; liên kết file báo cáo khi bàn giao để prompt sau có thể đối chiếu với mã và kết quả kiểm tra hiện tại.

**Khi phát sinh API hoặc service:** Mỗi prompt có mục quy chuẩn áp dụng có điều kiện. Giữ cách tách trách nhiệm của `document-service`, contract có version và các ranh giới trong `docs/architecture/service-boundaries.md`; dùng quy ước theo Java, Node hoặc Python đang áp dụng cho service đó. Không mở rộng phạm vi prompt chỉ để tạo endpoint/service mới.

| Tuần | # | Prompt | Commit dự kiến |
| --- | ---: | --- | --- |
| 1 | 01 | [Upload xuyên service](01-upload-e2e.md) | `test(document): verify authorized upload end to end` |
| 1 | 02 | [Hợp đồng retrieval](02-retrieval-contract.md) | `docs(document): finalize retrieval and ingestion contracts` |
| 1 | 03 | [Schema ingestion](03-ingestion-schema.md) | `feat(document): add versioned ingestion schema` |
| 2 | 04 | [Worker lifecycle](04-worker-lifecycle.md) | `feat(document): consume ingestion jobs idempotently` |
| 2 | 05 | [PDF text](05-pdf-text.md) | `feat(document): extract page-aware PDF text` |
| 2 | 06 | [Embedding/index](06-embedding-index.md) | `feat(document): index versioned chunk embeddings` |
| 2 | 07 | [Trạng thái tài liệu](07-document-status.md) | `feat(document): expose authorized document status` |
| 3 | 08 | [Xóa tài liệu](08-document-delete.md) | `feat(document): delete documents without stale evidence` |
| 3 | 09 | [Retrieval có ACL](09-retrieval-acl.md) | `feat(document): search authorized evidence by course` |
| 3 | 10 | [Dữ liệu và metrics](10-retrieval-evaluation-data.md) | `test(retrieval): add versioned evaluation dataset and metrics` |
| 3 | 11 | [Reranker gốc B](11-reranker-baseline.md) | `feat(retrieval): add baseline reranker variant B` |
| 4 | 12 | [Fine-tune C](12-reranker-finetune.md) | `feat(retrieval): train reproducible reranker variant C` |
| 4 | 13 | [Inference API](13-inference-api.md) | `feat(retrieval): expose versioned reranker inference API` |
| 4 | 14 | [E2E Document](14-document-e2e.md) | `test(document): cover ingestion retrieval and deletion end to end` |
| 4 | 15 | [Bàn giao MVP](15-document-handoff.md) | `docs(document): hand off validated retrieval MVP` |

**Mốc nghiệm thu:** 25/11/2026. Các prompt tập trung vào phần việc của Linh; tiến độ thực tế còn phụ thuộc Auth/Tenant/hạ tầng của Duy Tâm và Chat/evidence của Thanh Tâm.
