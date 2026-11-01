# P01-auth — Independent REVIEW (2026-11-01)

Report path uses `2026-10-31` as explicitly requested for P01's existing workflow artifacts. **Decision: APPROVE P01-auth.** This approves the scoped diff for acceptance consideration; it is not authorization to commit, merge, push, deploy or claim production readiness.

## Git provenance and reviewed inputs

- Reviewed the real uncommitted worktree `C:/Users/User/MyProjects/thanh-tam-tam-linh/.worktrees/p01-auth-cook`, branch `ai/linh/p01-auth-cook`, HEAD `066baea8592f6f45e538272b947a3a2473c77305`. `git merge-base Linh HEAD` returned the same commit. Local `Linh` and the worktree branch both point to it. No branch was created or synchronized in REVIEW.
- `git status --short --branch`: only `M services/auth-service/routes/admin/account.route.ts` and `?? services/auth-service/test/`. `git diff --cached` and committed `git diff 066baea...HEAD` were empty; this is expected because P01 remains uncommitted. The tracked route diff was read in full, and `git ls-files --others --exclude-standard` identified only `services/auth-service/test/security.integration.test.ts`, which was read in full. `git diff --check` exited 0.
- Read repository `AGENTS.md`, workflow guide and coding conventions; approved plan `docs/plans/2026-10-31/p01-auth.md`; P01 handoff; COOK and TEST reports. Reviewed the Auth router, test, security/JWT middleware, app mount, controller response, Tenant Auth client, root and Auth manifests, and current Kong route configuration. No P02–P07 worktree was touched.

## Findings and decisions

| ID | File / component | Finding, type and impact | Severity | Evidence | Decision |
| --- | --- | --- | --- | --- | --- |
| R1 | Root `package.json:11–12`; `services/auth-service/package.json` | **Confirmed test-discovery gap:** root `npm test` calls workspace `test` scripts and `test:platform`, but Auth has no `test` script, so the new Auth-local test will not run automatically. A future route-order regression could escape the normal root command. | Medium | Package scripts inspected; no tracked `.github` workflow exists to establish external CI behavior. Direct P01 test was explicitly run during TEST and REVIEW. | **FOLLOW-UP**, non-blocking for this approved narrow diff; owner/CI coordinator should wire the Auth-local test into a required check before relying on CI regression detection. |
| R2 | `services/auth-service/app.ts:44–46`; `test/security.integration.test.ts:14–24,222–236` | **Coverage concern:** the new test requests `/admin/account/*` only. `/api/v1/auth/*` is mounted with the exact same `accountRoutes` object, so there is no separate middleware stack or observed alias defect. | Low | App mount and router inspected; direct alias request absent from test. | **NON-BLOCKER**; add direct alias parity case in a later approved test change. |
| R3 | `test/security.integration.test.ts:68–70,102–111,222–236` | **Environment/flakiness concern:** MongoMemoryReplSet pins binary 7.0.24, which may need a large cold download; setup has a 90-second timeout. A 900-second bucket boundary during a 16-request case could rarely change the expected count. Test cleanup is present and worked in observed runs. | Medium | COOK recorded an initial binary download; TEST and REVIEW runs completed with 8/8 and process exit 0. `beforeEach` clears counters; `after` closes server, Mongoose and Mongo. | **FOLLOW-UP**, non-blocking for current verified environment; CI owner should cache/provision the binary and allow adequate setup time, then monitor flakiness. |
| R4 | `services/auth-service/routes/admin/account.route.ts:8–37` | **Approved behavior change, no defect:** only four existing POST route middleware orders changed. Origin remains first; JWT and CSRF remain before change-password. Thresholds/windows and handlers are unchanged. | None | Exact 4-insertion/4-deletion tracked diff; unchanged security middleware and controllers. | **ACCEPT**. |
| R5 | Current Kong config and Tenant client | **Pre-existing integration limit:** Kong does not currently publish an Auth route; Tenant calls `/internal/auth/introspect` with service credential and cookie. P01 did not change either surface or the introspection response fields Tenant validates. | Low | `infrastructure/gateway/kong/kong.yml`; `services/tenant-service/helpers/auth.helper.ts:12–56`; platform integration 11/11 PASS in TEST. | **NON-BLOCKER** for P01; gateway exposure is outside R0 scope. |

No confirmed correctness or security defect, and no Critical/High blocker was found in the P01 diff. R1–R3 are recorded as concerns/follow-ups, not as proven failures of the current implementation.

## Plan and security assessment

- **Scope:** Only `services/auth-service/routes/admin/account.route.ts` changed in tracked source (four `rateLimit`/validator swaps), plus one new Auth-local test. No endpoint, schema, threshold, window, response envelope, mail/audit policy, root manifest or other service was changed. `git diff --check` passed. The worktree contains no staged or committed P01 change.
- **Authentication boundaries:** `router.use(verifyOrigin)` precedes login/forgot/reset and protected routes. `router.use(verifyToken)` and `router.use(verifyCsrf)` precede change-password. `verifyService("AUTH_TENANT_TOKEN")` still guards internal routes. JWT is verified with HS256 and current account identity; cookie name remains `tokenAdmin`. Invalid Origin/CSRF are rejected before counter writes, as the new test checks. Invalid JSON rejected by Express body parsing occurs before route middleware and is outside the specific Joi-validation bypass approved for P01.
- **Rate limiting:** for requests that reach the four route handlers, the existing Mongo counter now runs before Joi validation. Under-limit malformed requests still get `400`; over-limit requests get the existing `429` JSON envelope and `Retry-After`. No response handler or message was edited. Shared scope names mean both URL mounts use the same budget, as before.
- **Secrets and data:** the new test uses synthetic credentials; it makes no logging call for secrets, JWTs, cookies or reset tokens. Login JSON has no raw JWT, and introspection does not set a cookie. This source review and local test do not constitute a production log audit.
- **Tenant and gateway:** Tenant's `tokenId`/`csrfHash` introspection contract is unchanged. The gateway's lack of current Auth public route is pre-existing and outside the approved hardening task. Other service dependencies were not modified.

## Regression evidence review

- The new test sends real HTTP requests to the Express app backed by a disposable Mongo replica set. It asserts all four malformed route cases at the existing limits: under-limit `400`; first request over limit `429`, `code: error`, current Vietnamese message and `Retry-After: 900`. It also tests valid/invalid login, expired JWT, inactive account, missing/wrong internal credential, spoofed identity headers, Origin/CSRF rejection and safe methods.
- COOK's historical RED claim (4 PASS / 4 FAIL) is consistent with the base-side diff showing validators before rate limit and with the recorded failure output (`400` versus expected `429`). REVIEW did not alter source to rerun RED. TEST independently recorded 8/8 local and 11/11 platform PASS, plus Auth build/typecheck PASS.
- REVIEW independently reran `.\node_modules\.bin\tsx.cmd --test .worktrees/p01-auth-cook/services/auth-service/test/security.integration.test.ts` from the original repository root, targeting the P01 worktree: **8 PASS / 0 FAIL**, exit 0. It ran outside the sandbox because this environment previously failed to start `tsx` inside the sandbox (`uv_os_get_passwd`/`ENOMEM`). `git diff --check` also exited 0 in REVIEW.
- Test isolation: `beforeEach` clears only the disposable rate-limit collection; the inactive account is restored in `finally`; `after` closes the server and Mongo connections. Top-level tests run serially under the current Node test invocation. The observed REVIEW process exited normally. Direct successful normal-user change-password and direct alias coverage are absent, but the route reordering does not alter those handlers, and platform regression checks passed.

## Acceptance criteria

| Plan AC | Result | Basis |
| --- | --- | --- |
| AC1 valid login/introspection and current cookie/response | Met | Direct HTTP test and unchanged controller; TEST 8/8. |
| AC2 expired/invalid JWT, inactive account, service credential and spoofing | Met | Direct test plus platform JWT cases; no identity header is consumed. |
| AC3 Origin/CSRF and safe methods | Met | Direct test verifies rejection and zero counters; GET/HEAD/OPTIONS checks. |
| AC4 malformed requests counted and 429 after limit | Met | Four direct route cases, source order and REVIEW 8/8 rerun. Alias shares router; direct alias test is R2. |
| AC5 single-use reset and JWT revocation | Met | Unchanged service code and TEST platform 11/11, including concurrent reset regression. |
| AC6 compile/check and owner-only scope | Met | TEST build/typecheck PASS; REVIEW diff/status and `git diff --check` PASS. |

## Final decision and next action

**APPROVE P01-auth.** No blocker in the approved implementation was found. Retain R1 and R3 as integration/CI follow-ups and R2 as a small test-coverage improvement. The owner may decide a separately authorized integration path; this REVIEW does not commit, merge, push, rebase, deploy or change source/tests. Stop here pending the owner's decision.
