# Plan: Secure Chat Authentication & Authorization

- Task ID: 2026-11-14-04-01-chat-auth
- Status: APPROVED WITH CONDITIONS — Technical Lead, 2026-11-16; architecture A for course chat. Implementation remains blocked by conditions and explicit Cook authorization.
- Original approval: Technical Lead, 2026-11-15; conditional approval of architecture B for course chat. Retained as approval history; superseded for current course-chat direction by the 2026-11-16 decision.
- Current decision: reuse existing Tenant POST /internal/authorization/check. X-Tenant-Id is an untrusted selector only; action chat:ask is selected server-side; create trusted userId/tenantId only after validating Tenant's successful authorization response. No resolve-by-course endpoint is required for Chat.
- Technical Lead conditions: C1 do not release unprotected no-course routes; C2 AC2 depends on reliable error distinction and ambiguous upstream 401 is never treated as session-invalid; C3 before Cook refresh PR #8/main and approve branch strategy, verify credential/config readiness, and obtain explicit Cook authorization.
- Inputs: Scout Report, Brainstorm Report, living Handoff, Coordination Record.
- Baseline: documentation branch docs/04-01-chat-auth at 930f44bf4e0acd76ff2a7c531112ca0704a3ef2e; verified local main baseline 8aaceec1c4d4958e69536c622ad78dc58825ad29. Auth/Tenant code is present in that main commit and in the source checkout merged at a8d548fa1d6b3bb603e151d2215f53daf7436d2f. Remote was not fetched during this revision.
- Cook: NOT AUTHORIZED.

## 1. Objective and background

Protect every public Chat user API with an authenticated session and the applicable tenant, course, document, conversation-owner, and message-parent authorization. The service must ignore client-supplied X-User-Id and must treat X-Tenant-Id, where retained for compatibility, only as an untrusted tenant selector. No unauthenticated fallback may reach persistence, retrieval, or an LLM.

The previous Plan recorded architecture B as conditionally accepted. On 2026-11-16, the Technical Lead approved architecture A with conditions for course chat because the existing internal authorization endpoint covers the required course ACL path. The 2026-11-15 architecture B approval remains in the history; the current A approval does not authorize Cook.

Evidence from the locally available main commit 8aaceec:

- Tenant exposes POST /internal/authorization/check. Its Joi body requires tenantId, courseId, and action; action is allowlisted to course:read, document:read, or chat:ask. Route middleware verifies CHAT_SERVICE_TOKEN, then verifies tokenAdmin via Auth, then validates and runs the controller.
- On allow, Tenant returns the success envelope containing data.allowed=true, data.tenantId, and data.userId. CourseService.canAccessCourse checks active tenant, active membership, course belonging to that tenant, and role-specific assignment/enrollment. A denied check returns 403 through ServiceError handling.
- Tenant AuthClient calls POST /internal/auth/introspect using AUTH_TENANT_TOKEN and forwards the Cookie header. Auth protects its internal routes with AUTH_TENANT_TOKEN and introspect verifies tokenAdmin. Auth returns account identity in a success envelope.
- Tenant POST /internal/authorization/course is protected by DOCUMENT_SERVICE_TOKEN and has upload-specific behavior; it is not the Chat authorization contract.
- Tenant admin GET /admin/tenant/my-tenants exists, but it is a browser/session route, not a Chat service-to-service authorization contract.
- The Tenant verifyService middleware returns 401 for bad service credentials. The same internal route's verifyToken/Auth path can also produce 401 for absent/invalid session. Current AuthClient maps any Auth 401 as session-invalid, so the end-to-end reason is not reliably distinguishable to Chat.
- Chat current controllers accept identity headers and fallbacks. The Chat code has no verified authentication dependency. Course and personal chat, conversation routes, and feedback routes can construct request context from those values. Feedback does not establish ownership/scope through the parent conversation before mutation.

These facts were checked against local source corresponding to main commit 8aaceec; the remote main pointer was not refreshed in this revision. Recheck the live base before Cook.

## 2. Scope and non-goals

Scope:

- Course chat and course-scoped continuation.
- Personal documents chat and all no-course APIs, with release blocked until an approved no-course identity/scope contract exists.
- Conversation list/detail/delete and continuation.
- Standard and legacy feedback.
- Typed trusted context, FastAPI dependencies, Tenant HTTP client, response validation, error mapping, route protection, repository scoping, OpenAPI/config examples, and security tests.
- Preserve separate health and internal LLM authorization.

Non-goals:

- Do not trust X-User-Id, identity fallback values, or anonymous/default tenant.
- Do not give Chat the Auth JWT signing secret or call Auth directly for normal user identity.
- Do not use Tenant /authorization/course as the Chat contract.
- Do not create a new resolve-by-course endpoint unless the existing check endpoint proves insufficient for course chat and Technical Lead plus Member 02 approve the gap.
- Do not expose personal/history routes with incomplete authorization.
- Do not change source, contracts, config, secrets, database, or tests in this Plan revision.
- Do not update PR #12, merge/rebase PR #8 or PR #12, commit, or push.

## 3. Current-state findings

- VERIFIED — Auth internal introspection is POST /internal/auth/introspect. Internal router applies verifyService(AUTH_TENANT_TOKEN). Controller reads cookie tokenAdmin, verifies HS256 with Auth's own JWT secret, resolves account identity, and returns {code:"success", account}. See services/auth-service/routes/internal.route.ts and controllers/internal.controller.ts.
- VERIFIED — Tenant /internal/authorization/check is protected by CHAT_SERVICE_TOKEN, calls verifyToken, validates tenantId/courseId/action and invokes checkAuthorization. See services/tenant-service/routes/internal.route.ts, validates/internal.validate.ts, and controllers/internal.controller.ts.
- VERIFIED — Tenant verifyToken passes the incoming Cookie header to AuthClient.getIdentity; AuthClient calls Auth introspection with Bearer AUTH_TENANT_TOKEN and Cookie. AuthClient has a 5-second timeout and maps network failure to 503. See services/tenant-service/middlewares/admin/auth.middleware.ts and helpers/auth.helper.ts.
- VERIFIED — AuthClient validates account id/email/fullName and additionally platformRole/tokenId/csrfHash for identity. It currently maps Auth HTTP 401 to a generic 401, whether it arose at Auth's service-auth middleware or session validation.
- VERIFIED — checkAuthorization returns success data {allowed:true, tenantId, userId}; denied ACL returns HTTP 403. The endpoint does not resolve tenantId from courseId.
- VERIFIED — CourseService.canAccessCourse checks tenant active state, active tenant membership, course tenant binding, and action-specific role/assignment/enrollment. It returns false for unknown action.
- VERIFIED — /internal/authorization/course is Document-specific, protected by DOCUMENT_SERVICE_TOKEN, takes courseId only and authorizes document:upload. Do not reuse it for Chat.
- VERIFIED — GET /admin/tenant/my-tenants and tenant detail routes exist, but are browser/session routes with no Chat service credential contract. Their existence alone does not make them suitable Chat S2S endpoints.
- VERIFIED — Chat has course and personal chat, conversation list/detail/delete, continuation, standard feedback, and legacy feedback routes. Controllers consume identity headers/defaults; feedback does not prove parent conversation ownership before write. See Chat controllers/services and Scout Report.
- VERIFIED — target documentation worktree is docs/04-01-chat-auth at 930f44bf; its base is local main 8aaceec. Source worktree remains feat/chat-persistence at a8d548fa with pre-existing modified/untracked user work. The current source worktree must not be used for edits.
- VERIFIED — PR #8 was open at last confirmed check; PR #12 is the documentation Draft PR. Refresh statuses before Cook; neither PR is changed here.
- BLOCKED — no-course authorization and history/feedback action contracts are not provided by current internal check. Exact behavior after membership/enrollment revocation is not decided.
- BLOCKED — Tenant/Auth error responses lack a stable reason field separating invalid session from invalid S2S credential across both hops.
- UNKNOWN — whether deployed Chat configuration already has the correct Tenant URL, CHAT_SERVICE_TOKEN, bounded timeout, cookie-forwarding and gateway/CSRF wiring. Inspect live deployment configuration without exposing secrets before Cook.

## 4. Proposed design

### Course chat — architecture A proposal

Client sends its session cookie and course request to Chat; client may send X-Tenant-Id only as a selection hint. Chat calls the existing Tenant POST /internal/authorization/check with:

- Authorization: Bearer CHAT_SERVICE_TOKEN
- Cookie: only the required tokenAdmin session cookie (do not forward unrelated cookies)
- Body: {tenantId: selector, courseId: route course id, action:"chat:ask"}

Tenant authenticates the service, introspects tokenAdmin through Auth using AUTH_TENANT_TOKEN, checks membership, course-to-tenant binding and chat:ask ACL. On allow it returns the existing success envelope with allowed, tenantId, userId. Chat must validate HTTP status, envelope, booleans, identifiers, and response tenant binding to the requested selector before creating AuthenticatedContext. No courseId response field is assumed; the validated request/route binding supplies it, while Tenant's authorization operation is the evidence it checked that course/action tuple.

Prefer retaining X-Tenant-Id temporarily as the least-breaking selector because current Chat routes already receive/use it. It remains untrusted input and cannot grant access: Tenant must verify the authenticated user is an active member and that this exact course belongs to this tenant and permits the server-selected action. Forged or mismatched tenant selectors must be denied. In Brainstorm/Plan review, Technical Lead may prefer an explicit body field or path segment; that changes public API compatibility and must be decided before implementation. Client never chooses action.

### Trusted context and order

Construct typed AuthenticatedContext only after successful upstream validation:

- userId: Tenant response, derived from Auth-verified tokenAdmin.
- tenantId: Tenant response; compare with selected tenant and do not accept it as proof from the client.
- courseId: route parameter, bound to the successful Tenant check for chat:ask.
- action/scope: server-selected action and validated authorization result.
- requestId/correlation metadata: generated or validated by Chat; not identity.
- cookie/header values: request credentials/selector only; never copy identity headers into context.

Attach session authentication at the public user-router dependency boundary, then require route-specific authorization dependencies before controller side effects. Course chat must authorize before ChatService, persistence, retrieval/evidence, quota mutation where applicable, or LLM. No handler may call a lower service with a nullable or default identity. Health and internal LLM routes retain independent policies.

For conversation/history/feedback, first validate session. A minimal repository lookup may then use the verified userId and untrusted tenant selector as predicates to locate only the caller's resource and derive parent course/scope; do not return content, mutate, retrieve, or call LLM during this lookup. Reauthorize the resolved course/resource using an approved contract before disclosure/mutation. Query by verified owner/tenant in SQL from the first lookup to avoid IDOR and enumeration.

### No-course route policy

Existing /internal/authorization/check requires courseId and action limited to course/document/chat. Do not invent a course-less call. /admin/tenant/my-tenants is not a substitute S2S contract. Until 02 confirms the minimum contract and product policy, personal chat and no-course history routes remain BLOCKED and must not be exposed with weaker auth. Propose the smallest owner-02 change: a session-authenticated, Chat-service-authenticated authorization operation for a selected tenant and an explicit allowlisted personal/history action, returning verified userId, tenantId, allowed and reason; alternatively define a resource/course resolution operation for history that can prove owner and current access. Member 02 owns the contract/service implementation; Chat owns its client/integration.

### Error handling and fail-closed

Proposed public behavior, subject to contract/Technical Lead confirmation:

- Missing tokenAdmin at Chat: 401.
- Upstream session invalid: 401 only if a stable upstream reason proves the failure is the user's session.
- Tenant course ACL deny: 403; for nonexistent vs unauthorized course, prefer a non-enumerating response and agree exact status with 02.
- Ambiguous upstream 401, bad CHAT_SERVICE_TOKEN, bad AUTH_TENANT_TOKEN, malformed success, invalid envelope/identity, or tenant mismatch: technical failure (propose 502 for invalid upstream response/ambiguous auth failure); never classify as user 401 absent proof.
- Auth/Tenant timeout or unavailable/5xx: 503 proposed.
- HTTP 200 with allowed=false: deny; do not create context. Map to 403 only when response is a valid explicit authorization denial; malformed or contradictory payload maps to technical 502.
- Never include cookie, token, bearer, JWT or raw upstream response in logs/errors.

The immediate safe Chat behavior for an ambiguous upstream 401 is fail closed and report a technical upstream failure, while recording sanitized diagnostics. Exact reason codes require Member 02 if accurate distinction is desired. AuthClient's existing generic 401 propagation should not be treated as proof of session invalidity.

## 5. Files and components affected

| Path | Planned change | Owner/task |
| --- | --- | --- |
| services/tenant-service/routes/internal.route.ts, validates/internal.validate.ts, controllers/internal.controller.ts, services/course.service.ts, existing tests | No change needed for course chat if current contract passes integration checks; only minimal no-course/reason-code additions if approved | 02 / T1 |
| Auth internal route/controller, service security middleware, Auth tests | Add stable session-vs-S2S reason only if 02 approves; preserve auth secret ownership | 02 / T1 |
| services/chat-service/app/core/config.py and .env.example | Tenant URL/timeout/CHAT_SERVICE_TOKEN settings if absent; preserve existing unrelated .env.example edit | 04 / T2,T6 |
| Chat integration client module (new, likely app/integrations/tenant_service/http_client.py), app/dependencies.py and typed context | Forward limited cookie and service bearer; validate response; provide required context | 04 / T2 |
| Chat app/api/router.py and chat_controller.py | Guard user router; use course check before side effects; remove header/fallback identity | 04 / T2,T3 |
| conversation_controller.py, conversation_service.py and repositories/domain interfaces + Postgres implementations | Owner/tenant-scoped lookup and current resource authorization for list/detail/delete/continuation | 04 / T4 |
| feedback_controller.py, feedback_service.py, message/conversation repository interfaces + Postgres implementations | Resolve message→parent conversation under verified owner/scope; secure standard and legacy route | 04 / T5 |
| Chat route/error handlers and contracts/openapi/chat.yaml | Document actual tokenAdmin cookie, selector semantics, errors, CSRF/Origin contract, route security | 04 with 02/platform / T6 |
| Chat unit/ASGI/Postgres tests; Tenant/Auth tests owned by 02; test/platform.integration.ts and approved fixtures | Prove fail-closed, scoped access, and real two-tenant isolation | 04, 02, QA / T7 |
| Gateway/Compose/deployment config | Cookie forwarding, Origin/CSRF and service URL/credential wiring only after platform/02 approval; no secret values in docs | Platform/02 / T6 |

## 6. Ordered implementation tasks

Status READY means the work can start only after this revision is approved and its listed preconditions pass. BLOCKED items require the named decision/evidence; it does not authorize partial public exposure.

| ID | Task / owner / status | Files | Preconditions / dependency | Verification command or check | Expected result |
| --- | --- | --- | --- | --- | --- |
| T1 | Existing contract audit & gap resolution / Member 02 for service-side evidence, Member 04 for Chat audit / READY for audit; any service change BLOCKED until a real gap is evidenced | Existing Auth/Tenant route/controller/validator/helper/service tests; contract notes | Approved architecture A. Verify deployed /check request, envelope, denial and cookie forwarding. Do not create resolve-by-course endpoint unless a gap is demonstrated and separately approved. | npm run build --workspace=services/tenant-service; npm run build --workspace=services/auth-service; inspect focused contract-test command if present | Current contract evidence recorded; only confirmed gaps sent to 02; no unnecessary endpoint. |
| T2 | Trusted auth context, FastAPI dependencies and Tenant client / Member 04 / BLOCKED pending C3 and explicit Cook authorization | Chat app/core/config.py, .env.example (preserve existing changes), new integration client/context, app/dependencies.py, route tests | Confirm Tenant URL, CHAT_SERVICE_TOKEN readiness, timeout, cookie forwarding and wire contract; safe ambiguous-401 handling or approved reason code. | python -m pytest -p no:cacheprovider -q tests/unit from services/chat-service | Missing cookie stops locally; only validated Tenant allow yields typed context; malformed/mismatched responses fail closed; headers ignored; no secrets logged. |
| T3 | Course chat authorization / Member 04 / BLOCKED pending T2 and explicit Cook authorization | chat_controller.py, chat service boundary, relevant RAG/persistence integration tests | T2 and C3. Use existing check with server-selected chat:ask and untrusted tenant selector. No resolve-by-course endpoint dependency. | python -m pytest -p no:cacheprovider -q tests/integration/test_chat_api.py tests/integration/test_retrieval_client.py from services/chat-service | Authorized course passes; denial/fault has zero Chat persistence/retrieval/LLM calls. |
| T4 | Personal chat, continuation and conversation APIs / Member 04 / BLOCKED for no-course authorization policy; owner-scoped query work can be designed but not exposed | conversation/chat controllers, services, domain repository interfaces, repositories/postgres, tests | 02/product define no-course tenant selection, history action, current-access/revoke policy; T2 context. | Targeted ASGI and Postgres repository tests confirmed from Chat package; assert SQL predicates and zero disclosure before reauthorization | Every route verifies owner and tenant; history/resource lookup is narrowly scoped; no-course route remains unavailable until contract is approved. |
| T5 | Standard and legacy feedback / Member 04 / BLOCKED for action/revoke policy; implementation after T2/T4 query ownership is agreed | feedback controller/service, message and conversation repository interfaces/Postgres impl, tests | T2; parent scope/feedback action and revoke policy; serialize repository edits with T4 | python -m pytest -p no:cacheprovider -q tests/integration/test_chat_api.py tests/integration/test_postgres_repository.py from services/chat-service | Both routes resolve message→parent with verified owner+tenant predicates before mutation; cross-scope ID yields non-disclosing deny/not-found. |
| T6 | Error handling, config, OpenAPI, CSRF/gateway alignment / Member 04 with Member 02 and platform / Chat mapping READY only after Cook gate; deployment BLOCKED | Chat config/error handling/OpenAPI/router tests; platform gateway files only by platform owner | C2 error distinction; C3 credentials, URL, timeout and branch/base checks; confirm Origin, CSRF and cookie handling | Chat tests, OpenAPI validation only if validator exists, captured-log assertions, route/header static scan | Missing local cookie/session-proven invalid maps 401; ACL deny maps 403; ambiguous upstream 401/S2S maps technical error; timeout 503; malformed 2xx 502; secrets scrubbed. Health and internal LLM guards unchanged. |
| T7 | Security tests and real E2E / Member 04 + Member 02/QA / unit-stub tests follow implementation; real E2E BLOCKED until fixture/environment exists | Chat unit/ASGI/Postgres tests; Auth/Tenant tests by 02; test/platform.integration.ts and approved two-tenant fixtures | T1–T6 appropriate to each case; C3 and real sessions/two-tenant fixture for acceptance | python -m pytest -p no:cacheprovider -q tests from services/chat-service; npm run test:platform only if script exists; documented real E2E command after environment discovery | Stub tests prove mapping/side-effect guards; service integration proves contracts; two real users/sessions prove bidirectional isolation. Mock tests cannot substitute for E2E acceptance. |

Execution order: after revision approval, T1 audit may run in parallel with T2 client skeleton limited to confirmed contract fields; do not freeze an incompatible wire schema. T2→T3. T4 and T5 serialize where repository files overlap and remain blocked from release by no-course/revoke decisions. T6 coordinates platform-owned files exclusively. T7 follows each implementation task and final integration. No task is authorized to begin Cook by this Plan revision alone.

## 7. Dependencies and prerequisites

| Dependency | Owner | Minimum decision/evidence | Impact |
| --- | --- | --- | --- |
| Existing course check is the accepted Chat contract | Technical Lead approved 2026-11-16; 02 confirms deployed contract | Confirm request {tenantId,courseId,action}, forwarded tokenAdmin, response envelope, allowed and verified IDs; integration test. No resolve-by-course endpoint required. | T1/T2/T3 |
| Tenant selector channel | Technical Lead + Chat owner, 02 consulted | Prefer existing X-Tenant-Id temporarily for compatibility, explicitly untrusted; Tenant verifies membership and course binding. Decide if API changes to body/path are warranted. | T3/public compatibility |
| Personal/no-course authorization | Member 02 + Product/Document owner | Existing API is not sufficient; approve minimum S2S contract or an explicitly authorized alternative, actions and returned verified scope | T4/T5 and route release BLOCKED |
| Multi-tenant selection | Member 02 + Product | Selector is not authority; define missing/ambiguous selector behavior; never implicit default | T3/T4 |
| Session vs S2S error reason | Member 02 Auth/Tenant | Stable machine-readable reason at both hops, or approve safe Chat behavior treating ambiguous 401 as technical 502 | Exact session 401 classification / T2/T6 |
| CHAT_SERVICE_TOKEN, URL, timeout, rotation | Member 02 + ops | Confirm setting names, secret injection, least privilege, rotation, network path, bounded timeout; do not expose values | T2/T6/T7 |
| Cookie forwarding, CSRF, Origin, gateway | Member 02 + platform | Confirm only tokenAdmin is forwarded, browser Origin/CSRF responsibility and deployed gateway behavior | T2/T6/release |
| Revoke behavior | Member 02 + Product | Define history/feedback/chat access after membership or enrollment revoke and tests | T4/T5 |
| Real two-tenant fixture | Member 02 + QA | Runnable Auth/Tenant/Chat environment and two independent real sessions/users | T7 acceptance BLOCKED until evidenced |
| C1 no-course release gate | Technical Lead | Do not expose any personal/no-course route until its authentication and tenant/document/resource authorization contract is implemented and tested | T4/T5/release |
| C2 error distinction | Technical Lead + Member 02 | AC2 requires explicit session-invalid evidence. Ambiguous upstream 401 is a technical failure, never user-session-invalid. | T2/T6/AC2 |
| C3 pre-Cook readiness | Technical Lead + Chat owner + Member 02/ops | Refresh PR #8 and main; choose post-merge or explicitly approved stacked branch; verify Tenant URL, CHAT_SERVICE_TOKEN injection/rotation, timeout and cookie/gateway readiness; separately authorize Cook | All Cook tasks |
| PR #8 / PR #12 integration path | Technical Lead + Chat owner | Refresh PR and main; PR #8 currently open at last confirmed state. Prefer security branch from refreshed main after #8 merges; stacked only with explicit approval. Keep docs PR #12 separate and documentation-only. | Cook branch setup |

## 8. Testing and verification strategy

Commands below are proposed based on current package configuration. Before execution, confirm exact test scripts; Tenant package currently exposes build/typecheck but no test script in its package.json. Chat pyproject config identifies pytest and tests directory. Do not claim tests passed until run in Cook/Test.

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 Missing tokenAdmin on every public user route returns 401 before work | Parameterized ASGI requests; assert no DB/retrieval/LLM invocation | ASGI |
| AC2 Invalid/expired session returns 401 only when invalid-session reason is explicit | Auth/Tenant integration; ambiguous 401 separately asserts technical failure | Service integration |
| AC3 Forged X-User-Id/X-Tenant-Id cannot alter trusted principal | Valid cookie with forged headers; compare context and upstream auth result | ASGI + service integration |
| AC4 User A can chat course A; A outside course B ACL gets 403 | Real check contract and distinct tenant/course; deny has zero writes/downstream calls | Service integration |
| AC5 Tenant A cannot list/read/delete Tenant B conversation | Bidirectional scoped DB tests; ensure no resource content or mutation | ASGI + Postgres integration |
| AC6 Tenant A cannot feedback on B message via standard or legacy route | Bidirectional message→parent lookup and database unchanged | ASGI + Postgres integration |
| AC7 Revoked membership/enrollment follows approved policy | Revoke then retry chat, continuation, history and feedback | Service integration + E2E |
| AC8 Auth/Tenant timeout, unavailable, or 5xx fails closed | Stub fault matrix; zero DB writes/retrieval/LLM | Unit + ASGI |
| AC9 Malformed 200, missing/invalid IDs, tenant mismatch, or allowed=false never authorizes | Schema/binding matrix; distinguish explicit denial from malformed response | Unit + ASGI |
| AC10 Bad CHAT_SERVICE_TOKEN/AUTH_TENANT_TOKEN is not mislabeled session 401 | Wrong credential at each hop; assert technical error absent stable reason | Service integration |
| AC11 Unauthorized requests do not mutate Chat DB | Before/after state and repository spies | ASGI + Postgres |
| AC12 Unauthorized requests do not retrieve evidence or call LLM | Call counters for all deny/error branches | Unit + ASGI |
| AC13 Two real tenant sessions prove bidirectional isolation including evidence | A↔B course chat, evidence, history, continuation, delete, both feedback routes | Real E2E; BLOCKED until fixtures/runtime |
| AC14 Health and internal LLM guards do not regress | Health smoke; LLM route missing/wrong/correct bearer tests | Unit + ASGI |
| AC15 No public route trusts identity defaults and no secret leaks | Route inventory/static scan and captured logs/errors | Unit + manual review |

Layer separation: unit tests stub Tenant client/errors; ASGI integration uses upstream stubs and Chat DB test fixtures; service integration runs actual Chat↔Tenant↔Auth and verifies contracts; E2E uses two distinct tenant/user accounts and real tokenAdmin sessions. Stub success is not evidence of E2E isolation.

## 9. Risks and mitigations

- Tenant selector confusion: preserve compatibility only if desired, document it as an untrusted selector, and require Tenant membership/course binding. Forged selector can cause denial but cannot select another identity.
- Contract drift: pin integration tests to the actual envelope and body. Existing endpoint does not derive tenant from course; do not silently change this fact.
- Ambiguous 401: current middleware can conflate service and session failures. Fail closed as technical failure unless stable reason proves user session invalid.
- No-course routes: no suitable S2S authorization contract confirmed. Keep these routes blocked rather than adding fallback or misusing admin UI routes.
- Cross-tenant IDOR: every resource lookup uses verified owner/scope from the first database predicate; resolve parent before feedback mutation.
- Revocation: reauthorize each request; avoid cache. Product must decide read-after-revoke behavior.
- Existing work / PR overlap: docs worktree has its own branch. Do not touch source worktree changes; before Cook refresh main and PR #8. Chat controllers, repositories, tests and .env.example overlap with #8.
- Secret/privacy: forward only required cookie; never log credentials or raw upstream body.
- Performance: bounded HTTP timeout and connection reuse; no authorization cache without explicit expiry/revoke design.
- Non-enumeration: align status/body for missing and unauthorized course/resource before exposing existence.

## 10. Acceptance criteria

- [ ] AC1 Every public user route rejects a missing session before persistence, retrieval, or LLM.
- [ ] AC2 Invalid/expired session maps to 401 only from confirmed session-invalid evidence.
- [ ] AC3 X-User-Id and X-Tenant-Id spoofing cannot alter authenticated identity; tenant selector alone grants no access.
- [ ] AC4 Tenant-approved course chat succeeds; denied course access is blocked before any side effect.
- [ ] AC5 Conversation list/detail/delete/continuation are owner- and tenant-scoped and disclose no cross-scope data.
- [ ] AC6 Standard and legacy feedback verify message→parent conversation owner/scope before write.
- [ ] AC7 Membership/enrollment revoke behavior matches approved policy.
- [ ] AC8 Auth/Tenant unavailable, timeout, and 5xx fail closed.
- [ ] AC9 Malformed or mismatched upstream success and allowed=false never create trusted context.
- [ ] AC10 S2S credential failure or ambiguous upstream 401 is not represented as user 401.
- [ ] AC11 Unauthorized requests do not mutate database.
- [ ] AC12 Unauthorized requests do not call retrieval/evidence or LLM.
- [ ] AC13 Real two-tenant/two-session E2E demonstrates isolation in both directions, including conversation, feedback, and evidence.
- [ ] AC14 Health and internal LLM routes retain their independent guards.
- [ ] AC15 No public route trusts identity headers/default identities; secrets are absent from logs/errors.

## 11. Rollback or recovery

No source changes are authorized in this revision. Before Cook, refresh the chosen base/PR states, compare all affected paths and preserve the source worktree's pre-existing .env.example modification and untracked artifacts. If the current Tenant contract changes or is unavailable, keep dependent routes blocked and return to Plan; do not ship a partial fallback. Roll back only the reviewed security diff, including route exposure/config as one unit, and rerun targeted checks. No migrations are expected; any discovered migration requires a new approval and recovery plan.

## 12. Completion checklist

- [x] Technical Lead approved architecture A with conditions on 2026-11-16; conditions remain tracked below.
- [ ] T1 contract audit records actual /check request, response, error behavior, and only genuine gaps.
- [ ] Tasks complete or explicitly deferred with owner approval.
- [ ] Every AC verified by $test; real E2E marked BLOCKED if environment is absent.
- [ ] $review outcome recorded.
- [ ] OpenAPI/config/gateway changes match confirmed contracts and contain no secrets.
- [ ] Handoff records Plan revision and later stage outcomes.
- [ ] No source/config/test or PR changes were made during this Plan revision.
- [ ] C1: no unprotected no-course route is released.
- [ ] C2: AC2 is verified only with reliable session-vs-S2S distinction; ambiguous upstream 401 is treated as technical failure.
- [ ] C3: PR #8/main, branch strategy, and credential/config readiness are checked before Cook.
- [ ] Cook remains NOT AUTHORIZED until explicit Cook authorization after conditions and branch preflight.
