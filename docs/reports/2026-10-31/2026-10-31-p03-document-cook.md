# P03-document — báo cáo hoàn tất COOK — 2026-10-31

- Trạng thái: **COOK_COMPLETE** trong phạm vi [kế hoạch đã duyệt](../../plans/2026-10-31/p03-document.md); stage TEST và REVIEW chưa thực hiện.
- Branch/worktree: `Linh-p03-document` tại `.worktrees/p03-document`; base `Linh` commit `066baea8592f6f45e538272b947a3a2473c77305`.
- Commit triển khai: `8ad0b16` (`test(document): cover upload failure paths and adapters`); commit handoff: `40202f0` (`docs(document): record P03 cook commit`). Tên `Linh/p03-document` không tạo được vì Git đã có ref `Linh`; nhánh thay thế giữ worktree chính nguyên trạng.

## Kết quả theo kế hoạch

| Task | File | Hành vi cũ | Thay đổi | Test | Tình trạng |
| --- | --- | --- | --- | --- | --- |
| T1 | `services/document-service/src/test/java/com/linh/document/controller/UploadHttpTest.java` | Có ca 401 và 202 | Thêm 400/403/415/409, xác minh request bị từ chối không gọi service | Maven test PASS | Hoàn tất |
| T2 | `services/document-service/src/test/java/com/linh/document/services/authorization/impl/HttpCourseAuthorizationGatewayImplTest.java` | Có allow, thiếu session, 403 | Thêm Tenant 401/5xx, JSON thiếu identity, explicit denial, timeout | Maven test PASS | Hoàn tất |
| T3 | `services/document-service/src/test/java/com/linh/document/services/business/impl/UploadServiceImplTest.java` | Có retry `QUEUED`, 409, một số lỗi | Thêm retry `UPLOADED`, S3 lỗi, DB và cleanup cùng lỗi, cleanup sau concurrent insert lỗi | Maven test PASS | Hoàn tất |
| T4 | `services/document-service/src/test/java/com/linh/document/services/queue/impl/RedisIngestionQueueImplTest.java`; `.../storage/impl/S3DocumentObjectStoreImplTest.java` | Chưa có test adapter trực tiếp | Kiểm event/stream/dedup key, S3 bucket/key/MIME và lỗi 503 | Maven test PASS | Hoàn tất |
| T5 | `services/document-service/README.md` | Chưa nêu rõ giới hạn kiểm PDF | Nêu MIME + `%PDF-` không xác nhận cấu trúc/text layer; 202 `QUEUED` chưa phải READY | Đối chiếu mã nguồn | Hoàn tất |
| T0/T6 | Plan, scout report và handoff P03 | Chưa có artifact P03 trong nhánh | Ghi approval, preflight, kết quả và rollback | Git diff check PASS | Hoàn tất |

Không sửa code sản phẩm, API contract, migration, schema, event, service khác hoặc fixture P08. Vì fixture không đổi, không có yêu cầu cập nhật P08 trong lượt này.

## Kiểm thử thực chạy

- Java: Maven 3.9.16 có sẵn, chạy `mvn.cmd -Dmaven.repo.local=C:\Users\User\.m2\repository test -q` trong `services/document-service`: **PASS 33/33**, 0 failure, 0 error (7 Surefire XML). Maven Wrapper `.\mvnw.cmd` vẫn lỗi trước khi Maven khởi động; dùng bản Maven đã cài sẵn để xác minh.
- `npm run build`: **PASS** cho Node workspaces. `npm run typecheck`: **PASS** cho Node workspaces; hai lệnh này không kiểm Java.
- `git diff --check` và `git diff 066baea --check`: **PASS**. Sau commit, `git status --short --branch` chỉ còn tên nhánh, không có thay đổi trong worktree P03.
- `npm run sandbox:upload-e2e` U1–U7: **NOT RUN** vì chưa xác minh sandbox cô lập và fixture P08; không suy diễn kết quả E2E từ unit tests.

## Acceptance criteria và rủi ro

- **AC1–AC3:** Có unit regression và Java test PASS cho 202/401/403, idempotency 409/retry, lỗi Tenant/S3/Redis/DB. Đây là bằng chứng ở mức unit/HTTP mock; stage TEST cần đối chiếu độc lập và E2E nếu sandbox sẵn.
- **AC4:** Kết quả Java và phạm vi diff được ghi trung thực; không có thay đổi ngoài P03 trong commit.
- **AC5:** README đã mô tả đúng giới hạn kiểm PDF và trạng thái `QUEUED`.
- Còn lại: Redis publish trước PostgreSQL `markQueued` có cửa sổ nhất quán; cleanup S3 có thể thất bại và để object mồ côi. Cần kế hoạch riêng nếu muốn thay đổi kiến trúc hoặc cơ chế reconciliation.

## Bàn giao

- Rollback: hoàn nguyên đúng các file test/README P03 trên nhánh riêng; không dùng reset/stash/xóa thay đổi của worktree chính.
- Bước tiếp theo: thực hiện stage **TEST**, sau đó **REVIEW** theo các lượt riêng của workflow.
