# P03-document — TEST — 2026-10-31

## 1. Provenance và phạm vi

- Trạng thái: **TEST_PASS** theo AC1–AC5 của plan P03; sandbox E2E là tùy điều kiện và **không chạy**. Có thể bàn giao để chủ dự án quyết định stage REVIEW ở lượt riêng.
- Worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p03-document`, branch `Linh-p03-document`, HEAD `6737eccd58a89884ee1f1c94b076dfe934e11ab1`. `git merge-base Linh HEAD` = `066baea8592f6f45e538272b947a3a2473c77305`. `git log 066baea..HEAD` đúng ba commit `8ad0b16`, `40202f0`, `6737ecc`. `git status --short --branch` sạch trước TEST.
- Đã đọc plan APPROVED, handoff, Cook report, actual diff `066baea..HEAD`, source upload/authz/queue/storage và test. Stage TEST không sửa source hoặc test.
- `git diff 066baea --name-status` chỉ có 4 artifact P03 (plan, scout, cook, handoff), README Document, 3 test cũ được bổ sung và 2 test adapter mới. Không đổi production Java, `contracts/**`, migration/schema/event, service khác hoặc fixture P08.

## 2. Đối chiếu acceptance criteria

| AC | Kết luận | Bằng chứng và giới hạn |
| --- | --- | --- |
| AC1 — 202 `QUEUED`; 401/403 và chặn trước business service | **PASS** | `UploadHttpTest` 5/5: 202 với `QUEUED`, 401, 403, 400, 415, 409; denied/invalid request kiểm `never().upload`. `HttpCourseAuthorizationGatewayImplTest` 7/7: Tenant 401/403, explicit denial, thiếu identity, 5xx và timeout. `UploadCourseAuthorizationConfiguration` đăng ký interceptor cho upload path; interceptor gọi `authorize` trước controller. HTTP test dùng mock gateway/service, chưa chứng minh live Tenant. |
| AC2 — idempotency cùng key+bytes và 409 khác bytes | **PASS** | `UploadServiceImplTest` 11/11: retry `QUEUED` không gọi `createIfAbsent`/queue; retry `UPLOADED` gửi queue rồi `markQueued`, không ghi S3 lần nữa; changed bytes ném conflict; concurrent insert dọn object mới và dùng record cũ. `UploadHttpTest` kiểm HTTP 409. Không có DB/Redis thật trong các unit tests; job/event count chỉ được suy qua đường gọi adapter/repository, E2E chưa chạy. |
| AC3 — lỗi phụ thuộc và side effect | **PASS** | Unit tests kiểm S3 put lỗi ngăn metadata/queue; DB ghi lỗi cố cleanup; DB+cleanup cùng lỗi giữ lỗi gốc và suppressed cleanup; concurrent cleanup lỗi được surfacing; Redis lỗi không gọi `markQueued`; Tenant 5xx/timeout/body thiếu identity trả 503. `S3DocumentObjectStoreImplTest` 3/3 và `RedisIngestionQueueImplTest` 2/2 kiểm ánh xạ lỗi 503. Không có lời hứa atomic S3–DB–Redis; rủi ro còn lại ở mục 6. |
| AC4 — test evidence, scope và P08 | **PASS** | Maven test 33/33, 0 failure, 0 error, 0 skipped từ 7 Surefire XML; `npm run build`, `npm run typecheck`, `git diff 066baea --check` exit 0. Diff chỉ file P03; không sửa fixture P08 nên không có cập nhật cần gửi. Sandbox U1–U7 **NOT RUN** theo điều kiện của plan. |
| AC5 — giới hạn PDF và `QUEUED` | **PASS** | README nói MIME + `%PDF-` chỉ là kiểm sơ bộ; `UploadRequest.hasPdfSignature` thực tế so MIME, filename và 5 magic bytes; không parse cấu trúc/text. `UploadController` trả 202, `UploadServiceImpl`/`DocumentsRepository` chỉ đánh dấu `QUEUED`; không có đường READY trong upload. |

## 3. Lệnh đã chạy và kết quả

| Lệnh/kiểm tra | Kết quả |
| --- | --- |
| `git status --short --branch`, `git branch -vv`, `git log -5 --oneline`, `git worktree list`, `git merge-base Linh HEAD`, `git diff 066baea --name-status` | PASS; provenance như mục 1 |
| Maven 3.9.16 `mvn.cmd -Dmaven.repo.local=C:\Users\User\.m2\repository test -q` trong `services/document-service` | **PASS**, exit 0; dùng binary Maven đã có vì wrapper của repo lỗi trước Maven ở SCOUT/COOK |
| `npm run build` tại root worktree | **PASS**, exit 0; chỉ Node workspaces |
| `npm run typecheck` tại root worktree | **PASS**, exit 0; chỉ Node workspaces |
| `git diff 066baea --check` | **PASS**, exit 0 |
| `docker info --format '{{.ServerVersion}}'` | **FAIL (môi trường)**: không có Docker daemon trên pipe; không phải regression P03 |
| `Test-Path .test-data/document-upload-fixture.json` | `False`; không đọc nội dung secret/fixture |
| `npm run sandbox:upload-e2e` | **E2E_NOT_RUN — UNSAFE_OR_UNVERIFIED_SANDBOX**: thiếu fixture trong worktree, Docker daemon không kết nối; ca U7 dừng/khởi động Tenant nên không tự tạo hoặc tác động dữ liệu dùng chung |

## 4. Surefire XML và mức kiểm thử

| Suite | Tests | Failures | Errors | Skipped |
| --- | ---: | ---: | ---: | ---: |
| `HealthControllerTest` | 3 | 0 | 0 | 0 |
| `UploadHttpTest` | 5 | 0 | 0 | 0 |
| `DocumentsValidationTest` | 2 | 0 | 0 | 0 |
| `HttpCourseAuthorizationGatewayImplTest` | 7 | 0 | 0 | 0 |
| `UploadServiceImplTest` | 11 | 0 | 0 | 0 |
| `RedisIngestionQueueImplTest` | 2 | 0 | 0 | 0 |
| `S3DocumentObjectStoreImplTest` | 3 | 0 | 0 | 0 |
| **Tổng** | **33** | **0** | **0** | **0** |

- Unit/HTTP mock: 5 upload HTTP tests dùng MockMvc standalone và mocked gateway/service; 11 service tests dùng repository/S3/Redis mocks; 2 Redis adapter và 3 S3 adapter tests dùng client mocks.
- HTTP integration hẹp: 7 gateway tests dùng HTTP server local để kiểm status/body/timeout thật ở ranh giới HTTP, không dùng Tenant Service thực.
- PostgreSQL/Redis/S3/Tenant end-to-end: **NOT RUN**. Các test mock không xác minh DB unique constraint, Redis Lua atomicity hoặc S3 object bytes với service thật.

## 5. Chất lượng regression tests và phát hiện

- **Không phát hiện regression trong phạm vi đã chạy.** Không có test fail để tái hiện bug mới.
- Assertion có giá trị hành vi: HTTP kiểm status/error và `never().upload`; service kiểm các side effect; S3 kiểm bucket/key/MIME trong request và 503; Redis bắt key/stream/payload và 503. Giới hạn: Redis test không thực thi Lua nên dedup nguyên tử chưa được đo; `UploadHttpTest` 202 dùng mock service trả `QUEUED`; không có live E2E. HTTP 415 mới kiểm magic bytes sai, chưa có ca MIME sai riêng. Đây là khoảng trống coverage, không phải bằng chứng chức năng sai.
- `UploadServiceImpl.enqueueIfRequired` gọi Redis trước `repository.markQueued`: **rủi ro cao** nếu publish đã thành công nhưng cập nhật PostgreSQL thất bại; consumer có thể gặp `UPLOADED`, và Redis dedup đã được đặt. Cần kế hoạch riêng để thiết kế consistency/recovery, không sửa ở TEST.
- `objectStore.remove` có thể thất bại sau DB lỗi hoặc concurrent insert: **rủi ro trung bình đến cao** về object mồ côi và chi phí/lưu trữ. Unit test chỉ chứng minh lỗi được surfacing/suppressed, không dọn được object thật; cần kế hoạch reconciliation/cleanup riêng nếu muốn khắc phục.

## 6. Kết luận và file thay đổi

- **TEST_PASS** cho phạm vi bắt buộc của plan P03: AC1–AC5 có bằng chứng test/source; E2E không phải gate bắt buộc trong plan và không được coi là PASS. Sẵn sàng để chủ dự án giao **REVIEW** ở lượt riêng; trước tích hợp hoặc tuyên bố end-to-end, cần sandbox an toàn với Docker/fixture rồi chạy U1–U7.
- File stage TEST: chỉ `docs/reports/2026-10-31/2026-10-31-p03-document-test.md` và mục TEST trong `docs/handoffs/2026-10-31-p03-document.md`. Không sửa code/test/README trong stage này.
