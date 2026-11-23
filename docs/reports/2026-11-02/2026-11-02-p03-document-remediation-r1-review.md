# P03-document — Remediation R1 REVIEW — 2026-11-02

## Executive summary và quyết định

**REVIEW_APPROVED** cho phạm vi P03 đã được duyệt. F1 Redis dedup và F2 S3 bytes đều đã được xử lý; không thấy blocking finding hoặc regression mới trong diff. Đây là chấp thuận chất lượng của branch P03 để **đề xuất xem xét tích hợp**, không phải phê duyệt merge, deploy hoặc release. Upload E2E U1–U7 vẫn chưa có bằng chứng PASS.

## Git provenance và scope

- Reviewed worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p03-document`, branch `Linh-p03-document`, HEAD `b5ad8867e2720d986c8f5d866aa281e1acd700c3`. Preflight `git status --short --branch` sạch.
- Original base `066baea8592f6f45e538272b947a3a2473c77305`. Branch `Linh` hiện tại ở `a3ae98f` đã tiến lên, nhưng **current merge-base** của `Linh` và P03 vẫn là `066baea8592f6f45e538272b947a3a2473c77305`. Không suy ra P03 đã chứa thay đổi mới của `Linh`.
- Ancestry P03 từ base: `8ad0b16` tests/README/plan, `40202f0` handoff, `6737ecc` COOK report, `94e8051` TEST report, `0848931` REVIEW findings, `fe8d5e3` hai test remediation, `cbb08bd` COOK R1 artifacts, `7172d96` TEST R1 artifacts, `b5ad886` Git gate recovery artifacts. `fe8d5e3` và `7172d96` đều là ancestor của HEAD.
- `git show --name-status fe8d5e3` chỉ có `RedisIngestionQueueImplTest.java` và `S3DocumentObjectStoreImplTest.java`. Các commit sau chỉ sửa handoff/báo cáo. Diff `0848931..HEAD` không có production Java; diff base–HEAD gồm đúng tài liệu P03, Document README và năm file test P03. Không đổi API contract, migration/schema/event, fixture P08 hay service khác.
- `git diff 066baea... HEAD --check`, working `git diff --check` và staged `git diff --cached --check` đều **PASS, exit 0** tại preflight. Git Gate Recovery xóa đúng một dấu cách ở báo cáo COOK cũ, khôi phục file giống HEAD; commit `b5ad886` chỉ có báo cáo TEST và handoff.

## F1 — Redis dedup: F1_RESOLVED

- Production `RedisIngestionQueueImpl.java:31–36,66–67` tạo Lua script với `EXISTS` dedup key, `XADD` vào `document-ingestion`, `SET` key; `enqueue` gửi script bằng `redis.execute`. `IngestionJobIds.forDocument` tạo job ID từ document ID và version. Lua không đổi trong remediation.
- `RedisIngestionQueueImplTest.java:69–89` dùng `StringRedisTemplate`/Lettuce thật với `127.0.0.1` và port từ `P03_REDIS_PORT`, không mock kết quả Lua. Cùng một `Documents`/job ID được enqueue hai lần; UUID mới cho mỗi lượt tránh key cũ. Test đo stream size trước/sau, đòi tăng đúng một event, kiểm dedup key tồn tại và không TTL. Mock test riêng tại dòng 35–56 kiểm chính xác stream, key và các trường payload; Redis failure mapping được kiểm ở dòng 59–66.
- Lua hiện tại cho lần đầu `XADD` rồi `SET`, lần lặp gặp `EXISTS` và trả 0 trước `XADD`. Assertion stream size không kiểm **riêng** ngay sau lần đầu, nhưng có kiểm tổng hai lần. Xem finding L1 về assertion trung gian.
- Không có bằng chứng test tự xác minh instance Redis là cô lập: biến môi trường là cơ chế opt-in, không phải attestation. TEST R1 đã kiểm port trống, Redis tạm `PONG`, chạy suite với `P03_REDIS_PORT=35806`, rồi dừng đúng instance. Thiếu biến làm integration test **skip có chủ đích** qua `assumeTrue` (dòng 71–72), không được tính là dedup PASS; Surefire XML của TEST R1 xác nhận skipped 0. Khi chạy về sau, người vận hành phải xác minh Redis cô lập và đọc skipped count.
- **Negative control phân biệt nguồn:** `COOK_EXECUTED` — COOK R1 tạm bỏ nhánh Lua `EXISTS`, focused test FAIL với `expected <2> but was <3>`, 1 failure/0 error do hai event; sau đó hoàn nguyên. `TEST_EVIDENCE_REVIEWED` — TEST R1 đọc bằng chứng, không tự mutation. `REVIEW_VERIFIED` — review đối chiếu logic Lua, assertion và Git; không tự chạy mutation. Failure này phù hợp duplicate publish, không phải compile, setup hay connection. Diff production từ `0848931` đến HEAD rỗng.
- Kết luận: test **phát hiện mất dedup** trong negative control và đã thực thi Lua trên Redis cô lập ở TEST R1. F1 không còn blocking.

## F2 — S3 bytes: F2_RESOLVED

- `S3DocumentObjectStoreImplTest.java:24–40` dùng payload nhiều byte khác nhau, gồm `0x00` và `0xFF`; bắt `RequestBody` thực được truyền cho mock `S3Client.putObject`, mở stream và dùng `assertArrayEquals(PDF, readAllBytes())`. Sai byte, thiếu byte, sai thứ tự hoặc body rỗng đều làm assertion FAIL. Bucket, key, MIME vẫn được kiểm.
- Production `S3DocumentObjectStoreImpl.java:35–41` dùng `RequestBody.fromBytes(content)`. Test tại dòng 44–65 còn kiểm delete đúng bucket/key và mapping lỗi put/delete thành 503. Không kết nối S3 thật. F2 không còn blocking.

## AC1–AC5 và chất lượng regression tests

| AC plan | Đánh giá | Bằng chứng và giới hạn |
| --- | --- | --- |
| AC1 — HTTP 202/400/401/403/409/415, Tenant | **PASS ở HTTP/gateway boundary** | `UploadHttpTest` 5 cases kiểm status, trusted uploader và không gọi service ở 401/403/400/415. Interceptor được đăng ký cho upload path và lấy identity từ gateway, không từ `X-Tenant-Id` client. Gateway test 7 cases dùng HTTP server nội bộ: missing session/identity, denial, Tenant 401/403/5xx và timeout đều fail closed. 202/409 dùng mock service, chưa phải E2E. |
| AC2 — idempotency/retry/concurrency | **PASS trong phạm vi service + Redis adapter** | `UploadServiceImplTest` kiểm retry `QUEUED` không enqueue/create, retry `UPLOADED` enqueue/markQueued mà không put/create, changed bytes conflict, concurrent insert cleanup. Redis integration và negative control nay bảo vệ duplicate publish. PostgreSQL unique constraint chưa được chạy E2E. |
| AC3 — dependency failure/cleanup | **PASS ở mock/adapter boundary** | Service tests kiểm S3 put lỗi, DB lỗi và cleanup, DB+cleanup lỗi giữ lỗi gốc và suppressed cleanup, Redis lỗi không markQueued; S3/Redis adapter mapping 503. Không khẳng định atomicity đa hệ thống. |
| AC4 — evidence và scope | **PASS** | Surefire XML 34/34, 0 failure/error/skipped; TEST R1 Node build/typecheck PASS; Git checks preflight PASS; chỉ test/README/tài liệu P03 trong diff. E2E tùy điều kiện sandbox theo plan và NOT RUN minh bạch. |
| AC5 — PDF limitations | **PASS** | README nêu MIME + `%PDF-` chỉ kiểm sơ bộ, không chứng minh cấu trúc PDF/text layer; HTTP 202/`QUEUED` không có nghĩa `READY`. Khớp `UploadRequest.hasPdfSignature` và upload flow. |

Các test có isolation cơ bản: HTTP/service dùng mock riêng từng test; Tenant test tạo server port 0, đóng ở `@AfterEach`; Redis dùng UUID ngẫu nhiên và instance riêng trong lượt TEST R1. Timeout gateway dùng thời gian thực 50 ms nên có thể nhạy với máy quá tải, nhưng không có failure thực tế. Mock tests không chứng minh S3/PostgreSQL/Tenant live. Redis test sẽ skip nếu không có biến môi trường, nên không được dùng một Maven run có skipped > 0 để tuyên bố F1 PASS.

## Test evidence và Git integrity

- **EVIDENCE_VERIFIED — NOT REEXECUTED** cho Java, Node và Redis runtime ở lượt REVIEW này. Đọc trực tiếp 7 Surefire XML hiện có: Health 3, Upload HTTP 5, Documents validation 2, Tenant gateway 7, Upload service 11, Redis adapter 3, S3 adapter 3; **34 tests, 34 passed, 0 failures, 0 errors, 0 skipped**. XML có test case `publishesOnlyOneEventForRepeatedDocumentOnIsolatedRedis` và `writesPdfToConfiguredBucketWithPdfMime`, không có skip/failure/error. TEST R1 report ghi focused/full Maven exit 0 với Redis tạm, Node build/typecheck exit 0; COOK R1 report ghi negative control failure đúng hành vi.
- **REEXECUTED_PASS** chỉ cho Git read-only checks tại REVIEW: status sạch, committed diff check, working diff check và staged diff check exit 0. Không chạy Java lại khi Redis tạm đã dừng vì thiếu instance cô lập sẽ làm test F1 skip, không tăng giá trị bằng chứng.
- Không có code/test/config thay đổi từ tested commit `cbb08bd` đến reviewed HEAD `b5ad886`; các commit kế tiếp chỉ là tài liệu TEST và recovery.

## Findings theo severity

Không có CRITICAL, HIGH hoặc MEDIUM finding mới; F1 và F2 đã resolved. Một suggestion không chặn:

### L1 — LOW / Suggestion / Non-blocking — Assert sau lần publish đầu

- **Location:** `services/document-service/src/test/java/com/linh/document/services/queue/impl/RedisIngestionQueueImplTest.java:84–87`.
- **Expected/actual:** Test nên xác nhận stream tăng một event **ngay sau enqueue đầu**, rồi không tăng sau enqueue thứ hai; hiện chỉ assert kích thước sau cả hai lần.
- **Evidence/impact:** Một implementation bất thường không publish lần đầu nhưng publish lần hai vẫn có thể qua assertion tổng. Lua hiện tại và negative control xác nhận đường đi đúng cho lần chạy đã kiểm; đây là khoảng trống nhỏ của regression assertion, không phải bug production hay việc mất bảo vệ dedup đã được tái hiện.
- **Recommendation:** Trong một lượt COOK/test hardening riêng nếu cần, thêm assertion sau enqueue đầu và sau enqueue thứ hai. Không sửa test ở REVIEW.

## Known risks, E2E và khả năng tích hợp

- **KR1 — accepted known risk for P03, follow-up plan needed; impact cao:** `UploadServiceImpl.enqueueIfRequired` publish Redis trước `repository.markQueued` (dòng 117–118). Nếu DB thất bại sau publish, metadata có thể còn `UPLOADED` khi event đã tồn tại. P03 không được duyệt triển khai outbox/reconciliation. Cần kế hoạch nhất quán và recovery trước khi cam kết ingestion đáng tin cậy.
- **KR2 — accepted known risk for P03, follow-up plan needed; impact trung bình đến cao:** S3 cleanup thất bại sau lỗi DB/concurrent insert có thể để orphan object. Test xác minh error propagation, không bảo đảm xóa object thật; cần kế hoạch cleanup/quan sát riêng.
- **E2E_NOT_RUN — UNSAFE_OR_UNVERIFIED_SANDBOX.** Fixture P08 không có trong worktree và PostgreSQL/S3/Tenant sandbox không được xác minh; Redis integration riêng không thay thế upload U1–U7. PLAN P03 ghi E2E tùy môi trường, nên E2E **không phải gate bắt buộc trước tích hợp code/test P03 vào `Linh`**. Có thể đề xuất tích hợp nếu người duyệt tích hợp chấp nhận rõ giới hạn bằng chứng và kiểm tra xung đột với `Linh` hiện tại. REVIEW này không cấp quyền tích hợp.
- **Deployment readiness khác integration readiness:** chưa đủ bằng chứng để công bố upload end-to-end sẵn sàng cho release. Khuyến nghị **chặn deploy/release chức năng upload** cho tới khi U1–U7 PASS trên sandbox cô lập, hoặc có quyết định chấp nhận rủi ro rõ ràng của chủ sở hữu release. Đây là khuyến nghị release, không phải gate bổ sung ngược vào PLAN P03.

## Next action

Chủ dự án có thể giao một lượt **xem xét tích hợp vào `Linh`**; người thực hiện phải đối chiếu branch `Linh` đã tiến lên, kiểm tra xung đột/scope và quyết định riêng về E2E/known risks. Không merge, cherry-pick, push, PR hay deploy trong REVIEW R1. Stage REVIEW chỉ thêm báo cáo này và mục REVIEW R1 trong handoff; không sửa implementation/test.
