# Plan: P03 Document — regression hardening for existing PDF upload

- Task ID: `2026-10-31-p03-document`
- Status: `APPROVED (by chủ dự án, 2026-10-31)`
- Inputs: `docs/reports/2026-10-31/2026-10-31-p03-document-scout.md`, `docs/handoffs/2026-10-31-p03-document.md`, P03 prompt, `AGENTS.md`, `docs/workflow/README.md`, `contracts/openapi/document.v1.yaml`, `contracts/events/document-ingest-requested.v1.schema.json`.
- Baseline: branch `Linh` at `066baea8592f6f45e538272b947a3a2473c77305`. `git log 066baea..HEAD --oneline` rỗng tại lúc lập kế hoạch; không có thay đổi sẵn trong `services/document-service/**`.

## 1. Objective and background

Gia cố bằng chứng hồi quy cho luồng upload PDF đang chạy: kiểm quyền Tenant → MIME/magic bytes → S3 → PostgreSQL → Redis Stream → `202 QUEUED`. SCOUT ghi nhận các nhánh lỗi chưa có test trực tiếp và giới hạn kiểm PDF chưa được nói rõ trong README. Kế hoạch này kiểm chứng hành vi hiện có bằng test và tài liệu. Nếu test tái hiện bug, ghi bằng chứng, dừng phần sửa sản phẩm và trình kế hoạch sửa đổi để được duyệt.

## 2. Scope and non-goals

- Trong phạm vi: test Java cho HTTP, gateway Tenant, upload service, S3/Redis adapter và README của Document Service. Không sửa code sản phẩm trong kế hoạch DRAFT này.
- Ngoài phạm vi: sửa `contracts/**`, script/fixture P08, DB schema, event format, key/scope/path hiện có, MongoDB migration, outbox, worker, PDF parser/text extraction, READY, GET/DELETE/retrieval, Kong, service khác. Không làm thay đổi status 500 của lỗi DB nếu chưa có quyết định API riêng.
- `document-contract-v1.md` và OpenAPI có phần TO-BE; test chỉ bám endpoint hiện có. Không sửa file chung để quảng bá mức hoàn thành.

## 3. Current-state findings

- **Verified:** `UploadController`/`UploadRequest` kiểm trường bắt buộc, MIME và `%PDF-`; `UploadCourseAuthorizationInterceptor` gọi gateway trước khi controller đọc file. `UploadHttpTest` mới thử 401 và 202 với header giả.
- **Verified:** `UploadServiceImpl` tra idempotency theo tenant/course/user, ghi S3 trước khi tạo metadata, gửi Redis trước `markQueued`. `UploadServiceImplTest` có ca retry `QUEUED`, 409 ở service, concurrent insert, lỗi ghi DB và Redis; chưa thử `UPLOADED` retry hoặc lỗi cleanup.
- **Verified:** `HttpCourseAuthorizationGatewayImplTest` có 3 ca (allow, thiếu session, 403); không thử Tenant 401/5xx/timeout/body sai.
- **Verified:** `RedisIngestionQueueImpl` dùng Lua `XADD` + dedup key; `S3DocumentObjectStoreImpl` ánh xạ lỗi runtime thành 503. Không có unit test trực tiếp cho hai adapter.
- **Verified:** Maven Wrapper đã dừng trước Maven với `icm : Cannot index into a null array` ở SCOUT; chưa có kết quả Java test của baseline này. `scripts/sandbox-upload-e2e.mjs` do P08 sở hữu, có U1–U7 nhưng chưa chạy lượt này.
- **Unknown:** khả năng chạy sandbox/fixture tại lượt TEST. Không giả định Docker, Maven cache hoặc dịch vụ thật sẵn sàng.

## 4. Proposed design

Test tại ranh giới đang có, dùng mock cho HTTP/service/S3/Redis và HTTP server nội bộ của gateway. Xác minh status, số lần ghi/queue, scope tenant/user, cùng document ID ở retry, và không có side effect ở lỗi trước khi ghi. Đối với lỗi sau khi một dependency đã ghi, test mô tả trạng thái thực có thể phục hồi (`UPLOADED` khi Redis lỗi); không giả nhận atomicity S3–PostgreSQL–Redis.

README nêu rõ kiểm `%PDF-` chỉ là magic bytes, chưa xác nhận PDF hợp lệ có cấu trúc/text layer và `202 QUEUED` không có nghĩa READY. Giữ nguyên `Idempotency-Key`, scope `COURSE`, S3 key, PostgreSQL schema, Redis event và response. Rủi ro Redis publish trước cập nhật DB được ghi như giới hạn cần thiết kế riêng; không chọn phương án outbox trong R0.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `services/document-service/src/test/java/com/linh/document/controller/UploadHttpTest.java` | Thêm 403/400/415/409, identity header giả và không gọi service ở ca bị từ chối | T1 |
| `services/document-service/src/test/java/com/linh/document/services/authorization/impl/HttpCourseAuthorizationGatewayImplTest.java` | Thêm 401, 5xx, phản hồi JSON sai/deny, timeout có kiểm soát | T2 |
| `services/document-service/src/test/java/com/linh/document/services/business/impl/UploadServiceImplTest.java` | Thêm retry `UPLOADED`, lỗi S3/cleanup/DB/Redis và side-effect assertions | T3 |
| `services/document-service/src/test/java/com/linh/document/services/queue/impl/RedisIngestionQueueImplTest.java` | Test payload, dedup key/stream, lỗi Redis | T4 |
| `services/document-service/src/test/java/com/linh/document/services/storage/impl/S3DocumentObjectStoreImplTest.java` | Test bucket/key, MIME, lỗi put/delete | T4 |
| `services/document-service/README.md` | Nêu giới hạn magic bytes và `QUEUED` | T5 |

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T0 | COOK preflight: kiểm HEAD/status/diff, bảo toàn mọi file sẵn có; dùng branch/worktree riêng nếu tạo được an toàn, không commit | Không sửa file | `git status --short --branch`; `git diff -- services/document-service`; `git log 066baea..HEAD --oneline` | Có baseline rõ ràng, không ghi đè việc người khác | None |
| T1 | Bổ sung HTTP regression cho 401/403/400/415/409/202 và forged identity, khẳng định denied request không gọi service | `UploadHttpTest.java` | `mvnw.cmd -Dtest=UploadHttpTest test` | Các status và side effect đúng contract hiện có | T0 |
| T2 | Bổ sung gateway tests cho 401, 403, Tenant 5xx, body sai/deny, timeout; không ghi cookie/token vào output | `HttpCourseAuthorizationGatewayImplTest.java` | `mvnw.cmd -Dtest=HttpCourseAuthorizationGatewayImplTest test` | Chỉ response allow hợp lệ tạo uploader; lỗi trả 401/403/503 | T0 |
| T3 | Bổ sung service tests cho retry `UPLOADED` sau Redis lỗi, S3 put lỗi, DB lỗi + cleanup, concurrent conflict và cleanup lỗi; nếu test lộ bug, ghi bằng chứng và đề xuất sửa plan | `UploadServiceImplTest.java` | `mvnw.cmd -Dtest=UploadServiceImplTest test` | Không tạo thêm document/job/event ở retry cùng bytes đã QUEUED; khác bytes 409; các lỗi không trả READY/202 giả | T0 |
| T4 | Bổ sung adapter tests cho S3 request/error mapping và Redis payload/stream/dedup/error mapping | Hai test adapter mới | `mvnw.cmd -Dtest=RedisIngestionQueueImplTest,S3DocumentObjectStoreImplTest test` | Contract cũ được khóa bằng test; lỗi dependency ra 503 | T0 |
| T5 | Ghi rõ mức kiểm PDF và trạng thái sau upload trong README; đối chiếu code, không hứa parser hoặc worker | `README.md` | Kiểm README đối chiếu `UploadRequest`, `UploadServiceImpl`, `DocumentContract` | Tài liệu nêu magic bytes và `QUEUED` chính xác | T1, T3 |
| T6 | Kiểm toàn bộ Java test và diff; ghi số test PASS/FAIL/NOT RUN trung thực, handoff và rủi ro còn lại | Chỉ artifact P03 | `mvnw.cmd test`; `git diff --check`; `git diff -- services/document-service` | Không có sửa ngoài whitelist; mọi thay đổi gắn task/AC | T1–T5 |

T1–T4 có thể thực hiện theo thứ tự linh hoạt vì file test riêng, nhưng chỉ một owner P03 để tránh xung đột; T5 sau khi hành vi được test. Không yêu cầu sub-agent hay coordination record.

## 7. Dependencies and prerequisites

- Chủ dự án đã phê duyệt kế hoạch và yêu cầu COOK ngày 2026-10-31. Giữ nguyên phạm vi test/README đã duyệt.
- Khi COOK/TEST, nếu Maven Wrapper còn lỗi, dùng đường chạy Maven hợp lệ đã có sẵn trong môi trường hoặc báo `NOT RUN`; không thay wrapper, cài dependency hay sửa file ngoài whitelist trong P03. Java 21 là yêu cầu từ `pom.xml`.
- Sandbox E2E U1–U7 chỉ chạy khi fixture/sandbox có sẵn, đúng owner và không có tác vụ khác đang dùng; ca U7 tạm dừng Tenant. Phối hợp P08 nếu fixture cần thay; P03 không sửa script/fixture P08.
- Chỉ dùng stage skills `$cook`, `$test`, `$review`; không có specialist frontend áp dụng. Tại COOK kiểm branch/worktree riêng theo prompt, giữ nguyên mọi thay đổi đang có.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 — 202 `QUEUED`, 401/403 đúng và không gọi service khi bị từ chối | `UploadHttpTest` với mock service/gateway; nếu sandbox sẵn U1–U3 | Unit HTTP; E2E tùy môi trường |
| AC2 — retry cùng key+bytes không thêm document/job/event; bytes khác 409 | `UploadServiceImplTest` verify số lần gọi repository/S3/queue; HTTP 409; sandbox U4–U5 nếu sẵn | Unit; E2E tùy môi trường |
| AC3 — lỗi Tenant/S3/Redis/DB không bị hiểu là READY/202 và side effect đúng trạng thái | Gateway/service/adapter tests; sandbox U7 nếu sẵn; kiểm response status và mock interactions | Unit; E2E tùy môi trường |
| AC4 — Java test và phạm vi được báo trung thực; P08 được báo khi cần fixture | `mvnw.cmd test`, Surefire summary nếu chạy được; `git diff --check`, `git status`, diff whitelist; ghi `NOT RUN` nếu lỗi môi trường | Build/test/review |
| AC5 — giới hạn kiểm PDF được mô tả đúng | Đối chiếu README với `UploadRequest.hasPdfSignature` và HTTP 415 test | Manual + unit |

Lệnh Maven chạy trong `services/document-service`; trên Windows dùng `.\mvnw.cmd`. Root npm scripts không phải kiểm thử Java. Không chạy E2E có tác dụng tạm dừng Tenant nếu chưa xác minh sandbox cô lập và không có người dùng khác.

## 9. Risks and mitigations

- Redis publish trước DB `markQueued` vẫn là cửa sổ nhất quán; test xác định hành vi khi lỗi nhưng không giải quyết bằng outbox. Đưa vào báo cáo REVIEW như rủi ro còn lại.
- S3 có thể ghi thành công rồi timeout hoặc cleanup thất bại; không thể hứa không có object mồ côi trong mọi lỗi. Test đúng các nhánh hiện có; nếu cần cơ chế reconciliation/outbox, mở kế hoạch riêng.
- Test mock không chứng minh hệ thống tích hợp; chỉ báo E2E PASS khi thực chạy U1–U7 trong sandbox cô lập.
- Wrapper Maven lỗi trong SCOUT; nếu chưa sửa được bằng môi trường chạy hợp lệ, TEST phải báo PARTIAL/NOT RUN, không giả nhận pass.
- Chỉnh status 500/503 hoặc event/schema có thể làm đổi API; cần phê duyệt kế hoạch mới trước khi sửa.

## 10. Acceptance criteria

- [ ] AC1: Request có quyền trả 202 với `QUEUED`; thiếu cookie/không đủ quyền trả 401/403, không chạm service upload.
- [ ] AC2: Cùng key+bytes tái sử dụng document và không thêm ghi/queue khi đã `QUEUED`; cùng key+bytes khác trả 409.
- [ ] AC3: Tenant/S3/Redis/DB failure và retry `UPLOADED` được kiểm đúng side effect; không trả `READY` hay thành công giả.
- [ ] AC4: Java tests chạy và báo số lượng/kết quả thực, hoặc `NOT RUN` cùng nguyên nhân; diff chỉ trong whitelist; thông báo P08 nếu fixture phải đổi.
- [ ] AC5: README nói rõ MIME + magic bytes không xác nhận cấu trúc/text layer; `202 QUEUED` chưa phải READY.

## 11. Rollback or recovery

- Khi còn chưa triển khai: bỏ đúng artifact DRAFT này nếu chủ dự án yêu cầu; không có runtime change.
- Sau COOK: hoàn nguyên riêng các file P03 đã sửa theo diff được ghi trong handoff, không dùng `git reset`/xóa file của người khác. Test/README là thay đổi không có migration dữ liệu; chạy lại Java tests và báo kết quả thực.

## 12. Completion checklist

- [x] Plan được chủ dự án phê duyệt và handoff ghi quyết định.
- [ ] T0–T6 hoàn tất hoặc deferred có lý do được chủ dự án chấp thuận.
- [ ] AC1–AC5 được `$test` xác minh bằng bằng chứng, không suy từ test code.
- [ ] `$review` ghi quyết định độc lập đối chiếu diff/phạm vi.
- [ ] README cập nhật khi cần; config, schema và contract giữ nguyên.
- [ ] Handoff P03 ghi file thay đổi, test, rủi ro và rollback.
