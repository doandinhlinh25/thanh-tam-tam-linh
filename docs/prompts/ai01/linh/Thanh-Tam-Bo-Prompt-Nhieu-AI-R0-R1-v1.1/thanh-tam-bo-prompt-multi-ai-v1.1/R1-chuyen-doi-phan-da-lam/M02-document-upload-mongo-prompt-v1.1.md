# PROMPT M02 / v1.1 — Chuyển lưu trữ metadata của chức năng upload Document đã có sang MongoDB

**Mã:** `M02-document-upload-mongo`  
**Chủ quyền file:** `services/document-service/**`  
**Nhánh gợi ý:** `ai/m02-document-upload-mongo-r1`  
**Điều kiện:** R0 đã ổn định, các dependency của M02 đã được phê duyệt, không tự bắt đầu COOK.

## Phần A — Hợp đồng chung, không được bỏ qua

**Repository:** https://github.com/doandinhlinh25/thanh-tam-tam-linh  
**Baseline khảo sát:** `main` / `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b` (đọc lại HEAD thực tế trước khi làm).  
**Tài liệu đích:** `reference/Thanh-Tam-Tai-Lieu-Tong-Hop-BRD-Kien-Truc-V4.md` (TO-BE, không phải hệ thống đã chạy).  
**Đợt:** R1 — chỉ chuyển đổi thành phần **đã có chức năng hoạt động**, không làm tính năng mới.  
**MẶC ĐỊNH:** `GIAI_DOAN = SCOUT`.

### Quy tắc cứng

1. Xem `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` và code/test thực tế trước khi lập phương án. Báo cáo sự khác nhau giữa AS-IS và V4; không coi bản thiết kế là code tồn tại.
2. **Chỉ làm đúng một stage** mỗi lần nhận lệnh: `SCOUT` (chỉ đọc), `BRAINSTORM` (nếu cần), `PLAN` (DRAFT, không sửa code), `COOK` (chỉ sau khi người giao việc duyệt `Status: APPROVED`), `TEST` (test độc lập), `REVIEW` (read-only). KHÔNG tự chuyển stage.
3. Trên branch/worktree riêng, quyền sở hữu file rõ ràng; bảo toàn file tracked/untracked đang có. Không tự `commit`, `push`, `merge`, `rebase`, `reset`, mở PR hay force-push. Không sửa mã nguồn ngoài whitelist của nhiệm vụ.
4. **Tính năng CHƯA có thì KHÔNG đụng:** ingestion worker; PDF extraction/chunk/embedding; Mongo Vector Search/retrieval; hoàn thiện Chat session/permission/history/feedback; frontend nối backend; payment/notification; Kong public routes mới; OPA allow; analytics mới. Không tạo endpoint/collection thực thi cho backlog.
5. **Không đọc/ghi trực tiếp DB của service khác.** Mỗi service chỉ có MongoDB database + credential của mình. Tenant và Auth trao đổi bằng API; Document chỉ dùng API Tenant để kiểm quyền. S3/MinIO dùng cho PDF; Redis Streams là hạ tầng truyền thông, không phải DB nghiệp vụ dùng chung.
6. Không xử lý dữ liệu sản xuất, chạy migration thật, xóa database/volume, tạo dịch vụ trả phí, chỉnh secret thật hoặc đổi hạ tầng production nếu không có **phê duyệt riêng**. Tuyệt đối không in mật khẩu, JWT, cookies, API keys, URI chứa password trong tài liệu hoặc log.
7. Mọi thay đổi phải giữ tương thích hợp đồng đã triển khai hoặc liệt kê tác động và lập kế hoạch chuyển đổi được phê duyệt. Không "green" test bằng cách bỏ kiểm tra, thay assertion, mock che lỗi; phân biệt PASS, FAIL và NOT RUN.
8. Nếu code thực tế khác prompt, có phụ thuộc service khác hoặc cần làm chức năng mới để hoàn tất: **DỪNG** phần đó, ghi blocker và đề nghị nhiệm vụ mới. Không tự mở rộng phạm vi.

### Định dạng đầu ra bắt buộc

- Mã nhiệm vụ, stage, commit/branch/worktree, người sở hữu và phạm vi file.
- Bảng `AS-IS | Đích V4 | Việc có thể sửa bây giờ | Việc chưa có, đóng băng`.
- Bảng `File | Lý do thay đổi | Hành vi/API phải giữ | Test | Rollback`.
- Bằng chứng kiểm thử với lệnh chính xác; ghi `NOT RUN` nếu không chạy được; diff whitelist và file bị ảnh hưởng.
- Mục `Blockers/Cần chủ dự án duyệt`; tự dừng sau stage hiện tại.

### Cú pháp giao giai đoạn (do chủ dự án chọn)

```text
GIAI_DOAN = SCOUT
# Chỉ khảo sát, không sửa mã nguồn. Dừng ngay sau báo cáo.
```

```text
GIAI_DOAN = PLAN
# Dựa vào SCOUT đã được duyệt; chỉ soạn DRAFT, không sửa code.
```

```text
GIAI_DOAN = COOK
APPROVED_PLAN = docs/plans/YYYY-MM-DD/<ten-task>.md
PLAN_STATUS = APPROVED
# Chỉ triển khai từng thay đổi được phê duyệt; không commit/push/merge.
```

```text
GIAI_DOAN = TEST
# Chạy kiểm thử độc lập; báo bằng chứng.
```

```text
GIAI_DOAN = REVIEW
# Đánh giá diff/tính an toàn; không tự sửa hoặc merge.
```

### Phần B — Nhiệm vụ M02: chuyển **upload PDF hiện hữu** từ JPA/PostgreSQL sang MongoDB

**Đây là chuyển đổi công nghệ của một tính năng ĐÃ CÓ**, không làm thêm tính năng khác. Hiện `services/document-service` Java 21/Spring Boot 3.5, endpoint `POST /api/v1/courses/{courseId}/documents` đã dùng Tenant authz → xác nhận MIME/magic PDF → S3 private → metadata/jobs PostgreSQL → Redis Stream → `202/QUEUED`. Tài liệu V4 yêu cầu `tt_document_db` và database-per-service.

**File chủ quyền:** chỉ `services/document-service/**`, gồm mã Java, `pom.xml`, unit tests và tài liệu/migration nằm bên trong service. Không sửa `infrastructure/sandbox/**`, scripts root, `contracts/**`, `services/tenant-service/**` hoặc `services/chat-service/**`. Thay đổi sandbox giao riêng M03 sau khi M02 được review.

**Chỉ được làm các bước (theo PLAN đã phê duyệt):**
- Lập bảng ánh xạ **hiện trạng**: SQL `documents`, `ingestion_jobs` ↔ collections MongoDB `documents`, `ingestion_jobs` trong database do Document sở hữu. Cần duy trì field/ID/JSON output, status `UPLOADED`/`QUEUED`, key uniqueness và indexed queries của upload hiện tại. `outbox` nếu chưa triển khai là **backlog**, không tự làm.
- Dùng Spring Data MongoDB/MongoDB Java driver để thay adapter JPA hiện có; giữ API/public DTO, Tenant authz cookie + service token, private S3, Redis event và idempotency. Không để Document đọc database Auth/Tenant.
- Index unique tương đương `(tenantId,courseId,uploaderUserId,idempotencyKey)` và `(documentId,documentVersion)` của job; chỉ truy vấn trong `tt_document_db`. Metadata checksum SHA-256 và storage key phải bảo toàn.
- Đặc biệt kiểm tra race khi 2 request cùng key, key khác bytes trả 409, duplicate upload chỉ tạo 1 document/job/event; các cửa sổ lỗi khi ghi S3 thành công nhưng DB/Redis thất bại, retry và cleanup; không thêm trạng thái mới nếu chưa phê duyệt.
- Không đoán "transaction xuyên Mongo-S3-Redis": đây không có transaction phân tán; phải tài liệu hóa chiến lược retry/compensation chỉ cho luồng đã có. Mongo transactions chỉ dùng khi thực sự cần và replica set sẵn.
- Giữ phiên bản mã PostgreSQL có thể rollback trong lịch sử Git; lập **kế hoạch** di trú dữ liệu hiện có (mapping ID, chỉ số, checksum S3, kiểm đếm metadata/jobs và rollback), nhưng **không chạy migration production** hay xóa SQL ngay khi chưa có phép. Nếu thay persistence làm đổi kết quả/hợp đồng, dừng để owner duyệt.
- Viết unit/component tests Mongo cho chỉ những hành vi upload hiện có; nếu chưa có Mongo runtime dùng mock/in-memory có cơ sở, không giả E2E.

**CẤM tuyệt đối:** worker, PDF text extraction, OCR, chunks, embeddings, vector search, retrieval, publish/READY/get/delete document, event mới, upload tài liệu cá nhân, email hoặc tích hợp Chat. Không tự sửa openapi/dto public theo mô hình TO-BE chưa hiện thực.

**Acceptance bắt buộc:**
1. Java build + tests đúng môi trường (ghi NOT RUN nếu thiếu). Upload vẫn 202 với người có quyền, 401/403 khi không có quyền; authorization diễn ra trước đọc file theo hành vi cũ.
2. Retry same key+same hash trả cùng document; khác hash trả 409; index unique bảo vệ concurrent requests.
3. Không sửa S3 object key `tenant/course/document/1.pdf`, Redis Stream name `document-ingestion` hay schema event v1 đang hoạt động.
4. Không có kết nối PostgreSQL runtime trong đường upload mới sau khi **được cutover và nghiệm thu**, nhưng mã migration/rollback không bị xóa bừa; test tích hợp môi trường mới giao M03.
5. Mọi collection Document nằm ở 1 DB chỉ Document credential truy cập; không ghi DB khác; có hướng di trú và rollback nhưng không chạy trên dữ liệu thật.

**Phụ thuộc:** R0 P03 hoàn tất và test baseline được chốt; M01 có thể song song; **M03 phải chạy sau** M02. Việc cắt sang DB mới chỉ được triển khai khi M03 pass và chủ dự án phê duyệt.

## Phần C — Lời nhắc đóng nhiệm vụ

Chỉ hoàn thành một giai đoạn, kết luận có bằng chứng, liệt kê cụ thể phần chưa làm và dừng. Không commit/push/merge.
