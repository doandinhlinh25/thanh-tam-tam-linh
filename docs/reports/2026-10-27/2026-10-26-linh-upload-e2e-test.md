# Test — Document upload E2E sau khi dựng sandbox

- Ngày kiểm tra: 2026-10-27
- Trạng thái: **PASS** cho phạm vi kế hoạch `docs/plans/2026-10-27/upload-e2e-after-sandbox.md`
- Nhánh/HEAD: `Linh` / `d8f9270` cộng diff chưa commit; không push hoặc merge
- Môi trường: Windows, Docker Engine 29.3.1, Node 26.1.0, Java 21; Compose project `saas-auth-tenant-document-test`
- Phạm vi: gọi trực tiếp Document qua localhost và Tenant/Auth trong sandbox; không có public gateway hoặc worker ingestion

## Lệnh và kết quả

| Lệnh | Kết quả | Bằng chứng |
| --- | --- | --- |
| `npm ci` | PASS | Cài 211 package; npm báo 2 high severity advisories trong dependency hiện có, chưa sửa trong phạm vi này. |
| `node --test test/sandbox-config.test.js` | PASS | 4/4, gồm kiểm tra `mongosh --nodb` và mạng/cổng. |
| `npm run sandbox:init` | PASS | Tạo `.env` riêng được Git bỏ qua; không in secret. |
| `npm run sandbox:check` | PASS | Docker Compose config hợp lệ. |
| `npm run sandbox:up` | PASS sau hai lỗi được sửa | Lượt đầu dừng ở `s3-init` vì shell script CRLF; lượt tiếp theo healthy trong container nhưng không publish cổng host do chỉ có mạng internal. Sau sửa line ending và mạng access riêng, Auth/Tenant/Document đều ready trên `127.0.0.1`. |
| `npm run sandbox:fixtures` | PASS | Tạo course `6ae0d4ca8ce31652f327b84f` trong tenant `6ae0d4ca8ce31652f327b832`; lecturer profile/course/authorization 200, student profile/course 200 và upload authorization 403. Token/cookie chỉ ở `.test-data/`. |
| `npm run sandbox:smoke` | PASS | Login, service token, ACL, upload/retry, PostgreSQL, Redis, private S3; chạy lại sau các sửa đổi vẫn PASS. |
| `npm run sandbox:upload-e2e` | PASS | U1–U7 đạt ở run `58f39f1f`, `041b2528` và `9816b458` trên cùng fixture. |
| `npm run build` và `npm run typecheck` | PASS | Tất cả Node workspaces được hai lệnh này bao phủ. |
| `npm test` | PASS | 8 test root, 2 test `common`, 1 test `http`, 11 test platform Auth/Tenant; tổng 22 test. |
| `.\\mvnw.cmd test` trong `services/document-service` | PASS | 17 test Java, không fail/error/skip. |
| `node --check` cho hai script sandbox và `git diff --check` | PASS | Không có lỗi cú pháp hoặc whitespace trong diff tracked. |

## Ma trận U1–U7

Các số liệu được đối chiếu theo tenant/course fixture và mốc trước–sau của mỗi lượt chạy. PostgreSQL gồm bảng `documents` và `ingestion_jobs`; S3 liệt kê object theo tiền tố tenant/course; Redis lọc event theo tenant. Các lượt chạy lại chứng minh bài test dùng delta, không cần course rỗng.

| Ca | Kết quả HTTP | Bằng chứng tác dụng phụ | Trạng thái |
| --- | --- | --- | --- |
| U1 — lecturer được phép | 202 | Thêm đúng 1 metadata row, 1 ingestion job, 1 object private và 1 Redis event; SHA-256 của PostgreSQL và bytes S3 khớp PDF gửi lên; trạng thái `QUEUED`. | PASS |
| U2 — thiếu cookie | 401 | Snapshot PostgreSQL/S3/Redis giữ nguyên. | PASS |
| U3 — student không có quyền upload | 403 | Snapshot giữ nguyên. | PASS |
| U4 — lặp cùng key và bytes | 202, cùng document ID | Không thêm row, job, object hoặc event. | PASS |
| U5 — cùng key, khác bytes | 409 `DOCUMENT_IDEMPOTENCY_CONFLICT` | Snapshot giữ nguyên. | PASS |
| U6 — header tenant/user giả | Student vẫn 403; lecturer vẫn 202 dưới tenant và user đã xác minh | Lượt bị từ chối không ghi dữ liệu; lượt lecturer thêm đúng 1 row/job/object/event dưới danh tính lecturer, không theo header giả. | PASS |
| U7 — Tenant tạm dừng | 503 `DOCUMENT_DEPENDENCY_UNAVAILABLE` | Không có tác dụng phụ; `finally` khởi động lại Tenant và chờ `/health/ready` trả 200. | PASS |

## Tiêu chí nghiệm thu

| Tiêu chí | Trạng thái | Bằng chứng |
| --- | --- | --- |
| AC1 — bootstrap và readiness | PASS | `mongo-init` và `s3-init` exit 0; Auth/Tenant/Document healthy; localhost bindings đúng, database không publish port. |
| AC2 — course và hai phiên thật | PASS | `sandbox:fixtures` xác nhận lecturer 200 và student 403 trên API quyền. |
| AC3 — U1–U7 với dependency thật | PASS | Ba lần `sandbox:upload-e2e` đều đạt với snapshot PostgreSQL/S3/Redis. |
| AC4 — kiểm tra Node và Document | PASS | build, typecheck, npm test và 17 Maven test đạt. |
| AC5 — bằng chứng có thể chạy lại, không lộ secret | PASS | README ghi lệnh; report chỉ ghi run ID, status và số lượng; `.env`/`.test-data` được Git bỏ qua. |

## Lỗi đã gặp và cách xác định

1. `mongo-init` ban đầu thiếu `--nodb` (đã được xác định trong review PR #6). Sau sửa, container init exit 0.
2. `s3-init` exit 2 với `/bootstrap/s3-init.sh: 2: set: Illegal option -` do Git trên Windows checkout CRLF. Thêm `.gitattributes` chỉ định LF cho script và chuẩn hóa working tree; sau đó init exit 0.
3. `internal: true` là mạng duy nhất khiến Docker không tạo binding host (`NetworkSettings.Ports` rỗng) dù `HostConfig.PortBindings` có giá trị. Thêm mạng `access` chỉ cho Auth/Tenant/Document/S3; MongoDB/PostgreSQL/Redis vẫn chỉ ở mạng internal. Sau đó `docker port` hiển thị `127.0.0.1:14001->8080` cho Auth và tương tự cho các dịch vụ công bố.
4. Lượt tải image Maven đầu đứng ở 3,15 MB; `docker pull maven:3.9.9-eclipse-temurin-21` riêng hoàn tất rồi build lại thành công. Đây là lỗi tải image tạm thời, không cần đổi Dockerfile.

## Giới hạn và trạng thái sau kiểm tra

- Sandbox đang chạy với volume và dữ liệu thử được giữ lại; `npm run sandbox:status` cho thấy Auth/Tenant/Document healthy. Không xóa dữ liệu hoặc volume.
- Bài kiểm tra chứng minh upload tới `QUEUED`, chưa chứng minh worker chuyển `READY`, retrieval hoặc Chat citation. Gateway public chưa được kiểm tra.
- `npm ci` báo 2 high severity advisories của dependency hiện có. Không nâng cấp dependency ngoài kế hoạch; cần phân loại riêng nếu chuẩn bị dùng ngoài sandbox.
- Có thay đổi tracked/untracked của người dùng từ trước trong workspace; các thay đổi đó được giữ nguyên. Không commit hoặc push.
