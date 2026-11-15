# Plan: Secure Chat Authentication & Authorization

- Task ID: `2026-11-14-04-01-chat-auth`
- Status: `APPROVED (Technical Lead, 2026-11-15) — implementation blocked pending dependencies`
- Inputs: `docs/reports/2026-11-14/2026-11-14-04-01-chat-auth-scout.md`, `docs/reports/2026-11-14/2026-11-14-04-01-chat-auth-brainstorm.md`, `docs/handoffs/2026-11-14-04-01-chat-auth.md`
- Baseline: `feat/chat-persistence` at `a8d548fa1d6b3bb603e151d2215f53daf7436d2f`

## 1. Objective and background

Secure all public Chat APIs. Technical Lead conditionally accepted architecture B for course chat: Chat sends `courseId` and a server-selected action; Tenant resolves `tenantId` from its course data, forwards `tokenAdmin` to Auth introspection, checks membership/course ACL and returns verified identity, scope and decision. This resolve-by-course contract is proposed and requires owner 02 approval/implementation. The existing `POST /internal/authorization/check` accepts `tenantId`, `courseId`, `action` and on success already returns `allowed`, `tenantId`, `userId`. Do not describe it as missing verified identity fields or claim it resolves tenant from course.

## 2. Scope and non-goals

Scope: course chat, personal chat, continuation, conversation list/detail/delete, both feedback routes, trusted context/dependencies, fail-closed error handling, OpenAPI/config examples and tests. Preserve separate health and internal LLM bearer protection.

Non-goals: trust identity headers or defaults; share Auth JWT secret; alter Document retrieval implementation; merge/rebase PR #8; create branches/PRs; production migration. Personal/no-course, tenant selection, action/revoke policy and reason-code contracts are blocked pending owners. No endpoint may ship with anonymous/default fallback.

## 3. Current-state findings

- **VERIFIED** Course/personal chat and conversation/feedback controllers use client `X-User-Id`/`X-Tenant-Id` or defaults. `app/core/security.py` has an unimplemented verifier. Sources: `services/chat-service/app/api/controllers/chat_controller.py`, `conversation_controller.py`, `feedback_controller.py`, `app/core/security.py`.
- **VERIFIED** Tenant `/internal/authorization/check` uses `CHAT_SERVICE_TOKEN`, forwards cookie to Auth with `AUTH_TENANT_TOKEN`, and returns verified user/tenant plus allow on success. It currently requires tenantId. Sources: `services/tenant-service/routes/internal.route.ts`, `controllers/internal.controller.ts`, `helpers/auth.helper.ts`.
- **VERIFIED** Auth and Tenant both have 401 paths for invalid service credentials and invalid session. Chat contract's `saas_session` name is provisional; Auth issues `tokenAdmin`. See Scout report and `contracts/openapi/chat.yaml`.
- **VERIFIED** Feedback service fetches message by ID and checks assistant role without validating parent conversation ownership/scope. PR #8 persistence/history/feedback commit is ancestor of HEAD.
- **VERIFIED** Baseline branch/HEAD are above. Existing modified `services/chat-service/.env.example` and untracked user artifacts must be preserved. Local `origin/main` is `8aaceec`; live remote status was unavailable during Scout. Connector last reported PR #8 open. Refresh before Cook.
- **BLOCKED** No confirmed no-course Chat→Tenant contract, active tenant selection, complete action matrix, stable S2S/session error reason codes, or real two-tenant Chat E2E fixture.

## 4. Proposed design

Add a Chat Tenant client only against an owner-02-approved contract. Validate status, envelope, schema, allow decision, ID formats and request/response scope binding. Create typed `AuthenticatedContext` only after validated upstream allow. `userId` comes from Auth via Tenant; `tenantId` from Tenant; `courseId` is a request selector trusted only after Tenant checks it; `requestId` is server metadata. Ignore identity headers.

Apply session dependency to the public user router and resource authorization before handlers. Course chat must be authorized before ChatService, persistence, retrieval or LLM. History/feedback may perform only a minimal owner-scoped resource lookup after session verification to resolve parent/course. Do not return content or mutate until current authorization passes. Feedback resolves message→parent conversation with verified owner/tenant predicates before role check/upsert, for both routes.

Missing/invalid session maps to 401 only when the user-session reason is known. Course deny maps to 403 per approved contract. Ambiguous upstream 401, S2S failure, timeout, 5xx, malformed 2xx, `allowed=false`, missing/mismatched identity/scope all fail closed. Exact public status mapping is contract-dependent. Health/internal LLM retain their own guards.

## 5. Files and components affected

| Path | Planned change | Task |
|---|---|---|
| `services/tenant-service/routes/internal.route.ts`, `validates/internal.validate.ts`, `controllers/internal.controller.ts`, `services/course.service.ts`, service tests | Owner 02 approves/implements resolve-by-course contract; preserve current `/check` behavior unless agreed extension | T1 |
| Auth internal controller/error helper/middleware and tests | Stable session-vs-S2S reason codes if selected by 02 | T1 |
| `services/chat-service/app/core/config.py`, `.env.example` | Tenant URL/timeout/credential after 02 confirms names; preserve existing edit | T2/T6 |
| New `services/chat-service/app/integrations/tenant_service/http_client.py`; `app/dependencies.py`; typed context module/value object | Validated client and trusted dependency graph | T2 |
| Chat `api/router.py`, `chat_controller.py`, `conversation_controller.py`, `feedback_controller.py` | Router session gate, resource authorization, remove identity header/fallback trust | T2–T5 |
| Chat `services/chat_service.py`, `conversation_service.py`, `feedback_service.py`; domain repositories and `repositories/postgres/*` | Required context and scoped parent/owner lookups before reads/writes | T3–T5 |
| `contracts/openapi/chat.yaml` | Actual cookie, CSRF, route and agreed errors/security | T6 |
| Chat `tests/unit/*`, `tests/integration/test_chat_api.py`, new Tenant client tests, `test_postgres_repository.py` | Unit/ASGI/DB security assertions | T2–T7 |
| `test/platform.integration.ts`, approved sandbox fixtures/Compose and Tenant tests | Real contract and two-tenant E2E, only with owner/runtime support | T1/T7 |

## 6. Ordered implementation tasks

| ID | Task / owner / state | Files | Verification | Expected | Dependency |
|---|---|---|---|---|---|
| T1 | Settle Chat→Tenant contract, auth reason codes, actions, credentials, cookie forwarding and no-course/revoke policies. Owner 02. **BLOCKED** | Tenant routes/validation/controller/service/tests; Auth internal/error tests; contracts/config owned by 02 | Owner-approved contract tests; `npm run build --workspace=services/tenant-service`; `npm run build --workspace=services/auth-service` | Executable request/response; session 401 distinguished from S2S; no guessed API | None |
| T2 | Trusted auth context and FastAPI dependencies/client. Owner 04. **BLOCKED** on T1 for wire contract | Chat config/example, new Tenant client, dependencies, typed context, router and unit tests | `python -m pytest -p no:cacheprovider -q tests/unit` in Chat service | Missing/invalid session rejected; malformed/mismatched upstream never creates context; headers ignored | T1 |
| T3 | Secure course chat and continuation before ChatService/RAG/LLM/write. Owner 04. **BLOCKED** | Chat controller/service, context/client, ASGI tests | `python -m pytest -p no:cacheprovider -q tests/integration/test_chat_api.py tests/integration/test_retrieval_client.py` | Authorized succeeds; deny/upstream fault has zero downstream calls/writes | T1,T2 |
| T4 | Secure personal chat and list/detail/delete/history policy. Owner 04. **BLOCKED** no-course/selection/revoke decisions | Chat/conversation controllers/services/repositories, approved Tenant/Document contract, tests | Targeted ASGI and repository tests; assert scoped predicates and no cross-tenant result | No fallback; personal/history operations only touch approved scope | T1,T2 |
| T5 | Secure standard and legacy feedback through parent conversation. Owner 04. **BLOCKED** action/revoke decision | Feedback controller/service; message/conversation repository interfaces and Postgres implementations; tests | `python -m pytest -p no:cacheprovider -q tests/integration/test_chat_api.py tests/integration/test_postgres_repository.py` | Cross-tenant/owner feedback does not disclose or mutate; authorized upsert remains idempotent | T1,T2; serialize with T4 due shared repository files |
| T6 | Error mapping, config, OpenAPI, logging, gateway/CSRF alignment. Owner 04 + 02/platform. **BLOCKED** | Chat error/config/OpenAPI/router tests; gateway/Compose only if approved | Chat tests; OpenAPI validator if available; captured-log/error tests; static route/header scan | Agreed statuses, secrets scrubbed, every user route guarded; health/LLM unchanged | T1–T5 |
| T7 | Unit, ASGI stub, Auth/Tenant integration and real two-tenant E2E. Owner 04 + 02/QA. **BLOCKED** for real fixture/runtime | Chat tests, `test/platform.integration.ts`, approved fixtures/Compose | `python -m pytest -p no:cacheprovider -q tests`; `npm run test:platform`; documented sandbox E2E command after confirming it | Stubs verify faults; real services prove two-session isolation. If unavailable, explicitly BLOCKED | T1–T6 |

Parallelism: T1 can run independently under owner 02. T4 and T5 share controllers/repositories and remain serial under one owner. T2–T7 follow dependencies. Separate owners require coordination record and isolated worktrees before execution.

## 7. Dependencies and prerequisites

| Item | Owner | State / gate |
|---|---|---|
| Resolve-by-course request/response and not-found/deny semantics | 02 Tenant | **BLOCKED — requires owner 02 approval/implementation** before T2/T3 |
| Session-invalid vs service-auth reason codes | 02 Auth/Tenant | **BLOCKED — requires owner 02 approval/implementation** before correct 401 mapping |
| `CHAT_SERVICE_TOKEN` provisioning, rotation, URL/network/timeout | 02 ops | **BLOCKED** before live integration |
| Personal/no-course tenant and document contract, multi-tenant selector | 02 + Document + Product | **BLOCKED** before T4/release of personal route |
| Actions and read/history policy after revoke | 02 + Product | **BLOCKED** before T4/T5 |
| CSRF, Origin, gateway cookie forwarding and Chat route | 02 + platform | **BLOCKED** before deployment |
| Two-tenant real fixture and runnable services | 02 + QA | **BLOCKED** before E2E acceptance |
| Refreshed PR #8/remote state and branch strategy | Technical Lead + Chat owner | **BLOCKED** before Cook branch setup |

## 8. Testing and verification strategy

Use Chat `python -m pytest -p no:cacheprovider -q tests` in `services/chat-service`; Node checks are `npm run build --workspace=...` and `npm run test:platform`. Confirm any sandbox E2E command against live docs before running. Stub tests do not count as real-service E2E.

| Acceptance criterion | Check | Level |
|---|---|---|
| AC1 Missing cookie returns 401 before work | Parameterized missing/empty cookie on every public user route; assert zero service/RAG/DB calls | ASGI |
| AC2 Invalid/expired session returns 401 | Auth/Tenant integration plus Chat mapping from stable `SESSION_INVALID` | Service integration |
| AC3 Spoof headers cannot change principal/scope | Valid cookie plus forged headers; inspect typed context and outbound Tenant response | ASGI + service integration |
| AC4 A may chat course A; A denied course B gets 403 | Two real accounts/courses, Tenant ACL; zero side effects for deny | Service integration |
| AC5 A cannot read/delete B conversation | Bidirectional scoped list/detail/delete; assert B rows/content unchanged | ASGI + DB integration |
| AC6 A cannot feedback on B message via either route | Both routes A→B and B→A; assert no cross-scope read/write | ASGI + DB integration |
| AC7 Revocation behavior follows approved policy | Revoke membership/enrollment then repeat chat/continuation/history/feedback | Service integration + E2E |
| AC8 Timeout/unavailable/5xx fail closed | HTTP transport fault cases; zero RAG/LLM/DB writes | Unit + ASGI stub |
| AC9 Malformed 200, `allowed=false`, missing/mismatched IDs never authorize | Parameterized response schema and scope tests | Unit + ASGI stub |
| AC10 Wrong S2S credential is not user 401 | Wrong credential at both hops with reason-code mapping | Service integration |
| AC11 Unauthorized requests do not mutate DB | Before/after DB snapshot and UoW/repository spies | ASGI + DB integration |
| AC12 Unauthorized requests invoke no retrieval/LLM | Dependency spies/counters for every denial/fault | Unit + ASGI |
| AC13 Real two-tenant/two-session isolation includes evidence | A↔B chat, evidence, history, continuation, delete and feedback | E2E; BLOCKED without fixture/runtime |
| AC14 Health and internal LLM guards remain intact | Health smoke and missing/wrong/correct LLM bearer regression | Unit + ASGI |
| AC15 No public identity-header/default trust or secret leaks | Route table/static scan and captured logs/error responses | Unit + manual review |

## 9. Risks and mitigations

- Contract drift: current `/check` already returns verified IDs but requires tenantId. Keep this distinct from proposed resolve-by-course contract and add contract tests first.
- No-course routes: block release until contract exists; no default tenant or partial protection.
- Ambiguous 401: map to technical failure unless owner-approved reason proves user session invalid.
- Revoke race: decide consistency/transaction semantics and reauthorize per request.
- Feedback/history IDOR: scoped parent lookup and bidirectional tests.
- PR #8 overlap: controllers, repositories, tests, OpenAPI and env overlap; refresh remote state before selecting stacked versus post-merge work.
- Existing user work: preserve modified `.env.example` and all untracked artifacts; inspect diffs before Cook edits.
- E2E environment: mark blocked when unavailable; never claim stubs prove E2E.
- Secrets/privacy: scrub credentials and raw upstream bodies; assert logs and errors contain no cookie/JWT/bearer.
- Performance: bounded Tenant timeout, avoid redundant calls within request where contract permits; do not add auth cache without revocation design.

## 10. Acceptance criteria

- [ ] AC1 Every public user route rejects missing session before service, retrieval, LLM or DB access.
- [ ] AC2 Invalid/expired session returns 401 only from a confirmed session-invalid outcome.
- [ ] AC3 `X-User-Id`/`X-Tenant-Id` never alter trusted context.
- [ ] AC4 Tenant-approved course succeeds; unauthorized course returns 403 with no side effects.
- [ ] AC5 Cross-tenant/owner conversation operations are isolated.
- [ ] AC6 Both feedback routes reject cross-tenant/owner message IDs before mutation.
- [ ] AC7 Revoke behavior matches explicitly approved policy.
- [ ] AC8 Auth/Tenant timeout, unavailable and 5xx fail closed.
- [ ] AC9 Malformed 2xx, deny, missing or mismatched scope never produces trusted context.
- [ ] AC10 S2S failure/ambiguous upstream 401 is not classified as user invalid session.
- [ ] AC11 Unauthorized requests do not write Chat data.
- [ ] AC12 Unauthorized requests invoke neither retrieval nor LLM.
- [ ] AC13 Real two-tenant/two-session E2E proves bidirectional conversation, feedback and evidence isolation.
- [ ] AC14 Health and internal LLM policies retain their own protection.
- [ ] AC15 No user route trusts identity headers/defaults; secrets do not leak in logs/errors.

## 11. Rollback or recovery

Before Cook, refresh Git/PR state and review all pre-existing work. If owner 02 contracts are delayed, keep dependent tasks blocked; do not ship routes with fallback. Roll back only this change's reviewed diff, never reset/stash/overwrite user work. Revert route exposure and related config together so no endpoint is left unguarded. Preserve health/LLM policies. Rerun targeted Chat and Node checks. Any schema migration requires separate approval and rollback plan; none is authorized here.

## 12. Completion checklist

- [ ] Tasks complete or explicitly deferred with owner approval.
- [ ] Every AC verified by `$test`; missing real E2E reported BLOCKED with evidence.
- [ ] `$review` outcome recorded.
- [ ] Contracts/config examples/gateway updated only after owner approval.
- [ ] Handoff records Cook/Test/Review outcomes.
- [ ] No credentials or session values appear in artifacts.
- [x] Plan status records Technical Lead's conditional approval. Approval does not clear implementation blockers.
