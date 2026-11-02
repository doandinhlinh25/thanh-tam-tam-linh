# P03-document — Remediation R1 TEST — 2026-11-02

## Executive summary

**TEST_BLOCKED.** F1 Redis dedup và F2 S3 payload bytes đã được xác minh độc lập; full Java suite đạt 34/34, Node build/typecheck đạt. Gate bắt buộc `git diff --check` không đạt vì một thay đổi khoảng trắng có sẵn trong báo cáo COOK cũ, ngoài phạm vi TEST. Không sửa hoặc commit thay đổi đó. Chưa đủ điều kiện kết luận `TEST_PASS` hay chuyển REVIEW R1.

## Provenance và phạm vi

- Worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p03-document`, branch `Linh-p03-document`, tested HEAD `cbb08bd475a0c660742f0d672de18342bd1fd7d9`.
- Merge-base `Linh`–HEAD là `066baea8592f6f45e538272b947a3a2473c77305`. Remediation tests commit `fe8d5e3` chỉ sửa hai file test Redis và S3; `cbb08bd` chỉ thêm báo cáo COOK R1 và handoff. `0848931` là review commit trước đó.
- Preflight worktree **không sạch**: `docs/reports/2026-10-31/2026-10-31-p03-document-cook.md` có một dòng trống đổi thành dòng chứa một khoảng trắng (dòng 6), chưa commit. Đây là thay đổi có sẵn trước TEST R1, không thuộc hai file remediation; được giữ nguyên.
- Đã đọc `AGENTS.md`, workflow, skill `test`, plan APPROVED, handoff, COOK/TEST/REVIEW reports và báo cáo COOK R1. Stage TEST không sửa production code, Lua hoặc test.

## Redis cô lập và F1

- Redis 8.0.5 binary đã giải nén trong Ubuntu WSL tại `/p03redis`; không cài service hệ thống. Chọn ngẫu nhiên port **35806**, xác minh chưa có listener trên Windows và Redis CLI không kết nối được trước khi khởi động. Khởi động instance riêng với `--bind 127.0.0.1 --port 35806 --save "" --appendonly no --daemonize yes`, pid/log riêng trong `/p03redis`; Redis CLI trả `PONG`, Windows `Test-NetConnection 127.0.0.1:35806` trả `True`. Thiết lập `P03_REDIS_PORT=35806` cho Maven. Sau test, gửi `shutdown nosave` đúng port này; không đụng Redis khác.
- Test `publishesOnlyOneEventForRepeatedDocumentOnIsolatedRedis` **đã chạy độc lập** trên Redis thật, focused Maven exit 0. Full suite XML ghi Redis suite 3 tests, 0 failure, 0 error, **0 skipped**. Test dùng cùng `Documents`/job ID cho hai lần enqueue, UUID mới cho mỗi lượt, đo stream size trước/sau và assert tăng đúng một event, dedup key tồn tại và không có TTL. Test gọi adapter thật qua `StringRedisTemplate`/Lettuce; không mock kết quả Lua. Redis ban đầu có hay không có stream đều không làm sai delta assertion.
- Lua production hiện tại kiểm `EXISTS KEYS[1]`, sau đó `XADD` và `SET` trong cùng script. `git diff 0848931 HEAD -- services/document-service/src/main/java` và working-tree production diff đều rỗng; remediation không đưa mutation vào production commit.
- **Negative control: evidence reviewed, không tự tái chạy mutation trong TEST.** Báo cáo COOK R1 ghi tạm bỏ nhánh `EXISTS`, focused test chạy trên Redis cô lập và FAIL ở assertion stream size (`expected <2> but was <3>`, `RedisIngestionQueueImplTest.java:82`), 1 failure, 0 error. Đây là lỗi duplicate event chứ không phải compilation/connection. Sau đó COOK đã hoàn nguyên Lua và chạy suite 34/34. TEST đối chiếu test, Lua hiện tại, report và Git; không gọi đây là mutation do TEST tự thực hiện.

## F2 S3 payload bytes

`S3DocumentObjectStoreImplTest.writesPdfToConfiguredBucketWithPdfMime` bắt `RequestBody` thực truyền vào `S3Client.putObject`, mở `contentStreamProvider().newStream()` rồi dùng `assertArrayEquals(PDF, payload.readAllBytes())`. Input có bytes khác nhau, gồm `0x00` và `0xFF`; assertion phát hiện rỗng, cắt, thay byte và sai thứ tự. Bucket/key/MIME vẫn được assert. S3 suite **3/3 PASS**, không kết nối S3 thật. Implementation dùng `RequestBody.fromBytes(content)`; không có test E2E cho S3 thật.

## Acceptance criteria R1

| AC | Kết quả | Bằng chứng |
| --- | --- | --- |
| R1-AC1 — Redis thật, dedup, không skip | **PASS** | Redis tạm port 35806 `PONG`; focused test exit 0; XML Redis 3/3, skipped 0; stream delta assertion bằng 1. |
| R1-AC2 — negative control | **PASS (evidence reviewed)** | COOK R1 ghi mutation bỏ `EXISTS` làm stream tăng 2 và assertion FAIL `expected 2 / actual 3`; TEST kiểm Lua đã hoàn nguyên và production diff rỗng. Mutation không được TEST chạy lại. |
| R1-AC3 — S3 bytes | **PASS** | RequestBody captor + toàn bộ byte `assertArrayEquals`; S3 suite 3/3. |
| R1-AC4 — Java/Node/Git | **BLOCKED** | Java 34/34 và Node build/typecheck exit 0; `git diff 066baea..HEAD --check` exit 0; **`git diff --check` exit 2** vì thay đổi khoảng trắng có sẵn trong COOK report. |
| R1-AC5 — scope/evidence | **PASS với giới hạn preflight** | Remediation commit chỉ hai test; không đổi production Java/API/schema/fixture P08; báo cáo này ghi thay đổi ngoài TEST và không commit nó. |

## Lệnh thực chạy và Surefire

| Lệnh/kiểm tra | Kết quả |
| --- | --- |
| `git status --short --branch`, `git rev-parse HEAD`, `git branch --show-current`, `git merge-base Linh HEAD`, `git log --oneline -10`, `git worktree list`, `git diff 066baea HEAD --stat` | Provenance đúng, nhưng worktree có một file báo cáo COOK cũ modified trước TEST. Dùng `git -c safe.directory=<P03 worktree>` vì Windows sandbox account khác owner worktree; không đổi global Git config. |
| `P03_REDIS_PORT=35806` + Maven 3.9.16 `-Dmaven.repo.local=C:\Users\User\.m2\repository -Dtest=RedisIngestionQueueImplTest#publishesOnlyOneEventForRepeatedDocumentOnIsolatedRedis test -q` | **PASS**, exit 0; Redis thật. |
| `P03_REDIS_PORT=35806` + Maven 3.9.16 `-Dmaven.repo.local=C:\Users\User\.m2\repository test -q` trong `services/document-service` | **PASS**, exit 0. |
| `npm run build` | **PASS**, exit 0; Node workspaces. |
| `npm run typecheck` | **PASS**, exit 0; Node workspaces. |
| `git diff --check` | **FAIL**, exit 2; `docs/reports/2026-10-31/2026-10-31-p03-document-cook.md:6: trailing whitespace` trong thay đổi có sẵn. |
| `git diff 066baea8592f6f45e538272b947a3a2473c77305 HEAD --check` | **PASS**, exit 0; committed P03 history. |
| `npm run sandbox:upload-e2e` | **NOT RUN**. |

Surefire XML sau full run: Health 3, Upload HTTP 5, Documents validation 2, Tenant gateway 7, Upload service 11, Redis adapter 3, S3 adapter 3. **Tổng 34 tests, 34 passed, 0 failures, 0 errors, 0 skipped.** Redis integration testcase xuất hiện trong XML và không có `<skipped>`/`<failure>`/`<error>`.

## Findings, coverage và bước tiếp

- **New finding / environment gate:** thay đổi khoảng trắng có sẵn ở COOK report làm `git diff --check` fail. Expected: worktree preflight sạch và Git check exit 0. Actual: file ngoài TEST modified, check exit 2. Không phải regression của `fe8d5e3`; cần chủ sở hữu thay đổi đó xử lý hoặc xác nhận cách bàn giao riêng, rồi chạy lại `git diff --check` trước khi kết luận TEST_PASS.
- **E2E_NOT_RUN — UNSAFE_OR_UNVERIFIED_SANDBOX:** fixture `.test-data/document-upload-fixture.json` không có trong worktree; Docker/PostgreSQL/S3/Tenant sandbox chưa được xác minh ở lượt TEST R1. Redis integration PASS chỉ chứng minh Lua/adapter trên Redis tạm, không chứng minh upload U1–U7. E2E là tùy điều kiện trong plan P03, không phải nguyên nhân TEST_BLOCKED lần này.
- **Known risk KR1 (cao, có sẵn):** Redis publish thành công trước PostgreSQL `markQueued` có thể để trạng thái không nhất quán. **KR2 (trung bình đến cao, có sẵn):** S3 cleanup thất bại có thể để orphan object. Cần kế hoạch kiến trúc/cleanup riêng; remediation R1 không sửa production.
- Không thấy finding chức năng/bảo mật mới trong test đã chạy. Độ tin cậy regression F1 tăng vì Lua thực thi trên Redis thật và mutation evidence cho thấy assertion bắt duplicate event; F2 kiểm đúng bytes qua request body. Giới hạn: không tái chạy negative control ở TEST và chưa có upload E2E.
- **Quyết định:** dừng ở TEST R1. Sau khi xử lý thay đổi có sẵn và `git diff --check` PASS, có thể kiểm tra lại gate và cân nhắc REVIEW R1 theo yêu cầu riêng của chủ dự án. Chưa đề xuất integration/merge.
- File stage TEST: báo cáo này và mục TEST R1 trong `docs/handoffs/2026-10-31-p03-document.md`. File COOK report modified có sẵn được giữ nguyên, không thuộc commit TEST.
