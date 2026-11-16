# Coordination: 2026-11-14-04-01-chat-auth

- Integration owner: Member 04 (Chat) after Technical Lead clears Cook gate
- Integration branch: Pending Git strategy approval and refreshed main/PR #8 state
- Base commit: `a8d548fa1d6b3bb603e151d2215f53daf7436d2f` (`feat/chat-persistence`, local baseline)

| Plan task | Owner | Branch / worktree | Files owned (exclusive) | Status | Depends on |
|---|---|---|---|---|---|
| T1 Auth/Tenant contract | Member 02 | To be assigned by 02 | `services/auth-service/**`, `services/tenant-service/**`, Auth/Tenant contract artifacts and tests | `blocked` | 02 decisions below |
| T2 Trusted context/client | Member 04 | Pending Cook gate | Chat config/dependency/context and new Tenant client files | `blocked` | T1 contract and credential details |
| T3 Course chat | Member 04 | Same authorized Chat worktree | Chat controller/service and course-chat tests | `blocked` | T1, T2 |
| T4 Personal/history/continuation | Member 04 | Same authorized Chat worktree | Chat/conversation controllers/services/repositories and associated tests | `blocked` | T1 no-course, selection and revoke policy; T2 |
| T5 Feedback | Member 04 | Same authorized Chat worktree | Feedback controller/service, message/conversation repository changes and tests | `blocked` | T1 actions/revoke; T2; serialize against T4 |
| T6 Error/config/OpenAPI | Member 04 with 02/platform | Shared Chat worktree; owner per file below | Chat error/config/OpenAPI; platform-owned gateway files only by platform | `blocked` | T1–T5 and platform contract |
| T7 Security/integration tests | Member 04 with 02/QA | Test ownership to be coordinated | Chat tests by 04; Auth/Tenant tests by 02; E2E fixture by QA/02 | `blocked` | T1–T6 and real fixture |

## Shared files

No two owners may edit the same file concurrently without updating this record first. Member 02 owns all Auth/Tenant source and service tests. Member 04 owns Chat source, Chat tests and Chat OpenAPI. Platform owns gateway configuration. For `services/chat-service/.env.example` and shared sandbox Compose, Member 04 coordinates the exact diff with current local owner before touching it. Existing `.env.example` modifications and untracked user artifacts must remain intact.

Conflict-prone Chat paths include `app/api/controllers/chat_controller.py`, `conversation_controller.py`, `feedback_controller.py`, `app/api/router.py`, `app/dependencies.py`, `app/domain/value_objects/tenant_context.py`, Chat/conversation/feedback services, repositories, `tests/integration/test_chat_api.py`, and `contracts/openapi/chat.yaml`. These are assigned exclusively to Member 04. Tenant route/validator/controller/service changes are assigned exclusively to Member 02. If a contract file spans ownership, 02 drafts/owns it and 04 reviews through a proposed diff, without concurrent edits.

## Dependencies requiring Member 02 decision

| Dependency | Owner | Proposed contract | Decision requested | 04 work blocked | Expected acceptance evidence |
|---|---|---|---|---|---|
| Resolve-by-course Chat→Tenant | Member 02 / Tenant | Internal request carries `courseId`, server-allowlisted `action`, forwarded `tokenAdmin` cookie and Chat service bearer. Tenant resolves tenantId from course data, introspects Auth, applies membership/course ACL, and returns verified identity/scope/decision. This is new/proposed; existing `/internal/authorization/check` requires `tenantId` and already returns allow plus user/tenant on success. | New endpoint or approved compatible extension; deny/not-found behavior; exact route and caller authorization | T2/T3 | Tenant contract test proves course→tenant lookup and that caller-supplied tenant headers cannot set identity/scope |
| Request/response schema | Member 02 / Tenant | Strict schema for IDs, action enum, envelope, `allowed`, `userId`, `tenantId`, `courseId`, error reason and correlation ID | Required fields, casing, validation/status rules, schema version | T2/T3/T6 | Contract tests reject unknown/malformed IDs and inconsistent scope; valid allow/deny fixtures |
| Personal/history no-course auth | Member 02 with Document owner | Contract identifies session and authorized tenant/document/history scope without assuming course exists | API and action policy for personal chat, history list/detail/delete and resources spanning courses | T4 and release of personal routes | Tests show membership and ownership checks for no-course routes and no data returned before allow |
| Multi-tenant user selection | Member 02 + Product | Client selector selects context only; Tenant proves membership and authorization. No implicit default tenant. | Selector source/format, missing/ambiguous selection behavior | T4 | User in two tenants can select only an authorized context; absent/invalid selector has defined safe result |
| History/feedback after revoke | Member 02 + Product | Reauthorize resource actions on each request; retention/read-after-revoke policy explicit | Whether history is denied, read-only or selectively available after membership/enrollment revoke | T4/T5 | Integration tests revoke membership/enrollment then assert the selected read/write policy |
| Session vs S2S errors | Member 02 / Auth + Tenant | Machine-readable `SESSION_INVALID` distinct from `SERVICE_UNAUTHORIZED`, `AUTH_UNAVAILABLE`, `AUTHZ_DENIED`, malformed upstream | Codes, status semantics and propagation through Tenant | T2/T6 | Wrong S2S credentials never map to public user-session 401; invalid user session does |
| `CHAT_SERVICE_TOKEN`, URL, timeout, rotation | Member 02 / ops | Dedicated least-scope Chat→Tenant bearer, configured Tenant base URL and bounded timeout; documented rotation | Secret provisioning mechanism, env names, network path, timeout and rotation ownership | T2/T6/T7 | Non-secret config examples, deployment wiring and wrong-token/timeout tests |
| Cookie forwarding, CSRF, Origin, gateway | Member 02 + platform | Forward only required `tokenAdmin` to Tenant; define unsafe-method CSRF/Origin checks and gateway cookie route | Trust boundary, CORS/CSRF responsibility, cookie attributes and gateway route | T2/T6/release | Integration verifies cookie reaches Tenant/Auth securely and writes reject missing/invalid CSRF per contract |
| Two-tenant fixtures and live test environment | Member 02 + QA | Isolated tenant A/B, users A/B, courses, sessions, memberships and runnable Auth/Tenant/Chat dependencies | Fixture owner/lifecycle, CI/runtime availability, secrets-free test provisioning | T7 and E2E acceptance | Reproducible E2E proves bidirectional isolation for evidence, conversations, deletion and feedback |

## Integration steps

1. Member 02 resolves the tabled decisions, implements the Auth/Tenant contract and reports contract-test evidence.
2. Technical Lead refreshes PR #8/main state and approves Git path and Cook start. Preferred path is wait for PR #8 to merge, then create a security branch from refreshed main. If work must precede merge, obtain explicit Technical Lead approval for a stacked branch/PR based on PR #8.
3. Member 04 implements Chat integration against the approved contract. No shared-file concurrent edits; update this record before any ownership change.
4. Integrate contract 02 → Chat 04 → service integration tests → real two-tenant E2E.
5. Run `$test` on integrated result, then `$review`. No auto-merge. Keep Cook blocked until prerequisites are accepted.

## Plan Revision — 2026-11-16 (supersedes prior course-chat proposal for review)

This addendum records a proposal only; it does not change the original Technical Lead approval of architecture B or authorize implementation. The revised Plan proposes reusing the existing course authorization endpoint first.

### Verified existing contract

- Tenant POST /internal/authorization/check is protected by CHAT_SERVICE_TOKEN, then verifies tokenAdmin through Auth. It requires tenantId, courseId and an allowlisted action; chat:ask is supported.
- On allow, response envelope contains data.allowed, data.tenantId and data.userId. Tenant performs active membership, course-to-tenant and course ACL checks.
- The endpoint does not resolve tenant from courseId. Chat may send X-Tenant-Id only as an untrusted selector; Tenant must verify the selector against authenticated membership and the course.
- Tenant POST /internal/authorization/course is Document-specific and authorizes document:upload; do not route Chat through it.
- Tenant /admin/tenant/my-tenants is not a Chat service-to-service identity contract.
- Auth/Tenant currently can return HTTP 401 for more than one failure class. Until a reason code is confirmed, Chat must fail closed and treat ambiguous upstream 401 as technical failure, not claim the user's session is invalid.

### Revised ownership and readiness

| Work | Owner | Files exclusively owned | Status / coordination |
| --- | --- | --- | --- |
| Audit /check contract and identify only genuine gaps | Member 02 for service-side evidence; Member 04 for Chat consumer audit | Auth/Tenant source and tests remain 02-owned; Chat source/tests remain 04-owned | READY for audit after Plan re-approval; no resolve-by-course change unless evidence proves necessary and TL/02 approve |
| Course-chat trusted client/context | Member 04 | Chat config, dependency/context, new Tenant client and Chat tests | READY after Plan re-approval, actual contract/config smoke and credential provisioning |
| Course chat | Member 04 | Chat chat controller/service, retrieval/persistence guards and tests | READY after T2 and verified /check contract; action is selected server-side |
| Personal/no-course, history and continuation | Member 04 integration; Member 02 owns any Tenant/Auth contract | Chat controllers/services/repositories owned by 04; Auth/Tenant files by 02 | BLOCKED for route release until no-course scope, tenant selection and revoke policy are confirmed |
| Standard and legacy feedback | Member 04 integration; Member 02 owns any Tenant/Auth contract | Chat feedback/service/repository/tests owned by 04; Auth/Tenant files by 02 | BLOCKED for policy-dependent implementation until action and revoke decisions; parent lookup must be owner/tenant scoped |
| Error/config/OpenAPI/platform | Member 04 owns Chat files; 02 owns service contract; platform owns gateway | No concurrent editing; shared contract reviewed by proposal/diff | Chat safe mapping can be drafted after re-approval; deployment BLOCKED pending reason codes/config/CSRF/Origin |
| Tests | Member 04 owns Chat tests; 02 owns Auth/Tenant tests; QA/platform own approved E2E fixtures | Chat tests, service tests, and fixtures remain in their owner worktrees | Stub/ASGI READY after relevant work; real two-tenant E2E BLOCKED until fixture/runtime |

### Remaining Member 02 decisions and evidence

| Decision | Minimum request | Blocks |
| --- | --- | --- |
| Confirm existing course contract | Confirm deployed request {tenantId,courseId,action}, tokenAdmin forwarding, success envelope, deny behavior and tests. No new endpoint unless a gap is demonstrated. | T2/T3 wire integration |
| No-course authorization | Define the smallest Chat-authenticated S2S contract for personal chat/history and allowed actions; existing /check requires courseId and /my-tenants is not S2S. | T4/T5 and release of no-course routes |
| Error distinction | Provide a stable reason for SESSION_INVALID vs SERVICE_UNAUTHORIZED at both Tenant and Auth hops, or approve safe ambiguous-401 technical mapping. | Correct public 401 classification and operational diagnosis |
| Service credentials and runtime | Confirm CHAT_SERVICE_TOKEN injection, service URL, bounded timeout, rotation owner and network path without sharing values in docs. | Live integration/deployment |
| Cookie/CSRF/Origin/gateway | Confirm only tokenAdmin forwarding and which boundary enforces browser Origin and CSRF for unsafe requests. | Browser deployment |
| Revoke and multi-tenant policy | Confirm selected-tenant behavior and history/feedback access after membership/enrollment revoke. | T4/T5 |
| Real two-tenant fixture | Provide two tenants, two users, real sessions and repeatable Auth/Tenant/Chat environment. | T7 E2E acceptance |

The latest repository evidence for this revision is local main commit 8aaceec (also contained in source checkout merge a8d548fa); remote main was not refreshed. Before Cook, refresh the remote and PR #8/#12, preserve the source worktree's existing changes, and obtain approval for base/branch strategy. Preferred integration remains PR #8 merge followed by a fresh security branch; stacked work requires explicit Technical Lead approval. The documentation-only PR #12 remains separate.
## Technical Lead Approval Update — 2026-11-16

Decision: APPROVED WITH CONDITIONS — architecture A for course chat. This update supersedes the prior addendum's pending-approval state for the current design, while preserving the 2026-11-15 conditional approval history for architecture B. Cook remains NOT AUTHORIZED.

Approved: reuse existing Tenant POST /internal/authorization/check; X-Tenant-Id is an untrusted selector; Chat selects chat:ask server-side; trusted userId and tenantId are created only after validating Tenant's successful authorization response. No resolve-by-course endpoint is required for Chat.

### Current T1–T7 coordination

| Task | Owner | Current status | Dependencies / gate | Ownership boundary |
| --- | --- | --- | --- | --- |
| T1 — Existing contract audit and genuine gap resolution | Member 02 for Auth/Tenant evidence or changes; Member 04 for Chat consumer audit | READY for audit; any service change BLOCKED until a real gap is confirmed | Verify deployed /check request, response envelope, deny behavior and cookie forwarding. Do not create resolve-by-course API without demonstrated gap and separate approval. | 02 exclusively owns Auth/Tenant source/tests; 04 owns Chat-side audit and integration |
| T2 — Trusted auth context, dependencies and Tenant client | Member 04 | BLOCKED before Cook | Requires explicit Cook authorization, confirmed service URL/CHAT_SERVICE_TOKEN/timeout readiness, and fail-closed handling for ambiguous 401. | 04 owns Chat config, client, context, dependencies and Chat tests |
| T3 — Course chat authorization | Member 04 | BLOCKED before Cook; design uses existing check | Requires T2 and C3 preflight. Tenant action is server-selected chat:ask; selector alone never grants access. | 04 owns Chat controller/service/retrieval/persistence integration and tests |
| T4 — Personal/no-course, continuation and conversation APIs | Member 04; Member 02 owns any Auth/Tenant contract additions | BLOCKED | C1: do not release no-course routes until authentication, tenant/document/resource authorization and revoke policy are implemented and tested. | 04 owns Chat controllers/services/repositories/tests; 02 owns service-side contract |
| T5 — Standard and legacy feedback | Member 04; Member 02 owns any Auth/Tenant contract additions | BLOCKED | Requires T2, parent conversation ownership/scope checks, action and revoke policy. Both routes must prevent cross-tenant IDOR. | 04 owns feedback and Chat repository files/tests; serialize overlap with T4 |
| T6 — Error handling, configuration, OpenAPI, CSRF/gateway | Member 04 with Member 02 and platform | Chat implementation BLOCKED pending Cook; deployment BLOCKED | C2: AC2 requires reliable session-vs-S2S reason; ambiguous upstream 401 is technical failure, never session-invalid. C3 credential, cookie, Origin/CSRF and gateway readiness. | 04 owns Chat files; 02 owns Auth/Tenant contract; platform exclusively owns gateway |
| T7 — Security tests and E2E | Member 04 for Chat tests; Member 02 for Auth/Tenant tests; QA/platform for fixtures | Stub/ASGI tests follow implementation; real two-tenant E2E BLOCKED | Real fixture must include two tenants, users and tokenAdmin sessions; mocks do not satisfy E2E acceptance. | Each owner edits only their service tests/fixtures; coordinate shared harness before changes |

### Conditions C1–C3

- C1 — No unprotected no-course routes may be released. Keep T4/T5 routes blocked until their contracts and enforcement are complete.
- C2 — AC2 depends on error distinction. An ambiguous upstream 401 must fail closed as a technical failure and must not be represented as user-session-invalid.
- C3 — Before Cook, refresh PR #8 and main, confirm integration/branch strategy, verify credential/config readiness, and obtain explicit Cook authorization.

Before Cook, refresh PR #8 and main. Preferred strategy remains waiting for PR #8 to merge and branching from refreshed main; stacked implementation requires explicit Technical Lead approval. Verify Tenant URL, CHAT_SERVICE_TOKEN provisioning/rotation, bounded timeout, cookie forwarding and gateway readiness without logging or recording secret values. Deployment and live two-tenant E2E remain BLOCKED until runtime and fixtures are available. No concurrent edits across owner boundaries; update this record before any shared-file ownership change.