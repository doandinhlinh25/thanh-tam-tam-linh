# PROMPT P03 / v1.0 — Document Service — hardening upload PDF hiện có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P03-document`  
**Độ ưu tiên:** `P0`  
**Người sở hữu:** Thành viên Backend Document (Java)  
**Vùng sửa code ĐỘC QUYỀN:** `services/document-service/**`  
**Nhịp tích hợp:** Song song; phối hợp P08 về test fixture, không sửa file P08  
**Nhánh gợi ý:** `ai/p03-document-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Document Service — hardening upload PDF hiện có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

services/document-service/src/main/java/com/linh/document/controller/UploadController.java; services/business/impl/UploadServiceImpl.java; services/authorization/impl/HttpCourseAuthorizationGatewayImpl.java; services/queue/impl/RedisIngestionQueueImpl.java; services/storage/impl/S3DocumentObjectStoreImpl.java; database/migrations/001_document_upload.sql

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Chỉ gia cố chuỗi đã chạy: `POST /api/v1/courses/{courseId}/documents` → Tenant authz → kiểm MIME/magic PDF → S3 private → PostgreSQL metadata/jobs → Redis Stream → `202 QUEUED`.
- Kiểm request thiếu cookie/không có quyền, header giả, file sai MIME/chữ ký, idempotency retry, conflict HTTP 409, timeout Tenant/Redis/S3, cleanup khi lỗi; sửa bug được xác nhận trong phần code này.
- Giữ nguyên `Idempotency-Key`, scope document `COURSE`, đường dẫn lưu S3, schema và event hiện đang được sử dụng. Kiểm biến cấu hình và xử lý lỗi.
- Bổ sung unit tests Java cho code upload đã có, tài liệu hóa rõ mức kiểm PDF chỉ là magic bytes (chưa xác nhận cấu trúc tệp).

### Tuyệt đối KHÔNG làm

- **KHÔNG chuyển PostgreSQL/JPA sang MongoDB** ở R0; V4 chỉ là đích, P03 chưa có migration approval.
- KHÔNG làm ingestion worker, extract/chunk/embedding/vector index/retrieval/get/delete document hay chuyển `READY`.
- KHÔNG tạo Mongo DB Document, outbox mới, không làm dual write, không đổi Docker sandbox.
- KHÔNG đọc/ghi collection của Tenant/Auth; chỉ dùng API authz đang có.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/document-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p03-document` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Upload được phép nhận 202 và đúng trạng thái `QUEUED` theo hệ thống hiện tại; anonymous/unauthorized trả 401/403.
2. Cùng idempotency key+cùng bytes không thêm document/job/event; bytes khác trả 409.
3. Lỗi dependency không bị hiểu là PDF `READY`; không tạo side effect trái kỳ vọng trong ca thất bại đã kiểm chứng.
4. Java tests chạy/báo trung thực; P08 được thông báo khi cần cập nhật test fixture.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
cd services/document-service && ./mvnw test (Windows: mvnw.cmd test); npm run sandbox:upload-e2e (chỉ nếu sandbox sẵn và có quyền)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.
