# CHAT-AUTH-01 — BRAINSTORM: Chat → Tenant → Auth

**Ngày:** 2026-11-21
**Trạng thái:** Chờ người dùng duyệt hướng thiết kế; chưa sang PLAN
**Source baseline:** `origin/Linh` = `fa481e1abad589512f52ad58c44977eac2a8496b` sau fetch.

## Problem statement

> “Chốt thiết kế tích hợp Chat → Tenant → Auth” cho course chat mà không mở cửa gọi nghiệp vụ trước khi xác thực user, active tenant membership, course ACL và CSRF.

Người dùng Chat cần gửi câu hỏi tới course được phép truy cập. Chat chưa có Tenant client và hiện giữ endpoint fail-closed. Auth sở hữu session cookie; Tenant là authority cho membership và course ACL; Chat phải dùng kết quả đã xác minh trước khi gọi RAG/ChatService.

### Goals

- Chốt nguồn tenant selector của public Chat API và phân biệt rõ selector với identity evidence.
- Chốt Origin/CSRF gate, reason mapping, HTTPX/DI direction và cách test.
- Dùng contract Auth/Tenant hiện có làm input machine-readable, không thay đổi Auth/Tenant behavior.
- Đưa ra tiêu chí quan sát được để PLAN/Test có thể xác minh.

### Non-goals

- Triển khai code/config, sửa Auth/Tenant, thay đổi JWT/session contract hoặc course policy.
- History/feedback persistence hoặc ownership, Document/Retrieval behavior, gateway routing, deploy hay secret thực tế.
- Mở endpoint internal ra public gateway.

## Requirements

### Confirmed

- `POST /api/v1/courses/{course_id}/chat` không được gọi `ChatService` nếu auth/authorization gate chưa pass. Scout ghi nhận handler hiện trả 401 và test assert service không được gọi (`docs/reports/2026-11-21/chat-auth-01-scout.md`, phần 5, 8).
- Tenant context yêu cầu selector `tenantId`, xác minh session qua Auth và active membership. Tenant course check bắt buộc `tenantId`, `courseId`, `action`; course chat dùng `chat:ask`. Xem `services/tenant-service/CHAT-AUTHORIZATION.md` và source trên base.
- Browser identity headers không phải proof. `userId` chỉ lấy từ Auth; `X-Tenant-Id` nếu dùng chỉ là selector chưa tin cậy.
- Context không có CSRF token trả `csrfVerified=false`; token sai trả 403 `CSRF_INVALID`; thao tác ghi chỉ được thực hiện nếu CSRF được xác minh và Origin hợp lệ (`CHAT-AUTHORIZATION.md`, phần 1, 5).
- Repo workflow yêu cầu một stage mỗi lượt; Brainstorm chỉ ghi đề xuất/điều kiện duyệt, dừng trước PLAN (`docs/workflow/README.md`, `.agents/skills/brainstorm/SKILL.md`).

### Proposed — cần người dùng duyệt

- Public Chat nhận selected tenant qua `X-Tenant-Id`; Chat validate định dạng ObjectId rồi gửi giá trị đó trong body `tenantId` cho Tenant. Header này không cấp quyền và không dùng để xác định user.
- Chat trực tiếp validate Origin bằng allowlist server-side. Dùng cấu hình origin hiện có làm danh sách giá trị nếu đã đúng theo môi trường; CORS không thay thế kiểm tra Origin.
- Chỉ forward session cookie `tokenAdmin` và `X-CSRF-Token` tới context. POST course chat bắt buộc Origin hợp lệ và `csrfVerified === true` trước course check/ChatService.
- Dùng error envelope Chat hiện có, chuẩn hóa lỗi upstream và không trả raw Tenant/Auth body hoặc secret cho browser.
- Dùng một `TenantAuthorizationClient` async HTTPX app-scoped qua FastAPI lifespan, inject bằng dependency; mock độc lập trong unit/ASGI tests.
- `contracts/openapi/tenant-authorization.v1.yaml` tại `origin/Linh` là machine contract đầu vào hiện có; không tạo bản sao. Nếu thấy drift, sửa contract riêng trong phạm vi được duyệt sau khi đối chiếu implementation.

### Assumptions

- `X-Tenant-Id` có thể được chấp nhận làm input public của Chat mà không xung đột client/gateway hiện tại. Scout không tìm thấy contract public Chat hiện hành định nghĩa selector.
- `CORS_ORIGINS` có thể là danh sách nguồn tin cậy cho Origin check sau khi owner xác nhận các giá trị triển khai. Hiện Chat config khai báo setting nhưng app chưa áp dụng middleware.
- Response body hiện tại Chat (`success:false`, `error:{code,message,details}`) được duy trì để tương thích; lỗi upstream sẽ được ánh xạ vào `error.code` của Chat, không thêm envelope mới.

## OpenAPI contract: xác minh và cách xử lý

Scout nêu nhầm rằng `contracts/openapi/tenant-authorization.v1.yaml` không có trên `origin/Linh`. Xác minh lại bằng `git ls-tree origin/Linh` và `git show origin/Linh:contracts/openapi/tenant-authorization.v1.yaml` cho thấy file **được track và có mặt** ở SHA `fa481e1`. Lịch sử cho thấy file được thêm trong commit `63490ba` (`fix(tenant): add trusted Chat context and authorization reason codes`) trên PR #14; ref `origin/fix/duy-tam-tenant-service-20261117` trỏ tới commit đó. Kết luận “file thiếu” trước đây đến từ việc kiểm tra sai checkout/path thay vì source tree của `origin/Linh`; Scout report giữ nguyên làm provenance nhưng phần nhận định này được thay thế bởi kết quả ở đây.

Nội dung YAML khai báo server `/internal`, security đồng thời dùng service bearer `CHAT_SERVICE_TOKEN` và cookie `tokenAdmin`, hai POST context/check, body/schema, action enum, success shape, status 400/401/403/503/500 và reasonCode enum. Các điểm chính phù hợp với Tenant source đã đọc trong Scout. Tài liệu `CHAT-AUTHORIZATION.md` ghi baseline `9b7b910`, nên source tại `fa481e1` vẫn là thẩm quyền cho behavior hiện hành; không mặc định markdown luôn đồng nhất với source/YAML.

**Đề xuất:** không bổ sung YAML mới. Trong PLAN, đối chiếu spec ↔ route/validator/controller/helper bằng acceptance checks, rồi viết Chat client contract tests từ schema này (hoặc fixture/validator tương đương trong Python). Nếu source và spec bất đồng, ghi drift cụ thể và yêu cầu quyết định trước khi sửa; không tự đổi Auth/Tenant behavior.

## Options and trade-offs

### A. Tenant selector: header, body, query

| Phương án | Ưu điểm | Nhược điểm/rủi ro | Đánh giá |
|---|---|---|---|
| `X-Tenant-Id` (khuyến nghị) | Tách context/selection khỏi body câu hỏi; không phá schema request body hiện tại; phổ biến cho multi-tenant APIs; tương thích với Tenant body sau khi Chat chuyển đổi. | Cần cập nhật public Chat API docs/client; proxy phải forward header; tên header có thể gây hiểu nhầm là identity claim. | Chấp nhận nếu docs ghi rõ **untrusted selector**, Tenant xác minh membership và Chat không dùng nó làm user identity. |
| Thêm `tenantId` vào body | Dễ thấy trong JSON, ít phụ thuộc header forwarding. | Thay đổi request schema; trộn context với câu hỏi; payload có thể được log/ghi lại; không cần thiết cho selector. | Chỉ chọn nếu client contract đã cố định body hoặc gateway không forward custom header. |
| Query `?tenantId=` | Dễ gọi khi debug. | Dễ xuất hiện trong URL logs, analytics/cache; kém phù hợp context nhạy cảm hơn header; body/header vẫn cần chọn cho server-to-server request. | Không khuyến nghị. |

**Khuyến nghị cụ thể:** `X-Tenant-Id` là giá trị do client chọn, chỉ validate cú pháp ở Chat rồi gửi Tenant dưới dạng `{tenantId}`. `X-User-Id`, `X-Role`, browser `Authorization` không được xem là identity. User identity, role và canonical tenant context chỉ lấy từ response Tenant đã schema-validate. Nếu response Tenant trả userId/tenantId không khớp context đã chọn/đã xác minh, fail closed như upstream response không hợp lệ.

### B. Origin và CSRF

| Phương án | Ưu điểm | Nhược điểm/rủi ro | Đánh giá |
|---|---|---|---|
| Chat tự enforce allowlist (khuyến nghị) | Ranh giới bảo mật rõ trong service; không phụ thuộc gateway chưa được chứng minh; có thể unit-test. | Cần quản lý allowed origins đồng nhất với frontend/deployment; CORS config hiện chưa enforce Origin. | Đơn giản và an toàn nhất cho code hiện tại. |
| Tin gateway | Ít code trong Chat. | Không có source/test/deployment evidence cho enforcement; bypass nếu service có đường truy cập khác hoặc gateway cấu hình sai. | Không chọn trừ khi có trust boundary, topology và integration evidence được duyệt. |

Luồng đề nghị: reject request trước mọi Tenant call nếu Origin vắng mặt/sai format/không exact-match allowlist; nếu hợp lệ, forward `tokenAdmin` cookie cùng `X-CSRF-Token` (nếu có) đến context. Ưu tiên chỉ forward cookie `tokenAdmin` để giảm dữ liệu cookie không liên quan; không log Cookie, CSRF, bearer. Origin thiếu hoặc không cho phép → 403 Chat-local `ORIGIN_INVALID`, không gọi Tenant. Origin hợp lệ nhưng CSRF thiếu → Tenant context trả `csrfVerified=false`; do đây là POST mutation, Chat trả 403 `CSRF_REQUIRED`, không gọi course check/ChatService. CSRF sai → Tenant trả 403 `CSRF_INVALID`, Chat giữ 403 tương ứng. CSRF hợp lệ → true; chỉ tiếp tục course ACL sau khi kiểm tra giá trị boolean chính xác là `true`.

Nếu frontend gọi Chat cross-origin, CORS cần allow đúng Origin, credentials và request headers (`X-Tenant-Id`, `X-CSRF-Token`, `Content-Type`) để browser gửi cookie/custom headers; preflight `OPTIONS` không phải authorization và không thay thế Origin check trên POST. Không dùng wildcard origin khi cho phép credentials.

### C. HTTPX client và dependency injection

| Phương án | Ưu điểm | Nhược điểm/rủi ro |
|---|---|---|
| Tạo AsyncClient mỗi request | Dễ cô lập, ít lifecycle setup. | Mất connection pooling, overhead, mỗi call tạo/kết thúc transport; test handler orchestration khó thay thế nếu không inject. |
| Client global/module singleton | Reuse connection pool. | Lifecycle shutdown khó; config/test leakage; app nhiều instance trong test có thể dùng nhầm client. |
| Client app-scoped qua FastAPI lifespan + DI (khuyến nghị) | Pooling, timeout/config một chỗ, lifecycle đóng rõ ràng; test inject client/transport hoặc override dependency; phù hợp pattern service integration hiện có. | Thêm lifespan wiring và test lifespan; cần xác định ownership/close để tránh double-close. |

Chốt API client cấp service (ví dụ `resolve_context(...)`, `check_course(...)`) để controller không tự ghép HTTP. Thiết lập bounded timeout riêng, base URL từ cấu hình, chỉ gửi endpoint `/internal/authorization/...`, không retry tự động cho POST authorization nếu chưa quyết định semantics. Client validate HTTP status, JSON envelope, trường bắt buộc, kiểu dữ liệu, allowed true và reasonCode thuộc allowlist. Không phản chiếu body lỗi upstream hoặc headers vào public response/log.

### D. Public error mapping

Giữ wrapper hiện có của Chat `{"success":false,"error":{"code":"...","message":"...","details":{}}}`; mapping là **đề xuất**, không phải contract hiện hữu. Public messages generic; không ghi credential hoặc upstream body.

| Upstream/failure | Public status | `error.code` đề xuất | Hành vi |
|---|---:|---|---|
| `SESSION_INVALID` | 401 | `SESSION_INVALID` | Client yêu cầu sign-in lại; không chạy nghiệp vụ. |
| `SERVICE_CREDENTIAL_INVALID` (Chat → Tenant) | 503 | `AUTH_DEPENDENCY_FAILURE` | Lỗi cấu hình/service caller; không sign-out user. Log mã đã sanitize, không log token. |
| `TENANT_ACCESS_DENIED` | 403 | `TENANT_ACCESS_DENIED` | Từ chối tenant selector; không tiết lộ user/membership detail. |
| `COURSE_ACCESS_DENIED` | 403 | `COURSE_ACCESS_DENIED` | Từ chối course. |
| `CSRF_INVALID` | 403 | `CSRF_INVALID` | Từ chối request; không retry tự động. |
| Context success nhưng `csrfVerified=false` | 403 | `CSRF_REQUIRED` | Chat-local policy cho POST; không gọi course check/ChatService. |
| `AUTH_SERVICE_CREDENTIAL_INVALID` | 503 | `AUTH_DEPENDENCY_FAILURE` | Tenant→Auth configuration fault; không sign-out user. |
| `AUTH_SERVICE_UNAVAILABLE` | 503 | `AUTH_DEPENDENCY_FAILURE` | Dependency unavailable. |
| `AUTH_RESPONSE_INVALID` | 502 | `AUTH_DEPENDENCY_INVALID_RESPONSE` | Auth upstream protocol/schema invalid theo Tenant. |
| Timeout từ Chat→Tenant | 504 | `AUTH_DEPENDENCY_TIMEOUT` | Fail closed; không gọi nghiệp vụ. |
| Connect/network error | 503 | `AUTH_DEPENDENCY_FAILURE` | Fail closed. |
| Tenant trả malformed JSON/schema, HTTP 200 nhưng allowed/identity fields thiếu/sai, hoặc unknown reason code/status | 502 | `AUTH_DEPENDENCY_INVALID_RESPONSE` | Fail closed; không suy đoán session invalid. |
| Tenant trả 5xx không nhận diện | 503 | `AUTH_DEPENDENCY_FAILURE` | Fail closed, nội dung sanitized. |

Các code Chat-local trên không đòi hỏi sửa Tenant reason codes. Không map mọi upstream 401 thành `SESSION_INVALID`; chỉ đúng reason code mới trả 401 login. Giữ `details` rỗng hoặc chỉ có request ID; không forward raw JSON, Cookie, bearer hay secret.

### E. Thứ tự thực thi handler

```text
1. Validate request shape: X-Tenant-Id present/valid; Origin exact match allowlist.
2. Read session cookie and optional X-CSRF-Token; call Tenant context with server CHAT_SERVICE_TOKEN.
3. Strictly validate context envelope and trusted userId/tenantId/role; require csrfVerified is true for this POST.
4. Call Tenant check with verified tenantId, route course_id, action="chat:ask", server bearer and session cookie.
5. Strictly validate check envelope and ensure returned userId/tenantId match the verified context; then create TenantContext from verified values plus authorized route course_id.
6. Invoke ChatService only after all gates pass.
```

`TenantContext` không được dựng từ raw browser headers/body. `course_id` là target requested; chỉ đưa vào trusted context sau khi Tenant check cho đúng tenant/course/action cho phép. Bất cứ exception, timeout, network error, bad status, malformed JSON, missing field, false `allowed`, unknown reason, identity mismatch hoặc DI/client failure đều dừng trước bước 6. Không fallback sang `verify_session_token`, browser `Authorization`, giả `courseId` hoặc bỏ qua Tenant.

## Edge cases

- Selector thiếu/sai format → 400 validation; không gọi Tenant. Selector syntactically valid nhưng user không có membership → Tenant 403.
- Origin thiếu/`null`/không allowlist → 403 trước service call; không xem CORS thành security proof.
- Cookie thiếu/hết hạn/revoked → chỉ reason `SESSION_INVALID` ánh xạ 401. Sai Chat service bearer vẫn 503.
- CSRF thiếu → context có thể thành công `false`, nhưng POST dừng tại Chat. Sai → Tenant 403. Hợp lệ nhưng context/check sai schema → dừng, không tin csrf value riêng lẻ.
- Course thuộc tenant khác, inactive, enrollment/assignment bị thu hồi → check bị deny; ChatService không chạy.
- Auth/Tenant response rỗng, malformed, status-reason mismatch, code unknown hoặc `userId`/`tenantId` lệch → fail closed như dependency protocol failure.
- Tenant timeout/network/down → fail closed; timeout 504, network/service down 503 theo đề xuất. Không retry POST tự động.
- Concurrent membership/course revocation giữa context và check: course check là gate cuối cho request. Authorization có thể thay đổi sau khi check; CHAT-AUTH-01 không tạo transaction xuyên service. Chat không cache quyết định giữa requests.
- History no-course, feedback ownership, personal document ownership không suy ra từ context/course ACL; tiếp tục ngoài scope.

## Recommendation

Chọn **A + B(Chat-enforced) + C(app-scoped HTTPX) + D(normalized Chat envelope)**. Dùng header `X-Tenant-Id` chỉ làm selector; dùng cookie session để Auth/Tenant xác minh identity; yêu cầu Origin và CSRF trước nghiệp vụ; chạy context rồi course check `chat:ask`; chỉ tạo `TenantContext` sau hai response đã validate; chỉ khi đó gọi ChatService. Dùng YAML đã có tại `origin/Linh` làm contract đầu vào, phát hiện drift thì dừng và ghi nhận, không chỉnh Auth/Tenant scope.

Đây là phương án ít thay đổi contract upstream, tách rõ selector/identity, không phụ thuộc gateway, giữ client pooling và cho phép test từng phần. Body selector thắng chỉ khi client/proxy không thể gửi custom header hoặc public body contract đã cố định tenant selection. Gateway enforcement chỉ thắng nếu có evidence, policy integration test và service-network trust boundary được người dùng chấp thuận.

## Acceptance criteria for PLAN/Test

1. Request không có `X-Tenant-Id`, ObjectId sai, Origin thiếu hoặc Origin ngoài allowlist không gọi Tenant/ChatService; trả status/code đã chốt.
2. `X-User-Id`, `X-Role`, browser `Authorization` không làm đổi identity; không được forward làm service auth.
3. Tenant client gọi đúng POST paths, request body và `CHAT_SERVICE_TOKEN`; forward cookie `tokenAdmin` và `X-CSRF-Token` phù hợp policy; không log secret-bearing headers.
4. Context response chỉ được chấp nhận khi envelope/type/IDs/role đúng, `allowed is True`; `csrfVerified` phải đúng boolean true trước course check cho POST.
5. Course check luôn chứa verified `tenantId`, path `course_id`, `action="chat:ask"`; thiếu courseId không bao giờ được thay bằng giá trị giả.
6. Check response phải allowed true và userId/tenantId khớp context; nếu không, fail closed.
7. Spy/mock xác nhận ChatService chỉ được gọi một lần sau hai gate thành công, với TenantContext gồm identity từ Tenant và course đã được ACL check.
8. Tất cả reasonCode trong bảng có status/code mapping chính xác; service credential/dependency errors không thành 401/logout.
9. Timeout, connection error, malformed JSON/schema, status unknown, reason unknown, identity mismatch đều fail closed; ChatService không được gọi.
10. Unit/contract tests chạy không cần Auth/Tenant runtime; ASGI tests exercise request chain bằng mocked Tenant client; regression tests hiện tại về forged identity headers tiếp tục pass.
11. Contract YAML/source mismatch nếu phát hiện được báo riêng; không sửa Auth/Tenant behavior như một phần tích hợp Chat.

## Unresolved decisions for user

Các lựa chọn đề nghị duyệt; mỗi câu trả lời ảnh hưởng public API hoặc security boundary:

1. **Tenant selector:** duyệt `X-Tenant-Id` làm selector chưa tin cậy? Khuyến nghị: Có; validate shape tại Chat, Tenant là authority membership.
2. **Origin/CSRF:** duyệt Chat tự kiểm tra Origin allowlist; missing/bad Origin 403; missing CSRF sau context false → 403 `CSRF_REQUIRED`; sai CSRF → 403 `CSRF_INVALID`; chỉ true mới qua course check? Khuyến nghị: Có.
3. **Error contract:** duyệt mapping status/code trong bảng và giữ Chat envelope hiện tại? Khuyến nghị: Có; đặc biệt chỉ `SESSION_INVALID` mới là 401, credential/dependency là 502/503/504 và không sign-out.
4. **Cookie forwarding:** duyệt chỉ forward cookie `tokenAdmin`, không chuyển các browser cookies khác? Khuyến nghị: Có để giảm dữ liệu được chia sẻ; Tenant/Auth chỉ cần cookie tên này.
5. **HTTP client:** duyệt app-scoped HTTPX client qua lifespan và DI? Khuyến nghị: Có để tái sử dụng connection pool và kiểm soát timeout/lifecycle.
6. **Contract:** xác nhận dùng `contracts/openapi/tenant-authorization.v1.yaml` đã có ở origin/Linh; không tạo file thay thế. Khuyến nghị: Có; PLAN thêm đối chiếu và test schema.

Nếu `X-Tenant-Id` không thể đi qua client/gateway hoặc cookie forwarding policy phải giữ nguyên toàn bộ header, cần sửa quyết định tương ứng trước PLAN. Không còn blocker về việc thiếu YAML sau khi xác minh lại; còn blocker quyết định public selector, Origin allowlist, public error codes và forwarding policy.

## Out of scope

Không triển khai code/config, history/feedback persistence/ownership, personal-chat no-course flow, Retrieval/Document changes, gateway changes/routes, Auth/Tenant changes, deployment, secrets hoặc merge. Sau khi user duyệt các lựa chọn, bước tiếp theo là `$plan`; không tự chuyển giai đoạn.
