# Brainstorm 04-01 — Secure Chat Authentication & Authorization

Task ID `2026-11-14-04-01-chat-auth` · Ngày 2026-11-15 · Giai đoạn Brainstorm

## Problem statement

Yêu cầu đã chấp nhận ở Scout: “Không sử dụng `X-User-Id` hoặc `X-Tenant-Id` do client gửi làm nguồn danh tính đáng tin cậy.” Course/personal chat hiện dựng context từ các header đó hoặc fallback; conversation endpoints cũng tin header. Feedback lookup message theo ID mà chưa xác minh caller với conversation cha. Vì vậy chỉ bảo vệ course chat sẽ không bảo vệ toàn bộ public Chat API.

## Goals và non-goals

**Goals**

- Xác minh `tokenAdmin` qua Auth introspection.
- Xác minh course permission/tenant context qua Tenant.
- Bảo vệ mọi public Chat endpoint có dữ liệu cá nhân trước DB, retrieval hoặc LLM.
- Fail-closed với lỗi dependency và response upstream không hợp lệ.
- Chứng minh tenant isolation với tối thiểu hai tenant và hai phiên.

**Non-goals**

- Sửa Auth/Tenant trước khi thống nhất với owner 02.
- Thay retrieval authorization của Document.
- Chốt policy multi-tenant, revoke, CSRF hay status chưa được duyệt.
- Sửa/merge/rebase PR #8 hoặc bắt đầu Plan/Cook.

## Requirements

### CONFIRMED

- Client không được quyết định identity bằng `X-User-Id`/`X-Tenant-Id`; dùng `tokenAdmin`, Tenant cho course authorization, fail-closed khi auth/authz lỗi. Nguồn là yêu cầu task và [Scout report](2026-11-14-04-01-chat-auth-scout.md).
- Tenant hiện có `POST /internal/authorization/check`, nhận `tenantId`, `courseId`, `action`, bearer `CHAT_SERVICE_TOKEN` và cookie chuyển tiếp tới Auth. Tenant dùng `AUTH_TENANT_TOKEN` để gọi introspection. Auth/Tenant có trường hợp dùng 401 cho cả session và service credential failure. Đây là contract hiện hữu, không phải contract B đề xuất.
- Tenant `/internal/authorization/course` resolve tenant từ course cho `document:upload`; không phải endpoint Chat.
- Chat OpenAPI cookie `saas_session` còn provisional; Auth thực tế dùng `tokenAdmin`.

### PROPOSED

- Gắn auth dependency vào public API router, route-level authorization cho resource.
- Tenant trả identity và scope đã xác minh; Chat chỉ tạo trusted context sau khi validate response.
- Upstream 401 chỉ thành public 401 khi reason code xác nhận `SESSION_INVALID`; ambiguous 401 và lỗi S2S là lỗi kỹ thuật, luôn chặn.
- Scope conversation/message qua owner, tenant và parent conversation. Cả hai feedback routes dùng cùng authorization.

### ASSUMPTION

- `courseId` là selector đủ cho Tenant resolve tenant server-side.
- Cookie có thể forward tới Tenant nội bộ.
- History cần policy rõ khi course membership/enrollment bị revoke.

## Options and trade-offs

| Tiêu chí | A. Endpoint hiện tại với tenant selector | B. Tenant resolve tenant bằng courseId | C. Chat gọi Auth và Tenant riêng |
|---|---|---|---|
| Luồng | Chat → `/internal/authorization/check` `{tenantId,courseId,action}` → Auth | Chat → contract Tenant mới `{courseId,action}` → Auth; Tenant lookup course và ACL | Chat → Auth introspection rồi Chat → Tenant ACL |
| Security | Tốt nếu selector chỉ chọn scope và Tenant luôn ràng buộc user/course/tenant. Header tenant không chứng minh membership. | Tốt nhất cho course chat. Tenant là nguồn tenant-course; caller không tự khẳng định tenant. | Có thể phối hợp identity hai hop sai; Auth credential hiện có quyền rộng hơn introspection. |
| Complexity | Thấp-vừa. API có sẵn nhưng cần tenant selector và trả trusted context. | Vừa. Cần contract/validation/response và phối hợp release với 02. | Cao. Hai client, credential, timeout/error mapping và consistency. |
| Compatibility | Tái sử dụng endpoint và token hiện có; action cần nằm trong allowlist hiện tại. | Contract mới, có thể thêm route tương thích. Upload precedent không xác nhận Chat API. | Có thể gọi APIs hiện hữu nhưng Chat cần `AUTH_TENANT_TOKEN` rộng và vẫn phải gọi Tenant. |
| Performance | Một Chat→Tenant call, Tenant gọi Auth nội bộ. | Một Chat→Tenant call, thêm course lookup trong Tenant. | Ít nhất hai call từ Chat cộng Tenant→Auth, dễ introspect lặp. |
| Operational cost | Thấp. | Vừa, triển khai đồng bộ contract/credential/fixtures. | Cao hơn do secrets, monitoring và lỗi liên service. |
| Dependency | 02 xác nhận nguồn selector, action và response. | 02 thiết kế/triển khai resolve-by-course, schema, tests. | 02 cấp credential scope hẹp hoặc assertion contract và Tenant ACL API. |

### A — dùng endpoint hiện tại

Tenant selector là input chọn ngữ cảnh, không phải identity hoặc bằng chứng quyền. Tenant introspect cookie, lấy user từ Auth, kiểm course thuộc đúng tenant và ACL. Selector mismatch phải deny. Endpoint hiện bắt buộc `tenantId`; deny hiện trả 403, không trả cặp trusted identity. Cần 02 chốt selector và allow response.

### B — Tenant resolve tenant từ course

Đề xuất contract mới nhận `courseId` và action. Tenant xác thực service bearer, introspect `tokenAdmin`, lookup course để lấy tenantId từ dữ liệu mình sở hữu, kiểm membership/course/action rồi trả trusted `userId`, `tenantId`, `courseId` và decision. Deny hợp lệ không cấp context. Không mô tả route này như endpoint đang có. Course-not-found và no-access status cần chốt.

### C — Chat gọi Auth rồi Tenant

Chat cần `AUTH_TENANT_TOKEN`, hiện bảo vệ introspection lẫn `/internal/account/lookup` và `/internal/account/provision`. Auth không biết ACL course, vì vậy Chat vẫn gọi Tenant. Tenant hiện introspect lại cookie. Cần cùng identity qua hai hop hoặc assertion service mới, tăng coupling và credential exposure.

## Recommendation

**Khuyến nghị B cho course chat, chưa phê duyệt.** Tenant resolve tenantId từ course record, introspect phiên và trả decision có typed identity/scope. Cách này tránh tin tenant selector từ client và giữ ownership ACL tại Tenant.

Conversation/history/feedback cần Tenant check trên resource/course tương ứng. Personal documents và route không có course vẫn thiếu contract. Đây là blocker để đạt mục tiêu bảo vệ toàn bộ public API, cần 02 và Document xác nhận trước khi Cook.

## Trusted authentication context

| Field | Nguồn đề xuất | Quy tắc |
|---|---|---|
| `userId` | Auth introspection qua Tenant | Chỉ trusted sau response hợp lệ |
| `tenantId` | Tenant resolve và authorize resource | Không đọc từ header/body/query |
| `courseId` | Request path làm selector; Tenant kiểm tra ACL và trả scope | Không coi path là quyền |
| `requestId` | Middleware hoặc ID server tạo | Metadata, không quyết định quyền |
| `conversationId`, `messageId` | Request selector; Chat/Tenant resolve parent và ownership | Untrusted đến khi kiểm tra |
| `action` | Allowlist server theo route | Không nhận action quyền tùy ý từ client |

Gắn session dependency vào FastAPI public router; authorization dependency nhận route/resource rồi gọi Tenant trước controller. Chỉ dependency tạo context trusted sau khi validate identity, scope và `allowed`. Handler/service persistence, retrieval và LLM nhận context bắt buộc, không có fallback identity. Health và internal LLM giữ policy riêng. Route-table regression phát hiện public route thiếu dependency.

## Authorization theo public API

| API | Identity / tenant | Policy và ownership | Gate trước side effect |
|---|---|---|---|
| Course chat | `tokenAdmin`; Tenant resolve từ course | `chat:ask`; tiếp tục conversation phải kiểm owner/tenant/course và quyền hiện tại | Trước lookup message, ghi conversation, retrieval hoặc LLM |
| Personal documents chat | Session; tenant và document scope cần contract mới | Chỉ tài liệu user thuộc tenant/resource được phép | Trước DB/RAG |
| Conversation continuation | Session; resolve course/tenant từ conversation | Owner, tenant, course khớp; reauthorize theo policy hiện tại | Trước đọc message history và RAG/ghi |
| Conversation list | Session; active tenant/scope từ Tenant | Chỉ conversation owner trong scope; course filter là selector | Trước query list |
| Conversation detail/delete | Session; resolve parent scope | Query gồm conversation, owner, tenant; ngoài scope dùng 404 nếu contract giữ semantics đó | Trước trả messages hoặc cascade delete |
| Message feedback | Session; message → parent conversation → course/tenant | Assistant message thuộc conversation của caller; action feedback được phép | Scoped resolve và authorize trước upsert |
| Legacy `/feedback` | Cùng session/scope như route chuẩn | Bắt buộc chung service/dependency gate; nếu bỏ route thì cập nhật contract | Trước mọi DB lookup/write |

**Feedback:** Không dùng `get_by_id(messageId)` làm bằng chứng quyền. Resolve message cùng conversation cha theo `messageId`, `userId`, `tenantId`, rồi kiểm assistant role và feedback action. Upsert theo message/caller trong scope đã kiểm. User A biết ID của B vẫn không được đọc hoặc ghi feedback lên message B. Áp dụng giống nhau cho cả legacy route.

## Error mapping và fail-closed

| Kết quả nội bộ | Public mapping đề xuất | Trạng thái |
|---|---|---|
| Thiếu cookie, session invalid/expired, account inactive | 401 | Auth hiện trả 401; mapping Chat **PROPOSED** |
| Session hợp lệ, course ACL deny | 403 | Tenant hiện trả 403; mapping Chat **PROPOSED** |
| Course tenant mismatch/not found | 403 để che hoặc 404 | **PROPOSED**, cần contract thống nhất |
| Sai `CHAT_SERVICE_TOKEN` hoặc Tenant→Auth credential | Technical 5xx | **PROPOSED**; tuyệt đối không biến thành user 401 |
| Upstream 401 không có reason code | Technical 5xx | **PROPOSED** vì không xác định được credential nào sai |
| Auth/Tenant timeout, unavailable, 5xx | 503 | **PROPOSED**, fail-closed |
| HTTP 200 schema sai hoặc malformed JSON | 502 | **PROPOSED**, fail-closed |
| HTTP 200 `allowed=false` với schema hợp lệ | 403 | **PROPOSED** deny, không tạo context |
| Response thiếu/sai `userId`/`tenantId` hoặc scope mismatch | 502 | **PROPOSED**, không cấp quyền |

02 cần reason code ổn định để phân biệt `SESSION_INVALID`, `SERVICE_UNAUTHORIZED`, `AUTHZ_DENIED`, `AUTH_UNAVAILABLE`, `INVALID_AUTHZ_RESPONSE`. Không log cookie/JWT/bearer, auth headers, raw upstream body, PII hoặc identifier ngoài scope. Log request ID, action, latency và outcome đã scrub. Mọi lỗi dừng trước retrieval/LLM và write.

## Edge cases

- User ở nhiều tenant; selector chỉ chọn scope, Tenant vẫn kiểm membership.
- Revoke membership, enrollment, assignment hoặc course giữa các request/continuation.
- Hai request chat/revoke cạnh tranh; phải chốt semantics thời điểm authorization.
- Course/message/conversation sai định dạng, xóa, inactive, đoán được hoặc mismatch parent.
- HTTP 200 với `successful:false`, thiếu `allowed`, ID sai, identity mismatch hoặc JSON lỗi.
- RAG timeout sau khi request ghi user message; cần transaction/rollback policy, nhưng auth phải xong trước write.
- CSRF/Origin, CORS, gateway cookie forwarding và legacy route direct invocation.
- `personal_only`, `combined`, history đa course cần contract rõ.

## Decision matrix với thành viên 02

| Quyết định / owner | Lựa chọn | Khuyến nghị | Ảnh hưởng | Blocker |
|---|---|---|---|---|
| Chat→Tenant course contract · 02 Tenant | A selector; B resolve course | B | API/schema/validator/response | Có cho course chat |
| Personal/no-course · 02 + Document | Membership và personal document ACL | Tenant xác nhận tenant; Document kiểm tài liệu | Route không course | Có cho toàn API |
| Multi-tenant selection · 02/Product | Selector, mặc định hoặc buộc chọn | Selector input, server validate, không default ngầm | UI/history scope | Có khi user đa tenant |
| Sau revoke · 02/Product | Chặn hết; history read-only; giữ read | Chặn course action theo quyền hiện tại, product xác định retention | Quyền đọc lịch sử | Có |
| `CHAT_SERVICE_TOKEN` · 02/ops | Shared hoặc riêng | Riêng và scope tối thiểu | Secret provisioning/rotation | Có trước integration |
| S2S/session errors · 02 Auth/Tenant | HTTP-only hoặc reason codes | Reason codes tách `SESSION_INVALID` khỏi S2S | Error mapping | Có cho 401 đúng |
| Cookie/CSRF/Origin/gateway · 02/platform | Forward và guard gateway/Chat | Chốt trust boundary, Origin và unsafe methods | Deployment/security | Có trước release |
| Actions · 02 + Chat | Reuse `chat:ask`, thêm actions | Allowlist theo route, gồm history/feedback | Validator/ACL | Có |
| Hai tenant fixture · 02 + QA | Stub, live, E2E | Stub fault matrix + E2E thật | CI/services | E2E chặn nghiệm thu |

## PR #8 và Git strategy

Scout ghi nhận PR #8 đang mở, commit `d3fd95a` là ancestor của HEAD `a8d548f`. Baseline local đã có persistence/history/feedback của PR. Đề xuất dùng HEAD này sau khi xác minh lại remote/main trước Plan. Tách security PR để review scope, theo thứ tự chốt contract → thay đổi Auth/Tenant của 02 → Chat dependencies/routes → integration tests. Không merge/rebase PR #8 trong Brainstorm. File xung đột gồm `chat_controller.py`, `conversation_controller.py`, `feedback_controller.py`, `dependencies.py`, router/context/services/repositories, `test_chat_api.py`, Chat OpenAPI, `.env.example` và sandbox Compose. Giữ nguyên thay đổi local/untracked đã ghi nhận trong Scout.

## Acceptance criteria đề xuất

Tất cả là **PROPOSED**, chưa được duyệt:

1. Thiếu cookie trả 401; cookie sai trả 401; không gọi RAG/LLM và không ghi DB.
2. Header giả mạo không đổi identity/scope với cookie hợp lệ.
3. User A được course A; course B ngoài quyền trả 403, không retrieval/write.
4. Auth/Tenant timeout, unavailable, 5xx, credential failure, ambiguous 401 và malformed response fail-closed.
5. Conversation list/detail/delete/continuation không truy cập resource ngoài scope.
6. User A không gửi feedback lên message B qua route chuẩn hoặc legacy; test ngược B→A.
7. Revoke behavior khớp policy được duyệt.
8. Hai tenant/hai session thật chứng minh cô lập conversation/message/feedback/evidence hai chiều.
9. Route regression chứng minh mọi public endpoint có guard; error/log không lộ secret.

## Test matrix

| Layer | Kiểm thử | Chứng cứ mong đợi |
|---|---|---|
| Unit | Cookie/session, deny, malformed 200, `allowed=false`, ambiguous 401, timeout/5xx, S2S sai | Status đúng; zero retrieval/LLM/DB writes |
| ASGI + upstream stub | Header spoof, course A/B, conversation B, hai feedback routes, list/detail/delete | Trusted context đúng; cross-scope trả deny/404; không side effect |
| Auth/Tenant integration | Hai users/tenants, session expiry/inactive, membership/course revoke, sai credential hai hop | Contract và reason codes thật; identity từ Auth |
| E2E hai tenant | A→B và B→A chat, history, continuation, delete, feedback, evidence | Không rò data/evidence; zero cross-tenant mutations |
| Regression | Health, internal LLM bearer, route table, persistence/cascade | Luồng riêng còn đúng; mọi public user route được bảo vệ |

Không có test mới nào được chạy trong Brainstorm. Dùng counters/mocks cho downstream calls và so sánh DB trước/sau cho side effects.

## Quyết định chờ Technical Lead

- Chọn B cho course chat, hay A nếu đã có tenant selector phù hợp.
- Chốt phạm vi auth cho personal documents, history, continuation và legacy feedback.
- Chấp thuận ambiguous upstream 401 → technical 5xx.
- Chốt multi-tenant selection và policy sau revoke.
- Chấp thuận baseline đã tích hợp #8 và security PR riêng.
- Chỉ định owner/deadline quyết định 02 trong bảng.

Đề xuất bước kế tiếp là `$plan` sau khi Technical Lead duyệt thiết kế. Brainstorm dừng ở `NEEDS DECISION`.
