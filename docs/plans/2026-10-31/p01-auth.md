# Plan: P01 Auth R0 hardening

- Task ID: `2026-10-31-p01-auth`
- Status: `APPROVED (by user, 2026-10-31)`
- Approval scope: middleware reordering on the four named routes plus regression tests; Origin/JWT/CSRF order and response contract stay intact. No mail/audit changes, commit, push or merge.
- Inputs: `docs/reports/2026-10-31/2026-10-31-p01-auth-scout.md`, `docs/handoffs/2026-10-31-p01-auth.md`, P01 prompt and V4 reference cited in SCOUT. User requested `PLAN` after SCOUT; no separate Brainstorm decision exists.
- Baseline: branch `Linh` at `066baea8592f6f45e538272b947a3a2473c77305`; `git log 066baea..HEAD` and `git diff -- services/auth-service` were empty when planned. Remote freshness unknown.

## 1. Objective and background

Protect existing Auth behavior with regression coverage and close the confirmed validation-before-rate-limit gap on current browser endpoints. This is R0 hardening of existing routes, not V4 feature work. All changes are contingent on approval of this exact DRAFT.

## 2. Scope and non-goals

- In scope: existing `/admin/account/*` and `/api/v1/auth/*` browser route behavior, existing `/internal/auth/introspect`, Auth-owned regression tests and service test command. Preserve response envelope and successful login, password and introspection behavior.
- Out of scope: new endpoints, JWT/cookie rename, OAuth/SSO/MFA, new persistence, database or gateway changes, Tenant implementation, root `test/**`, shared contracts and docs owned by other tasks.
- Deferred: mail-failure token policy and audit fail-closed policy from SCOUT findings 3–4. Both need owner decisions; neither is implicitly approved by this plan. Keep introspection `tokenId` and `csrfHash` because Tenant currently requires them (`services/tenant-service/helpers/auth.helper.ts:45–51`).

## 3. Current-state findings

- **Verified:** `services/auth-service/routes/admin/account.route.ts:9–26` validates login, forgot and reset before the rate limiter. Joi rejects malformed bodies immediately (`validates/admin/account.validate.ts:9–19`), so those requests do not increment Mongo rate counters (`middlewares/security.middleware.ts:48–83`).
- **Verified:** `verifyOrigin` and `verifyCsrf` exempt GET/HEAD/OPTIONS, while other requests require configured Origin or a CSRF token (`middlewares/security.middleware.ts:14–46`). `verifyService("AUTH_TENANT_TOKEN")` guards the internal router (`routes/internal.route.ts:7`); introspection uses the cookie JWT and `AuthService.getIdentity` (`controllers/internal.controller.ts:9–16`).
- **Verified:** Shared platform tests already check login, expired/invalid JWT, rejected Origin, and concurrent reset (`test/platform.integration.ts:374–511`, `1042–1094`). Direct negative tests for internal credential and CSRF rejection were not found in SCOUT. This is a coverage gap, not evidence of a bypass.
- **Assumption to verify during Cook/Test:** a service-local MongoMemoryReplSet integration harness can run via existing `tsx`, `mongoose`, and `mongodb-memory-server` dependencies without changing root manifests. If that setup fails, report the blocker and request a plan revision; do not edit root test files.

## 4. Proposed design

1. Add service-local integration tests that start the existing Express `app` with a disposable Mongo replica set and controlled Auth environment. Use only synthetic users and secrets. Test missing/wrong service credential, missing/invalid/expired or disabled-user cookie, spoofed identity headers, valid introspection, Origin/CSRF rejection, GET behavior and existing response shape. Do not log cookies, JWTs or secrets.
2. First demonstrate the rate-limit gap with a regression test: repeated malformed login requests from one source currently keep returning validation errors; the expected hardened behavior is `429` with the existing `Retry-After` and response envelope when the existing limit is exceeded. Use disposable DB counters and the current configured limit; do not alter numeric limits.
3. Move the existing rate-limit middleware ahead of request-body validation for login, forgot, reset and change-password, while retaining `verifyOrigin` before it and `verifyToken`/`verifyCsrf` before protected mutation. Keep valid requests and validation-error responses unchanged until the limit is exceeded. Above the limit, `429` takes precedence over validation errors. Do not rate-limit GET/HEAD/OPTIONS or `/internal` through this change.
4. Run Auth build/typecheck, new service-local tests, and existing platform integration tests. Record exact PASS/FAIL/NOT RUN evidence; no production DB or mail service.

Security and compatibility: a failed Origin remains `403` before counter access; bad CSRF remains `403` for protected writes. Internal credential remains separate from browser Origin/CSRF. Mongo counter writes on malformed requests are the intended cost of closing the bypass. No schema/index migration is planned. Technical DB failure in rate limiting continues through the existing error handler (fail closed). Existing logout semantics remain cookie clearing only.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `services/auth-service/test/security.integration.test.ts` (new) | Disposable integration harness and regression cases; exact filename may use a more descriptive Auth-local name | T1, T2, T4 |
| `services/auth-service/routes/admin/account.route.ts` | Reorder existing rate-limit and validation middleware on four POST routes | T3 |

No planned edit to `services/auth-service/services/auth.service.ts`, `middlewares/security.middleware.ts`, `services/tenant-service/**`, root `test/**`, root manifests, `contracts/**`, or shared files. Any necessary expansion requires a revised plan and approval.

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T0 | At Cook start, recheck HEAD/status and ensure Auth files are untouched; work on an isolated branch/worktree without copying over user changes | none | `git status --short --branch`; `git diff -- services/auth-service` | Safe baseline or stop on conflict | Approval |
| T1 | Add Auth-local disposable integration harness; assert current valid login/introspection plus negative service credential, JWT, spoofed header, Origin and CSRF behavior | Auth-local test only | `npm exec -- tsx --test services/auth-service/test/security.integration.test.ts` | Existing behavior passes; no credential is printed | T0 |
| T2 | Add malformed-request rate-limit regression before changing route order | Auth-local test | `npm exec -- tsx --test services/auth-service/test/security.integration.test.ts` | New case fails against baseline for the expected reason, then passes after T3 | T1 |
| T3 | Move existing rate limit before body validation on four existing routes only | `routes/admin/account.route.ts` | `npm exec -- tsx --test services/auth-service/test/security.integration.test.ts` | Malformed requests eventually return current `429` envelope; ordinary valid/invalid request behavior stays compatible | T2 |
| T4 | Check compilation and existing cross-service behavior; inspect actual diff and record evidence for Test handoff | none | `npm run build --workspace @saas/auth-service`; `npm run typecheck --workspace @saas/auth-service`; `npm run test:platform`; `git diff --check` | No compile errors or platform regression; any unavailable check reported NOT RUN with reason | T3 |

Tasks are sequential and share the Auth route/test behavior; no parallel agents or coordination record are planned. Only the P01 owner edits Auth-local files. No specialist skill beyond `$cook` and then `$test` is selected for this backend task; follow `docs/development/coding-conventions.md` during Cook.

## 7. Dependencies and prerequisites

- User approves this exact plan (`Status: APPROVED` recorded by Plan stage) before Cook. User's `PLAN` request approves producing a DRAFT, not code changes.
- Use isolated synthetic test data and disposable MongoMemoryReplSet; if unavailable, do not substitute production credentials. New tests must stay under `services/auth-service/**`.
- `npm run test:platform` reads shared test code and may start local test processes; no change to root test files. Do not assume cached `origin/main` is current or rebase/push/merge.
- No OpenAPI update: `contracts/openapi/common.yaml` has no endpoint paths, and P01 forbids shared contract edits.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 — valid login and introspection preserve cookie/JWT and response contract | Auth-local success cases; `npm run test:platform` | Integration |
| AC2 — disabled/expired/invalid JWT and missing/wrong internal credential are rejected without accepting spoofed headers | Auth-local negative cases; existing platform JWT cases | Integration |
| AC3 — invalid Origin/CSRF are rejected, GET path works, and exempt methods retain their intended behavior | Auth-local boundary cases; platform Origin case | Integration |
| AC4 — malformed POST requests consume the existing rate-limit budget and eventually return `429`, while under-limit validation keeps current error shape | Red-before-green Auth-local regression and route checks on both aliases | Integration |
| AC5 — reset one-time use and old JWT revocation remain intact | `npm run test:platform`, especially existing reset tests | Integration |
| AC6 — Auth code compiles and diff stays within owner scope | Auth build/typecheck; `git diff --check`; scope inspection | Build/static |

No checks have run in PLAN. During Cook, capture the exact failed baseline regression before T3. During the separate Test stage, independently inspect the diff and rerun the required checks; report test counts and failures honestly. If Mongo binary/dependency acquisition is blocked, record NOT RUN and reason rather than calling it PASS.

## 9. Risks and mitigations

- Rate-limiting malformed requests changes repeated-error behavior from `400` to `429` after the current threshold. Approval of this plan explicitly approves that bounded security behavior change; test the first under-limit error and the later `429`.
- Middleware reorder can cause DB work before Joi rejection. Keep Origin, JWT and CSRF earlier; check Mongo failure behavior without swallowing errors or revealing credentials.
- Auth-local integration setup may compile into service `dist` because `tsconfig.json` includes `**/*.ts`. Keep test-only dependencies in test files and check build/typecheck; if this exposes a build issue, revise within Auth owner scope or stop for plan revision.
- Shared platform test may require a local Mongo binary and network-free cache. It is read-only for this task and may be NOT RUN if the environment cannot support it.
- Tenant consumes `tokenId` and `csrfHash`; preserve exact introspection fields and do not modify Tenant.

## 10. Acceptance criteria

- [ ] AC1: valid login and introspection continue to work with current response shape and `tokenAdmin` cookie.
- [ ] AC2: disabled/expired/invalid JWT, missing/wrong `AUTH_TENANT_TOKEN`, and spoofed identity headers cannot produce a successful identity.
- [ ] AC3: Origin/CSRF reject invalid writes; GET/HEAD/OPTIONS retain intended exemptions where routed.
- [ ] AC4: malformed login/forgot/reset/change-password requests count toward existing rate limits, with under-limit validation unchanged and over-limit `429`/`Retry-After` unchanged.
- [ ] AC5: reset token remains single-use and old JWT is invalid after reset.
- [ ] AC6: Auth build/typecheck and relevant tests are reported with exact outcomes; modified source/test files stay within `services/auth-service/**`.

## 11. Rollback or recovery

Before any deployment, revert only P01's Auth-local route-order and test diff from its isolated branch/worktree. Preserve all pre-existing user changes. No database migration or runtime data rollback is required; disposable test data is removed by test cleanup. If rate-limit behavior proves incompatible, restore original middleware order and retain a failure report for a revised plan.

## 12. Completion checklist

- [ ] Plan explicitly approved and status updated before Cook
- [ ] T0–T4 done or explicitly deferred with approval
- [ ] Acceptance criteria verified by separate `$test` with evidence
- [ ] `$review` decision recorded
- [ ] No shared contract/config/migration change required
- [ ] Handoff updated after each stage
