# P03-document — Remediation R1 COOK — 2026-11-02

## 1. Kết luận và provenance

- **Status: COOK_COMPLETE** trong phạm vi F1/F2 đã được chủ dự án phê duyệt. Dừng ở COOK; TEST và REVIEW lại cần lượt riêng.
- Worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p03-document`; branch `Linh-p03-document`. Preflight ngày 2026-11-01: worktree sạch, HEAD `0848931d0f6a042fe72310aca3d334ec4f7fc6d9`, merge-base với `Linh` là `066baea8592f6f45e538272b947a3a2473c77305`; review commit `0848931` có mặt. Đã đọc plan APPROVED, handoff, COOK/TEST/REVIEW reports và skill `cook`.
- Commit hai file test remediation: `fe8d5e3` (`test(document): verify Redis dedup and S3 payload bytes`). Không đổi production Java, API, migration, schema, event, fixture P08 hoặc service khác.

## 2. F1 — Redis dedup

- Production Lua ở `RedisIngestionQueueImpl` giữ nguyên: kiểm `EXISTS` dedup key; nếu đã có trả 0; nếu chưa có `XADD` event rồi `SET` key, trả 1. Key là `document-ingestion:published:` + job ID; không đặt TTL (`getExpire = -1`). Lần gọi lại cùng document/version không thêm event.
- `RedisIngestionQueueImplTest` giờ kiểm chính xác dedup key và các field event (`event`, `eventVersion`, `jobId`, `tenantId`, `documentId`, `documentVersion`, `occurredAt`). Test mới có điều kiện `P03_REDIS_PORT`: kết nối Redis cô lập, gửi cùng record hai lần, assert stream tăng đúng **1** event, key tồn tại và không có TTL. UUID riêng cho mỗi lượt tránh trùng key cũ. Khi biến môi trường không có, chỉ test integration này được skip; hai unit adapter tests vẫn chạy.
- Redis cô lập: Redis 8.0.5 binary được giải nén tạm trong Ubuntu WSL, bind `127.0.0.1:28379`, `--save ""`, `--appendonly no`; không dùng Redis của sandbox P08, production hoặc dữ liệu chia sẻ. Không thêm Maven dependency, không cài service hệ thống. Redis tạm đã dừng sau test.
- **Negative control:** tạm bỏ đúng dòng `if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end` khỏi production Lua trong worktree; chạy `mvn.cmd -Dmaven.repo.local=C:\Users\User\.m2\repository -Dtest=RedisIngestionQueueImplTest#publishesOnlyOneEventForRepeatedDocumentOnIsolatedRedis test -q` với `P03_REDIS_PORT=28379`. Kết quả **FAIL đúng hành vi**: 1 test, 1 failure, 0 error; assertion stream count `expected <2> but was <3>` tại `RedisIngestionQueueImplTest.java:82`, nghĩa là hai lần enqueue thêm hai event thay vì một. Không lỗi setup/compile/môi trường.
- Hoàn nguyên dòng Lua bằng patch, không reset/stash. `git diff -- services/document-service/src/main/java` rỗng. Chạy lại full suite với Redis thật: **PASS** (mục 4). Mutation và package tạm không nằm trong commit.

## 3. F2 — S3 payload bytes

- `S3DocumentObjectStoreImplTest` bắt `RequestBody` thực truyền cho mock `S3Client`, đọc stream và `assertArrayEquals` với mảng input gồm byte thường, `0x00`, `0xFF` và các byte khác nhau. Assertion này sẽ fail nếu body rỗng, bị cắt, thay byte hoặc đổi thứ tự. Các kiểm bucket/key/MIME và lỗi 503 cũ được giữ nguyên. Không kết nối S3 thật hoặc dùng credentials.

## 4. Lệnh và kết quả thực

| Kiểm tra | Kết quả |
| --- | --- |
| Adapter tests với Redis tạm, trước mutation | **PASS**, exit 0 |
| Negative control bỏ Redis `EXISTS` | **FAIL như mong đợi**, 1 failure do duplicate event; 0 error |
| Full Java suite sau hoàn nguyên và sau assertion cuối, `P03_REDIS_PORT=28379` + Maven 3.9.16 `test -q` | **PASS**, exit 0; Surefire XML: 7 suites, **34 tests, 34 passed, 0 failed, 0 errors, 0 skipped** |
| `npm run build` | **PASS**, exit 0; Node workspaces |
| `npm run typecheck` | **PASS**, exit 0; Node workspaces |
| `git diff --check`; `git diff 066baea8592f6f45e538272b947a3a2473c77305 --check` | **PASS**, exit 0; chỉ cảnh báo chuyển LF/CRLF trên Windows |
| `git diff -- services/document-service/src/main/java` | Rỗng; production code đã hoàn nguyên |
| `npm run sandbox:upload-e2e` | **E2E_NOT_RUN — UNSAFE_OR_UNVERIFIED_SANDBOX**: Docker daemon/fixture P08 chưa xác minh; test Redis riêng không thay thế upload E2E |

Surefire theo suite: Health 3, Upload HTTP 5, Entity 2, Tenant gateway 7, Upload service 11, Redis adapter 3, S3 adapter 3; tổng 34. Lần chạy full suite bị gián đoạn khi phiên công cụ đổi nhưng XML có 34 PASS; sau đó đã chạy lại đầy đủ, exit 0 và XML 34/34 PASS.

## 5. Scope, rủi ro và bàn giao

- File thay đổi: `services/document-service/src/test/java/com/linh/document/services/queue/impl/RedisIngestionQueueImplTest.java` (F1), `services/document-service/src/test/java/com/linh/document/services/storage/impl/S3DocumentObjectStoreImplTest.java` (F2), báo cáo này và mục remediation trong handoff P03. Gói `.deb` tạm trong worktree đã xóa; Redis tạm đã dừng.
- R1-AC1–AC5: F1 có execution test và negative control; F2 kiểm bytes chính xác; full Java suite/build/typecheck PASS; scope chỉ test/tài liệu; bằng chứng có trong báo cáo. Test Redis thật cần `P03_REDIS_PORT` và instance cô lập; không được gọi suite mặc định thiếu biến là bằng chứng Redis integration PASS.
- Rủi ro cũ chưa xử lý: Redis publish trước PostgreSQL `markQueued`, S3 orphan khi cleanup lỗi. Cần kế hoạch kiến trúc/reconciliation riêng. Upload E2E P08 vẫn chưa chạy ở R1.
- Rollback: hoàn nguyên riêng commit `fe8d5e3` và báo cáo/handoff R1 nếu chủ dự án yêu cầu; không sửa branch `Linh`, không xóa dữ liệu/người dùng khác. Không merge/push/PR.
- Bàn giao cho stage **TEST R1** độc lập để kiểm chứng negative control, 34 tests và scope; sau đó REVIEW R1 ở lượt riêng.
