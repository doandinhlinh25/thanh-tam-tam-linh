# P03-document — REVIEW — 2026-11-01

## 1. Executive summary

**Decision: REVIEW_CHANGES_REQUIRED** (`REQUEST CHANGES` theo skill review). Diff đúng phạm vi và tất cả 33 Java tests chạy lại đều PASS, nhưng test Redis mới chưa bảo vệ cơ chế chống publish trùng mà task T4 của plan yêu cầu. Vì sandbox E2E không chạy, không có bằng chứng khác xác minh cơ chế này khi thay đổi code sau này. Không phát hiện regression mới trong production Java (P03 không sửa production Java). Không phê duyệt tích hợp từ kết quả này.

## 2. Git provenance và scope

- Worktree: `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p03-document`; branch `Linh-p03-document`; reviewed HEAD `94e8051faf468f17684ee6dc0d13bbd583e57057`. Trước REVIEW, `git status --short --branch` sạch.
- `git merge-base 066baea HEAD` = `066baea8592f6f45e538272b947a3a2473c77305`; các commit sau base: `8ad0b16` (tests/README), `40202f0` (handoff), `6737ecc` (COOK report), `94e8051` (TEST report).
- Actual diff từ base: plan/handoff và ba báo cáo P03; `services/document-service/README.md`; `UploadHttpTest.java`, `HttpCourseAuthorizationGatewayImplTest.java`, `UploadServiceImplTest.java`; hai test mới `RedisIngestionQueueImplTest.java`, `S3DocumentObjectStoreImplTest.java`. Không sửa production Java, `contracts/**`, migration/schema/event, fixture P08 hay service khác.
- Đối chiếu code liên quan: `UploadController`, `UploadRequest`, `UploadCourseAuthorizationInterceptor/Configuration`, `HttpCourseAuthorizationGatewayImpl`, `UploadServiceImpl`, `DocumentsRepository`, `RedisIngestionQueueImpl`, `S3DocumentObjectStoreImpl`, `DocumentErrorHandler` và `DocumentContract`.

## 3. AC1–AC5 và review R1–R6

| AC / phần review | Đánh giá | Bằng chứng và giới hạn |
| --- | --- | --- |
| AC1 / R1 HTTP | **PASS trong phạm vi MockMvc** | `UploadHttpTest` kiểm 202/400/401/403/409/415; 401/403/400/415 xác nhận `never().upload`. 202 dùng mock service trả `QUEUED`; 409 dùng mock service ném exception, nên không tự chứng minh lưu trữ. Controller chỉ nhận `AuthorizedUploader` từ request attribute do interceptor đặt; không lấy tenant/user từ header client. Error handler dùng mã lỗi ổn định, không trả exception kỹ thuật. |
| R2 Tenant authorization | **PASS ở gateway boundary** | Gateway test dùng HTTP server local cho 401/403, explicit denial, thiếu identity, 5xx và timeout; implementation chỉ trả `AuthorizedUploader` khi response thành công, allowed true và identity không trống. Interceptor được đăng ký với upload path và chạy trước controller. Chưa có E2E Tenant thật. |
| AC2 / R3 idempotency | **PASS ở service branch; coverage adapter thiếu** | Service tests kiểm retry `QUEUED` không gọi queue/create, retry `UPLOADED` gửi queue và markQueued, changed bytes 409, concurrent insert dọn object mới. Repository unique `(tenant,course,user,key)` và Redis Lua có đường dedup trong code. Test mới không kiểm thực thi Lua hoặc khóa dedup đầy đủ; xem F1. |
| AC3 / R5 failure | **PASS ở mock boundary** | S3 put lỗi không tạo metadata/queue; DB lỗi cố dọn object; khi cleanup cùng lỗi, lỗi DB gốc giữ suppressed; concurrent cleanup lỗi được ném ra; Redis lỗi ngăn markQueued. S3 adapter ánh xạ lỗi runtime thành 503. Không có kiểm thử DB/S3 thật. |
| R4 Redis adapter | **CHANGES REQUIRED** | Test kiểm stream, event, document ID và hậu tố job ID, nhưng dùng `any(DefaultRedisScript.class)` và không chạy Redis/Lua; xem F1. |
| AC4 scope/evidence | **PASS cho lệnh và scope; E2E NOT RUN** | Surefire 33/33, build/typecheck exit 0, diff check exit 0. Không đổi P08 fixture; Docker/fixture chưa sẵn theo TEST report. |
| AC5 / R6 README | **PASS** | README nói MIME + `%PDF-` chỉ kiểm sơ bộ; không hứa cấu trúc PDF/text layer, `202 QUEUED` không đồng nghĩa READY. Khớp `UploadRequest.hasPdfSignature` và upload flow. |

## 4. Chất lượng regression tests

- HTTP tests có assertion status và chặn gọi business service cho denial/validation; 409 chỉ kiểm mapping lỗi của mock. Không có ca riêng MIME khai sai (415 mới dùng magic sai), nhưng implementation so MIME và magic bytes trực tiếp; thiếu sót này là cải thiện coverage, không thấy bypass.
- Gateway tests kiểm actual HTTP response parsing với server local, không chỉ Mockito; timeout dùng 50 ms client và handler ngủ 3 giây, đã PASS ở lần chạy REVIEW. Có thể chậm/flaky trên CI quá tải nhưng chưa có failure thực tế.
- Service tests kiểm tương tác và thứ tự tác động qua mock. Không kiểm PostgreSQL transaction/unique constraint hoặc Redis/S3 thật; sandbox U1–U7 cần bù trước tích hợp hệ thống.
- Redis test kiểm một số field payload nhưng không kiểm `eventVersion`, `tenantId`, `documentVersion`, `jobId` trong JSON; không kiểm Lua script source/atomicity. `keys[0].endsWith(jobId)` cho phép đổi sai prefix mà test vẫn PASS. Đây là F1.
- S3 test kiểm bucket/key/content type trong `PutObjectRequest`, nhưng `RequestBody` dùng `any(...)`, nên đổi bytes được gửi vẫn có thể PASS. Đây là F2. Test xóa chỉ kiểm đúng bucket/key; test lỗi chỉ kiểm HTTP status, không kiểm error code.
- Không thấy test phụ thuộc thứ tự toàn suite: mỗi test tạo mock/HTTP server mới; `@BeforeEach` reset server state. Không thấy exception bị nuốt trong test; các giới hạn chính là assertion chưa đủ mạnh và thiếu E2E.

## 5. Findings, theo severity

### F1 — MEDIUM — Blocking — Concern: test Redis không bảo vệ dedup/payload đầy đủ

- **Location:** `services/document-service/src/test/java/com/linh/document/services/queue/impl/RedisIngestionQueueImplTest.java:38-44`; implementation `services/document-service/src/main/java/com/linh/document/services/queue/impl/RedisIngestionQueueImpl.java:31-36,64-66`.
- **Finding/evidence:** `verify(redis).execute(any(DefaultRedisScript.class), ...)` chấp nhận script bất kỳ; `assertTrue(keys[0].endsWith(jobId))` chấp nhận prefix sai. Test không chạy Lua hoặc xác nhận số event khi gửi hai lần. Vì vậy nếu script bị đổi thành `XADD` vô điều kiện hoặc key prefix sai, test hiện tại vẫn có thể PASS.
- **Expected/actual:** Expected T4 khóa cơ chế dedup cho event hiện có; actual chỉ xác minh lời gọi mock và một phần key/payload. Tác động: duplicate event trong retry/concurrency có thể lọt qua regression suite. Chưa xác nhận duplicate event xảy ra ở implementation hiện tại; Lua hiện có `EXISTS`/`XADD`/`SET`.
- **Recommendation:** Thêm assertion chính xác cho key/payload và test thực thi Lua trên Redis sandbox cô lập hoặc một phép kiểm tương đương có khả năng fail khi script bỏ dedup. Chạy lại TEST sau COOK. Không đổi kiến trúc/event trong REVIEW.

### F2 — MEDIUM — Non-blocking — Concern: S3 test không kiểm byte nội dung

- **Location:** `services/document-service/src/test/java/com/linh/document/services/storage/impl/S3DocumentObjectStoreImplTest.java:32-35`; implementation `S3DocumentObjectStoreImpl.java:39`.
- **Finding/evidence:** `putObject(request.capture(), any(RequestBody.class))` kiểm metadata, không kiểm `RequestBody` chứa chính `PDF`. Nếu adapter ghi byte khác hoặc rỗng, test vẫn PASS.
- **Expected/actual:** Expected upload lưu đúng PDF; actual test adapter mới chỉ khóa bucket/key/MIME. Tác động: regression byte upload không được suite adapter phát hiện. E2E P08 có kiểm object bytes nhưng chưa chạy ở REVIEW.
- **Recommendation:** Bắt và đọc `RequestBody` bằng test phù hợp, so sánh byte với input; hoặc chạy E2E an toàn kiểm object bytes. Không yêu cầu sửa production Java khi chưa thấy bug.

Không có Critical/High finding mới hoặc regression do P03 tạo. F1/F2 là điểm yếu test mới, không phải bug production đã được tái hiện.

## 6. Lệnh kiểm chứng độc lập

| Command | Result |
| --- | --- |
| Maven 3.9.16 `mvn.cmd -Dmaven.repo.local=C:\Users\User\.m2\repository test -q` tại `services/document-service` | **PASS**, exit 0; 7 Surefire XML: **33 tests, 0 failures, 0 errors, 0 skipped** |
| `npm run build` ở root worktree | **PASS**, exit 0; Node workspaces, không phải Java build |
| `npm run typecheck` ở root worktree | **PASS**, exit 0; Node workspaces |
| `git diff --check` | **PASS**, exit 0 |
| `git diff 066baea8592f6f45e538272b947a3a2473c77305 --check` | **PASS**, exit 0 |
| `npm run sandbox:upload-e2e` | **E2E_NOT_RUN — UNSAFE_OR_UNVERIFIED_SANDBOX**; TEST report xác minh thiếu fixture P08 và Docker daemon không kết nối; REVIEW không chạy với dữ liệu khác |

## 7. Known risks và điều kiện tích hợp

- **Existing known risk / out of scope:** `UploadServiceImpl.enqueueIfRequired` gửi Redis trước `repository.markQueued` (dòng 117–118). Nếu markQueued thất bại sau publish, metadata có thể còn `UPLOADED` khi event đã tồn tại. Mức ảnh hưởng cao; plan P03 cố ý không triển khai outbox/reconciliation. Cần kế hoạch riêng trước khi cam kết độ tin cậy ingestion, không coi đây là regression P03.
- **Existing known risk / out of scope:** `objectStore.remove` có thể thất bại sau lỗi DB hoặc concurrent insert (UploadServiceImpl dòng 88–95), gây object mồ côi. Mức ảnh hưởng trung bình đến cao; cần cleanup/reconciliation riêng và quan sát storage.
- **E2E limit:** Không có bằng chứng live cho PostgreSQL unique constraint, Redis Lua, S3 object bytes và Tenant session qua toàn chuỗi. E2E không bắt buộc để kết luận unit TEST của plan, nhưng **nên chạy U1–U7 trên sandbox cô lập trước tích hợp vào `Linh`**. Nếu không có môi trường, người duyệt tích hợp phải chấp nhận rõ giới hạn này; không công bố upload end-to-end đã được xác minh tại HEAD P03.
- Điều kiện trước khi đề xuất tích hợp: sửa F1 trong COOK được duyệt, chạy lại TEST và REVIEW; xử lý F2 hoặc chạy E2E an toàn kiểm bytes; ghi nhận/chấp thuận rủi ro kiến trúc còn lại và xác nhận không có thay đổi tích hợp ngoài P03.

## 8. Quyết định và bước tiếp

**REVIEW_CHANGES_REQUIRED.** AC1/AC3/AC4/AC5 đạt trong mức bằng chứng hiện có; AC2 service branch hoạt động nhưng regression protection cho Redis dedup của T4 chưa đạt. Trả F1 về COOK trong phạm vi test P03 (không sửa implementation ở REVIEW), sau đó TEST/REVIEW lại. F2 là điều kiện chất lượng nên bổ sung cùng lượt hoặc bù bằng E2E. Không phê duyệt merge/integration; không push, PR hay đổi nhánh `Linh`/`main`.

File thay đổi ở REVIEW: chỉ báo cáo này và mục REVIEW trong handoff P03.
