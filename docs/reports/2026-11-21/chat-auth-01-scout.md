# CHAT-AUTH-01 — SCOUT: Chat → Tenant → Auth

**Ngày:** 2026-11-21
**Trạng thái:** SCOUT hoàn tất; chưa sang PLAN/COOK
**Phân loại:** `CONFIRMED` = xác minh từ source/tài liệu; `MISSING` = chưa có trong implementation; `BLOCKED` = phụ thuộc cần giải quyết trước khi triển khai; `NOT_VERIFIED` = chưa đủ bằng chứng.

## 1. Yêu cầu và phạm vi

Khảo sát cách Chat Service cần kết nối hợp đồng xác thực Tenant/Auth đã có cho `POST /api/v1/courses/{course_id}/chat`. Tập trung identity, active tenant membership, course ACL, Origin/CSRF, fail-closed và test cần có. Không sửa production code, không chạy test/build, không merge/deploy.

## 2. Git provenance và phương pháp

- Checkout đang được người dùng sử dụng: `feat/chat-persistence`, HEAD `caf6f0d8c8c8b71833239594c6c6ac80a300194f`.
- Trước khi khảo sát, checkout đó có file đã sửa `services/chat-service/.env.example` và untracked files/tài liệu. Các thay đổi này được giữ nguyên; không reset, clean, stash hay ghi đè.
- Có worktree khác `D:/Software Engineer/thanh-tam-04-01-docs` trên `docs/04-01-chat-auth`, HEAD `e94d6a6`.
- `git fetch origin --prune` hoàn tất. `origin/Linh` là `fa481e1abad589512f52ad58c44977eac2a8496b`, khớp commit dự kiến; commit là merge PR #14. `origin/Linh` là hậu duệ của commit dự kiến.
- Dùng worktree tạm detached tại `C:/Users/Admin/AppData/Local/Temp/codex-chat-auth-scout-20261121`, HEAD đúng `fa481e1abad589512f52ad58c44977eac2a8496b`, để đọc source mà không làm ảnh hưởng checkout đang có thay đổi. Source được viện dẫn trong báo cáo là source ở commit này.
- Báo cáo và handoff được tạo trong checkout chính có sẵn thay đổi người dùng để đáp ứng vị trí tài liệu được yêu cầu; chúng là hai file mới có chủ đích. Không có production code nào được sửa.

## 3. Tổng quan kiến trúc hiện tại

`CONFIRMED` — Auth sở hữu `tokenAdmin` JWT và introspection. Tenant xác thực service caller, chuyển tiếp cookie tới Auth, xác định identity từ Auth, xác minh selected tenant và membership, rồi kiểm tra quyền course qua `CourseService`. Chat hiện có endpoint course chat và RAG pipeline, nhưng chưa có Tenant authorization client hoặc xác thực user thực.

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Chat Service
    participant T as Tenant Service
    participant A as Auth Service
    participant R as Retrieval/Chat pipeline
    B->>C: POST /api/v1/courses/{course_id}/chat + tokenAdmin cookie + tenant selector
    Note over C: Validate Origin; do not trust browser identity headers
    C->>T: POST /internal/authorization/context + CHAT_SERVICE_TOKEN + Cookie + tenantId + optional X-CSRF-Token
    T->>A: POST /internal/auth/introspect + AUTH_TENANT_TOKEN + Cookie
    A-->>T: Auth-verified account identity, or reasonCode
    T->>T: Require active tenant and active membership
    T-->>C: verified userId/tenantId/role/csrfVerified, or reasonCode
    C->>T: POST /internal/authorization/check + tenantId + courseId + chat:ask + service token + Cookie
    T->>T: CourseService.canAccessCourse(..., chat:ask)
    T-->>C: allowed, or COURSE_ACCESS_DENIED
    Note over C: Build TenantContext only from validated success envelopes
    C->>R: Invoke ChatService only after identity, membership, course ACL, and required CSRF checks
```

`CONFIRMED` — Chat's current course handler raises `UnauthorizedException` before invoking `ChatService`; integration is currently unavailable but fail-closed. Conversation/history and feedback handlers raise `NotImplementedError`. The internal LLM route is separate and has its own access token; it is not user/session authorization.

## 4. Hợp đồng đã xác minh

### 4.1 Source và tài liệu

- `services/tenant-service/CHAT-AUTHORIZATION.md` có mặt ở `origin/Linh` và mô tả caller contract. Tài liệu ghi implementation baseline `9b7b910`, cũ hơn HEAD hiện tại; do đó các kết luận bên dưới được đối chiếu trực tiếp với source tại `fa481e1`.
- `contracts/openapi/tenant-authorization.v1.yaml` **không có** ở `origin/Linh`; `contracts/openapi/` chỉ có `.gitkeep` và các contract khác. `MISSING` — cần bổ sung/định vị machine-readable contract nếu giai đoạn sau yêu cầu contract test độc lập. Không giả định nội dung contract YAML.
- Source đối chiếu: Auth `routes/internal.route.ts`, `controllers/internal.controller.ts`, `middlewares/security.middleware.ts`; Tenant `routes/internal.route.ts`, `controllers/internal.controller.ts`, `validates/internal.validate.ts`, `middlewares/admin/auth.middleware.ts`, `middlewares/security.middleware.ts`, `helpers/auth.helper.ts`, `services/authorization.service.ts`, `services/course.service.ts`, `config/auth-reason.config.ts`, `helpers/error.helper.ts`.

### 4.2 Endpoint, headers, body và kết quả

`CONFIRMED` — Tenant mount internal router dưới `/internal` (từ `services/tenant-service/app.ts`). Hai API dành cho Chat:

| Method/path | Middleware và request | Success / ý nghĩa |
|---|---|---|
| `POST /internal/authorization/context` | `Authorization: Bearer <CHAT_SERVICE_TOKEN>`; Cookie header nguyên bản chứa `tokenAdmin`; JSON chỉ `{ "tenantId": "<ObjectId>" }`; `X-CSRF-Token` tùy chọn | `{code:"success", successful:true, data:{allowed:true, userId, tenantId, role, csrfVerified}}`. Tenant lấy identity từ Auth, rồi xác minh tenant/membership đang active và chưa deleted. Đây không phải course ACL. |
| `POST /internal/authorization/check` | Cùng service bearer và cookie; JSON `{ "tenantId": "...", "courseId": "...", "action": "..." }`; `courseId` bắt buộc | Success `{code:"success", successful:true, data:{allowed:true, tenantId, userId}}`. `action` được validate thành `course:read`, `document:read`, `chat:ask`, hoặc `feedback:write`; handler gọi CourseService ACL. |

Tenant route thực hiện `verifyService("CHAT_SERVICE_TOKEN")` trước `verifyToken`, vì vậy Chat cần phân loại 401 bằng `reasonCode`, không thể coi mọi 401 là session hết hạn. Auth introspection ở `POST /internal/auth/introspect`, dưới router `/internal`; yêu cầu `Authorization: Bearer <AUTH_TENANT_TOKEN>` và Cookie. Auth xác minh JWT HS256 qua `tokenAdmin` và trả account identity; Auth không cấp token này cho Chat.

`CONFIRMED` — Context body chỉ chấp nhận `tenantId`; selector do browser chọn là input chưa đáng tin cậy. Tenant trả canonical tenant ID và Auth-derived user ID. `X-User-Id`, `X-Tenant-Id`, body `userId` hoặc role từ browser không phải bằng chứng danh tính; body fields thừa bị Joi validation loại/từ chối. Không chuyển tiếp browser `Authorization` làm service credential.

### 4.3 Status và reasonCode

| Endpoint layer/status | `reasonCode` | Xử nhận từ Chat |
|---|---|---|
| Tenant 401 | `SESSION_INVALID` | Yêu cầu đăng nhập lại/401; chỉ khi chính xác reason này. Auth helper phát sinh khi cookie/JWT không hợp lệ. |
| Tenant 401 | `SERVICE_CREDENTIAL_INVALID` | 503 hoặc lỗi cấu hình nội bộ cho Chat → Tenant; không đăng xuất người dùng. Tenant middleware kiểm tra Chat credential trước session. |
| Tenant 403 | `TENANT_ACCESS_DENIED` | Từ chối tenant đã chọn/membership (inactive/deleted/không có membership); 403. |
| Tenant 403 | `COURSE_ACCESS_DENIED` | Từ chối quyền course; 403. |
| Tenant 403 | `CSRF_INVALID` | Từ chối mutation; không coi là lỗi credential hay session. |
| Tenant 503 | `AUTH_SERVICE_CREDENTIAL_INVALID` | Lỗi cấu hình Tenant → Auth; dependency/server error, không đăng xuất người dùng. |
| Tenant 503 | `AUTH_SERVICE_UNAVAILABLE` | Dependency Auth không sẵn sàng; fail closed. |
| Tenant 503 | `AUTH_RESPONSE_INVALID` | Protocol/schema/401 Auth không nhận diện; fail closed, không giả thành session invalid. |

`CONFIRMED` — Auth source trả `SESSION_INVALID` cho cookie thiếu/sai/hết hạn/revoked theo introspection; middleware trả `SERVICE_CREDENTIAL_INVALID` khi service bearer thiếu/sai/ngắn hơn 32 ký tự. Tenant `AuthClient` có timeout 5 giây và phân loại lỗi Auth nói trên. Tenant error helper trả reasonCode khi được gắn; lỗi chưa phân loại trả 500 chung. Chat hiện chưa có reason-code model hay mapping cho các lỗi này.

### 4.4 Tenant và course policy

`CONFIRMED` — Context chỉ cho phép tenant status `active`, `deleted:false` và membership status `active`, `deleted:false`; platform admin không có quyền bypass membership cho content. Course check yêu cầu active tenant, active membership, course thuộc tenant, course chưa deleted; `chat:ask` bắt buộc active course. `tenant_owner`/`tenant_admin` được qua ACL khi tenant/course phù hợp; lecturer cần assignment; các role còn lại (ví dụ student) cần enrollment active. Không tự dựng/fill `courseId` cho thao tác cá nhân. `feedback:write` được chấp nhận bởi validator và gọi quy tắc hiện có của `CourseService`.

### 4.5 CSRF và Origin

`CONFIRMED` — Tenant context không yêu cầu CSRF header. Nếu không có `X-CSRF-Token`, response `csrfVerified:false`; token hợp lệ gắn với JWT thì true; token gửi lên nhưng empty/sai/cross-session thì 403 `CSRF_INVALID`. Tenant `verifyOrigin` bảo vệ browser admin mutations, nhưng các internal routes trên không gọi middleware đó. Tài liệu `CHAT-AUTHORIZATION.md` giao trách nhiệm validate browser Origin và chỉ thực hiện Chat mutation khi `data.csrfVerified === true` cho Chat hoặc trusted edge.

`MISSING` — Chat hiện không cài Origin allowlist enforcement; `CORS_ORIGINS` có trong Settings nhưng không thấy middleware CORS/Origin check trong app setup. Vì vậy course POST không thể được mở trước khi Origin gate có thiết kế/kiểm thử phù hợp. Chuyển tiếp CSRF và yêu cầu `csrfVerified=true` cho course chat cũng chưa được implement.

## 5. Chat Service hiện tại và files liên quan

| File/module | Hiện trạng |
|---|---|
| `services/chat-service/app/core/security.py` | `verify_session_token()` chỉ là stub `NotImplementedError`; không verify session cookie/JWT. Không nên tự verify JWT bằng `AUTH_SECRET_KEY`/secret Chat. |
| `services/chat-service/app/core/config.py` | Có config DB, LLM, Retrieval, `CORS_ORIGINS`, `AUTH_SECRET_KEY`; thiếu `TENANT_SERVICE_URL`, `CHAT_SERVICE_TOKEN`, timeout Tenant và Origin allowlist/CSRF config. |
| `services/chat-service/app/dependencies.py` | DI hiện chỉ có `get_session()` cho DB; chưa có authorization client/dependency. |
| `services/chat-service/app/domain/value_objects/tenant_context.py` | Frozen dataclass `{tenant_id, user_id, course_id?}`. Không xác minh provenance; hiện caller phải bảo đảm chỉ dựng sau khi validate response Tenant. |
| `services/chat-service/app/api/controllers/chat_controller.py` | `POST /api/v1/courses/{course_id}/chat` hiện trả 401 trong mọi trường hợp và không gọi `ChatService`; đúng fail-closed, nhưng chưa sử dụng path/body hoặc auth dependency. |
| `services/chat-service/app/services/chat_service.py`, `app/ai/pipeline.py` | Nhận `TenantContext` và truyền tenant/course/actor tới retrieval; không tự thực thi authorization. Không cho handler gọi nếu context chưa trusted. |
| `services/chat-service/app/api/controllers/conversation_controller.py`, `feedback_controller.py` | History GET và feedback POST là stub `NotImplementedError`; không triển khai trong CHAT-AUTH-01. |
| `services/chat-service/app/integrations/retrieval_service/http_client.py` | Ví dụ HTTPX async client với timeout, connection/network/timeout/error mapping và validation success schema; có thể tham khảo pattern, nhưng không phải Tenant client. |
| `services/chat-service/app/api/error_handlers.py`, `app/core/exceptions.py` | Có 401/403 exception envelope tổng quát (`UNAUTHORIZED`, `FORBIDDEN`); chưa có mapping Tenant reasonCode. |
| `services/chat-service/app/api/middleware/request_logging.py` | Log method, path, status, duration; không log headers/body hiện tại. Bảo đảm client mới/error handling không log cookie, CSRF token hoặc service bearer. |
| `services/chat-service/tests/integration/test_chat_api.py` | ASGI tests đã verify request thiếu auth, giả `X-User-Id`/`X-Tenant-Id`, forged Authorization đều 401, `ChatService.answer_question` không được gọi; test empty question 422. Tốt làm baseline regression, cần mở rộng theo luồng auth mới. |

`CONFIRMED` — Chat có HTTP client gọi Retrieval qua HTTPX, nhưng chưa có HTTP client gọi Tenant, timeout riêng hoặc auth failure mapping cho Tenant. Dependency injection hiện hỗ trợ override `get_chat_service`; pattern `httpx.MockTransport` có trong client integration tests và có thể tái sử dụng.

## 6. Danh sách files có khả năng sửa/bổ sung ở PLAN/COOK

Đây là phạm vi dự kiến dựa trên source hiện trạng, chưa phải quyết định implement:

- **Sửa:** `services/chat-service/app/core/config.py` và `services/chat-service/.env.example` — Tenant base URL, server-only `CHAT_SERVICE_TOKEN`, timeout, Origin allowlist/config validation. Cần giữ .env mẫu sạch; không ghi secret thật.
- **Thêm:** integration module cho Tenant authorization HTTPX client và DTO/schema validation cho context/check success/failure; tuyệt đối không forward/log secret.
- **Sửa:** `services/chat-service/app/dependencies.py` — inject client (và quản lý lifecycle nếu chọn client persistent); giữ test override.
- **Sửa:** `services/chat-service/app/api/controllers/chat_controller.py` — đọc cookie và tenant selector rõ ràng; validate Origin; gọi context, buộc CSRF verified theo policy, gọi `authorization/check` với `action="chat:ask"`, dựng TenantContext từ response đã validate, rồi mới gọi ChatService.
- **Sửa/Thêm:** exception/error mapping trong `app/core/exceptions.py`, `app/api/error_handlers.py` hoặc lớp adapter riêng để giữ public envelope nhất quán mà phân biệt session, deny, service config và dependency faults.
- **Sửa/Thêm tests:** `tests/integration/test_chat_api.py`; tests unit/contract client cho headers/body, cookie/CSRF forwarding, timeout/network/status/reason/schema, action/courseId, thứ tự call và fail-before-business; giữ các test giả identity headers. Contract file machine-readable thiếu trong base; cần quyết định nếu cần tạo contract artifact (không đổi Tenant/Auth API scope).
- **Không cần sửa theo scope:** Auth/Tenant source, CourseService policy, Retrieval/RAG, gateway, history/feedback persistence/ownership, deployment/secrets. Chat runtime integration chưa đủ để đảm bảo ownership của history/feedback.

## 7. Rủi ro, gaps và security notes

1. `MISSING` — Chat endpoint hiện fail-closed; do đó chưa có authorization bypass qua handler, nhưng course chat chưa hoạt động. Không xóa gate trước khi auth context AND course ACL tests chạy.
2. `MISSING` — `verify_session_token` chưa implement; không thay bằng identity headers hoặc secret tự quản trong Chat.
3. `MISSING` — Không có Tenant client/credential/base URL/timeout, DI hay reason mapping.
4. `MISSING` — Chat chưa enforce Origin, forward CSRF, hoặc bắt buộc `csrfVerified=true` trước khi chạy POST business flow. CORS không tự thay thế Origin/CSRF authorization.
5. `CONFIRMED` — `TenantContext` là DTO thuần, có thể được dựng từ dữ liệu caller bất kỳ; ranh giới controller/dependency phải bảo đảm nguồn trusted.
6. `CONFIRMED` — Conversation/feedback chưa triển khai; Tenant context và course ACL không chứng minh ownership. Khi scope ownership tới sau, Chat phải kiểm tra owner theo userId+tenantId tại từng record; không mở rộng vào CHAT-AUTH-01.
7. `MISSING` — Requested OpenAPI YAML chưa có ở commit cơ sở. Tài liệu markdown contract có baseline SHA cũ; source implementation hiện tại đã kiểm tra nhưng docs phải đồng bộ nếu dùng làm chuẩn lâu dài.
8. `NOT_VERIFIED` — Không thực hiện dynamic test/build và không kiểm tra runtime deployment config/reachability/secrets. Không có tuyên bố test pass.

## 8. Ma trận dependency và test cases

Các trạng thái hiện tại dưới đây dựa trên source, không phải kết quả chạy test. Với các trường hợp chưa có đường chạy auth, kết quả mong đợi là hành vi sau tích hợp.

| # | Endpoint liên quan | Điều kiện | Kết quả mong đợi | Hiện trạng | Còn thiếu / test cần thêm |
|---|---|---|---|---|---|
| 1. User hợp lệ chat course | `POST /api/v1/courses/{course_id}/chat`; context rồi check | Cookie hợp lệ; selected tenant membership active; Origin cho phép; CSRF hợp lệ; course `chat:ask` được phép | Context trusted + check allowed; chỉ sau đó gọi ChatService một lần | `MISSING`; handler luôn 401 | Mock Tenant context/check; assert đúng cookie, service bearer, tenant selector, `courseId`, `chat:ask`; ChatService chưa được gọi nếu bất kỳ gate nào fail |
| 2. Thiếu cookie `tokenAdmin` | Cùng course endpoint → context | Service credential Chat hợp lệ; cookie thiếu | `SESSION_INVALID` → public 401/login required; không chạy nghiệp vụ | Tenant/Auth source xử lý; Chat chưa nối | Unit client phân loại reason; ASGI assert no ChatService |
| 3. Session hết hạn/revoked | context/check → Auth introspect | Cookie không hợp lệ/hết hạn/account/token không còn hợp lệ | `SESSION_INVALID`; 401, không chạy nghiệp vụ | Auth introspection có JWT verify + `getIdentity`; Chat chưa nối | Mock response reason; không biến dependency error thành logout |
| 4. `CHAT_SERVICE_TOKEN` sai | context/check | Session có thể hợp lệ nhưng service bearer sai/thiếu | Tenant `SERVICE_CREDENTIAL_INVALID`; Chat báo dependency/config, không logout | Tenant middleware có 401 reason; Chat chưa mapping | Mock 401 reason và unknown/empty reason; xác minh public 5xx envelope, không rò credential |
| 5. `AUTH_TENANT_TOKEN` sai | context/check → Tenant → Auth | Auth reject service bearer của Tenant | Tenant chuyển thành `AUTH_SERVICE_CREDENTIAL_INVALID` 503; không logout | Tenant `AuthClient` map từ Auth `SERVICE_CREDENTIAL_INVALID`; Chat chưa nối | Mock 503 reason; ensure dependency failure |
| 6. Membership bị thu hồi | context | Auth identity hợp lệ; membership inactive/deleted hoặc tenant không active | 403 `TENANT_ACCESS_DENIED`; dừng | Tenant `AuthorizationService.getContext` kiểm tra trạng thái | Test Chat mapping và no ChatService |
| 7. User chọn tenant khác | context + check | Tenant selector là browser input nhưng user không có active membership | 403 `TENANT_ACCESS_DENIED`; không tin header/role/tenant từ client | Tenant lookup membership theo Auth-derived ID | Test forged `X-User-Id`, `X-Tenant-Id`, body fields; response/body tampering |
| 8. Không có quyền course | check `action=chat:ask` | Valid context; route course belongs elsewhere/inactive/no enrollment or assignment | 403 `COURSE_ACCESS_DENIED`; không gọi ChatService | `CourseService` policy hiện có; Chat chưa gọi check | Test wrong tenant/course, inactive course, student un-enrolled, lecturer unassigned, allowed roles |
| 9. Giả identity headers | course endpoint | Gửi X headers hoặc browser `Authorization` giả | Bị từ chối; identity chỉ từ cookie/Auth | Regression test hiện tại trả 401, service không gọi | Giữ test sau tích hợp; assert headers không được forward/đọc như identity |
| 10. Tenant timeout/network | context/check | Tenant không phản hồi hoặc network fail | Fail closed; dependency error (timeout có thể public 504 theo chính sách chọn, không phải contract status) | `MISSING`; retrieval client chỉ là pattern | Mock `httpx.TimeoutException`, connect/network error; no ChatService; không retry mutation tùy tiện |
| 11. Tenant schema sai | context/check | HTTP 200 malformed/missing/wrong fields, `allowed` sai hoặc envelope không nhận diện | Fail closed; `AUTH_RESPONSE_INVALID`/dependency response error; no ChatService | `MISSING` | Contract schema tests valid/invalid/unknown additive fields, malformed JSON, IDs/role/boolean validation |
| 12. CSRF thiếu/sai | course endpoint | Thiếu CSRF hoặc request origin không hợp lệ; token sai | Origin reject hoặc context `csrfVerified=false` thì mutation chưa được gọi; token sai → 403 `CSRF_INVALID` | Tenant: absent=false, invalid→403; Chat Origin/forward/require true đều `MISSING` | Tests Origin absent/untrusted, token absent/wrong/right/cross-session; assert business never called unless true |
| 13. History cá nhân không có course | `GET /api/v1/conversations` (ngoài scope runtime) | Cookie + selected tenant context; không có course id | Không tạo courseId giả; history cần own record ownership check theo user+tenant | History handler `NotImplementedError`; no auth/ownership | Chỉ regression/contract test boundary nếu cần; triển khai history và ownership là task riêng |

## 9. Assumptions và blockers cho PLAN

- `BLOCKED` — Cần Product/API owner xác nhận nguồn browser cung cấp selected `tenantId` (header/body/query) cho `POST /api/v1/courses/{course_id}/chat`. Tài liệu Tenant chỉ xác định payload Tenant `{tenantId}`; public Chat API hiện chưa nhận selector này.
- `BLOCKED` — Cần xác nhận chính sách Origin: allowlist trực tiếp do Chat config hay trusted edge đã enforce và cách chứng minh trust. Hiện source không có bằng chứng edge enforcement; an toàn mặc định là Chat tự enforce Origin.
- `BLOCKED` — Thiếu `contracts/openapi/tenant-authorization.v1.yaml` tại base dù file được markdown tham chiếu. Cần quyết định liệu chỉ dùng implementation + markdown hay khôi phục/định nghĩa file contract làm artifact (không thay đổi endpoint behavior).
- `NOT_VERIFIED` — Public API response codes/messages mong muốn khi mapping Tenant deny/dependency sang Chat envelope chưa được chốt; Tenant internal reasonCode rõ nhưng chưa thấy Chat API public contract tương ứng.
- Các secrets thật, Tenant URL từng môi trường, deployment topology và gateway route exposure không được kiểm tra. Không thay đổi secret/deploy trong scout.

## 10. Đề xuất phương án PLAN

PLAN nên chia thành các deliverable nhỏ: (1) settings typed + validation cho `TENANT_SERVICE_URL`, `CHAT_SERVICE_TOKEN`, timeout và Origin policy; (2) async HTTPX Tenant client với explicit headers, timeout, strict success-schema parsing và allowlisted reason mapping; (3) DI/lifecycle; (4) course handler pipeline: validate Origin → call context → require trusted identity and `csrfVerified=true` for POST → call check with route `course_id` and `chat:ask` → create `TenantContext` only from verified Tenant data → invoke ChatService; (5) tests dùng ASGI `dependency_overrides` và HTTPX mock transport covering full matrix subset and call ordering. Giữ fail-closed cho mọi lỗi không biết và không thêm history/feedback/gateway.

Chốt API input cho selected tenant, Origin trust boundary, public error mapping và xử lý contract YAML trong brainstorm/plan trước khi COOK. Sau khi PLAN được phê duyệt, triển khai và chạy test stage tách biệt; không dùng test history làm bằng chứng cho code tích hợp.

## 11. Commands/checks

- `git fetch origin --prune` — hoàn tất.
- Xác minh `git rev-parse origin/Linh` và ancestry với commit dự kiến — khớp.
- Source inspection trên detached worktree `fa481e1` — hoàn tất.
- Build/typecheck/test — **không chạy** (Scout stage; không tuyên bố PASS).
- Git diff/code change — không có production code changes.
