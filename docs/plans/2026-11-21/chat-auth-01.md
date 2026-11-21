# Plan: CHAT-AUTH-01 — Chat → Tenant → Auth

- Task ID: `2026-11-21-chat-auth-01`
- Status: `APPROVED (by user, 2026-11-21)`
- Inputs: `docs/reports/2026-11-21/chat-auth-01-scout.md`, `docs/reports/2026-11-21/chat-auth-01-brainstorm.md`, `docs/handoffs/2026-11-21-chat-auth-01.md`, `contracts/openapi/tenant-authorization.v1.yaml`, `services/tenant-service/CHAT-AUTHORIZATION.md`, `AGENTS.md`, `docs/workflow/README.md`, `.agents/skills/plan/SKILL.md`, `docs/development/coding-conventions.md`
- Baseline: `origin/Linh` at `fa481e1abad589512f52ad58c44977eac2a8496b` (refreshed 2026-11-21)

## 1. Objective and background

Implement the approved design for the existing course-chat POST so Chat calls Tenant for Auth-verified identity/active membership and course authorization before invoking ChatService. Chat does not verify JWTs or trust browser identity claims. Missing or invalid upstream dependencies must stop the request.

The course-chat handler at the baseline currently always raises 401 and its integration test asserts ChatService is not called (`services/chat-service/app/api/controllers/chat_controller.py`, `tests/integration/test_chat_api.py`). Auth/Tenant APIs already exist at `POST /internal/authorization/context` and `POST /internal/authorization/check`, described in the tracked OpenAPI YAML and Tenant markdown; this plan changes Chat only.

## 2. Scope and non-goals

### In scope

- Public `X-Tenant-Id` untrusted selector, exact Origin allowlist and browser CORS preflight for the course-chat POST.
- Forward only the `tokenAdmin` cookie, optional `X-CSRF-Token` to context, and server-configured `CHAT_SERVICE_TOKEN` to Tenant.
- Tenant context/course client, validated request/response models, bounded timeout, safe error mapping, app lifecycle and DI.
- Course-chat orchestration requiring context, `csrfVerified=true`, then course `chat:ask` authorization before constructing `TenantContext` and calling ChatService exactly once.
- Unit, OpenAPI contract, HTTP client, ASGI integration and regression tests. Real Auth/Tenant runtime checks are a separate verification tier and must be reported distinctly from mocks.

### Out of scope

History/feedback persistence or ownership; personal chat without a course; Document ingestion/retrieval/citations; Auth/Tenant code or behavior; gateway routing; deployment; production secrets; merge to `Linh` or `main`; commits/push/PR unless separately authorized.

## 3. Current-state findings

- `origin/Linh` was fetched and verified at `fa481e1abad589512f52ad58c44977eac2a8496b`. The machine-readable Tenant authorization contract is tracked there; it defines both POST endpoints, the bearer + `tokenAdmin` cookie security, required courseId/actions, response envelopes and reason codes.
- User approved this plan and added three required implementation conditions: test mandatory auth configuration effects on startup, health and internal LLM; reject duplicate `tokenAdmin` cookies rather than selecting one; do not integrate `feat/chat-persistence` changes.
- Tenant route order is service credential, Auth-backed session, body validation, optional context CSRF verification, controller. Context checks active tenant and membership; course check calls existing `CourseService` ACL for the requested action.
- Chat baseline `app/core/security.py` has a `verify_session_token` stub. Do not implement/use local JWT verification. `app/dependencies.py` currently provides only DB session; `app/main.py` creates the FastAPI app without a lifespan/client or CORS middleware. `Settings` has `CORS_ORIGINS` but no Tenant URL/token/timeout. The course route fails closed.
- Existing public error handler wraps `AppBaseException` in `success:false/error:{code,message,details}` (`app/api/error_handlers.py`). New typed safe exceptions can use that envelope; malformed request validation currently has a separate 422 response.
- Existing retrieval integration is async HTTPX with bounded timeout and sanitized network/status handling. `pyproject.toml` has HTTPX and pytest dev extras. `uv.lock` already contains PyYAML transitively; contract tests need it declared directly in the dev extra before importing it.
- Git workspace is on `feat/chat-persistence` at `caf6f0d8c8c8b71833239594c6c6ac80a300194f`, with a modified `.env.example` and numerous untracked files. Preserve all. That branch has three commits beyond the merge base and diverges from `origin/Linh`; it changes six Chat files also targeted by this plan, including config, dependencies, app lifecycle, controller, TenantContext and chat API tests. Cook must use a fresh worktree from `origin/Linh`, not this checkout, and re-check integration order before implementation.
- No tests or production code were changed in PLAN.

## 4. Proposed design

### Components and interfaces

1. **Settings** (`app/core/config.py`): add `TENANT_SERVICE_URL`, `CHAT_SERVICE_TOKEN`, `TENANT_AUTHORIZATION_TIMEOUT_SECONDS`; use existing `CORS_ORIGINS` as the exact Origin allowlist but remove its implicit localhost default (set empty, require explicit environment config). Validate URL scheme/host, token non-empty and at least 32 characters (matching Tenant verifier), timeout positive, origins explicit and no wildcard. Missing/invalid required auth configuration fails app startup; it must never make the route skip authorization.
2. **Wire schemas** (`app/integrations/tenant_authorization/schemas.py`): Pydantic models for context/check success and failure envelopes. Validate exact required fields/types, 24-hex IDs, allowed role/action, `allowed is True`, `csrfVerified` is a real boolean, reason code enum and HTTP status/reason combinations. Permit additive unknown response fields only where OpenAPI does not forbid them; public request bodies to Tenant remain limited to contract fields.
3. **Tenant client** (`app/integrations/tenant_authorization/client.py`): methods `resolve_context(tenant_id, cookie_header, csrf_token) -> AuthorizationContext` and `check_course(tenant_id, course_id, action, cookie_header) -> CourseAuthorization`. Use the app-scoped `httpx.AsyncClient`; send POST only to the two OpenAPI paths, server `Authorization: Bearer CHAT_SERVICE_TOKEN`, JSON body and only the required cookie. Send CSRF only to context. Never forward browser Authorization or unrelated cookies. Do not retry or cache.
4. **Error translation** (`app/integrations/tenant_authorization/errors.py`): classify upstream status + reason + schema into safe Chat exceptions inheriting `AppBaseException`, so existing handler keeps the response envelope. Do not return upstream body/message/headers. Local Origin/CSRF-required errors use the same envelope.
5. **Lifecycle/DI/CORS**: `create_app` adds lifespan that validates settings, creates/stores one Tenant client and closes it at shutdown. `get_tenant_authorization_client(request)` resolves the app-scoped client and remains overridable in tests. Add `CORSMiddleware` with explicit allowed origins, credentials enabled, `POST`/`OPTIONS` (and existing browser methods if required), and `X-Tenant-Id`, `X-CSRF-Token`, `Content-Type`; no wildcard. Actual POST still checks Origin itself; CORS is not the authorization gate.
6. **Course handler** (`app/api/controllers/chat_controller.py`): resolve request Origin and selector; parse all Cookie header values and semicolon-delimited pairs, require exactly one `tokenAdmin` occurrence (missing → 401 `SESSION_INVALID`; duplicate/ambiguous → 400 `VALIDATION_ERROR`); extract only that cookie; context → strict validation → `csrfVerified is True` → course check with canonical context tenant ID and route `course_id`, action `chat:ask` → strict validation and identity/tenant equality → construct `TenantContext` → call ChatService once. No business call on any failure.

### Public failure mapping

Keep the existing Chat error envelope. Only known, status-consistent Tenant reasons receive their user-facing mappings; never infer a login failure from an arbitrary 401.

| Failure | Public status/code |
|---|---|
| Missing/invalid `X-Tenant-Id` or Tenant validation 400 | 400 `VALIDATION_ERROR` |
| Missing, expired, revoked or invalid session with `SESSION_INVALID` | 401 `SESSION_INVALID` |
| Missing `tokenAdmin` cookie | 401 `SESSION_INVALID` |
| Multiple/ambiguous `tokenAdmin` cookie occurrences | 400 `VALIDATION_ERROR` |
| Tenant `SERVICE_CREDENTIAL_INVALID` | 503 `AUTH_DEPENDENCY_FAILURE` |
| `TENANT_ACCESS_DENIED` / `COURSE_ACCESS_DENIED` / `CSRF_INVALID` | 403 with matching code |
| Context success but `csrfVerified` is not exactly true | 403 `CSRF_REQUIRED` |
| `AUTH_SERVICE_CREDENTIAL_INVALID` / `AUTH_SERVICE_UNAVAILABLE` / unexpected Tenant 5xx | 503 `AUTH_DEPENDENCY_FAILURE` |
| `AUTH_RESPONSE_INVALID`, malformed Tenant JSON/schema, unknown reason/status, reason/status mismatch, identity mismatch, wrong internal route response | 502 `AUTH_DEPENDENCY_INVALID_RESPONSE` |
| Chat → Tenant timeout | 504 `AUTH_DEPENDENCY_TIMEOUT` |
| Chat → Tenant connect/network error | 503 `AUTH_DEPENDENCY_FAILURE` |
| Missing/invalid/not-allowlisted browser Origin | 403 `ORIGIN_INVALID` |

Error responses contain only safe generic messages and optionally a request ID in details; no upstream message/body, cookie, CSRF token or bearer is returned.

### Sequence

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Chat API
    participant DI as Tenant client (app-scoped)
    participant T as Tenant
    participant A as Auth
    participant S as ChatService
    B->>C: POST /api/v1/courses/{course_id}/chat + X-Tenant-Id + tokenAdmin + Origin + CSRF
    C->>C: Validate selector and exact Origin allowlist
    C->>DI: resolve_context(selector, tokenAdmin-only Cookie, CSRF)
    DI->>T: POST /internal/authorization/context + CHAT_SERVICE_TOKEN
    T->>A: Introspect tokenAdmin (AUTH_TENANT_TOKEN)
    A-->>T: Auth-verified identity
    T-->>DI: active membership context + csrfVerified
    DI-->>C: Strictly validated context
    C->>C: Require csrfVerified is exactly true
    C->>DI: check_course(canonical tenantId, route course_id, chat:ask, tokenAdmin)
    DI->>T: POST /internal/authorization/check + CHAT_SERVICE_TOKEN
    T-->>DI: Allowed identity/tenant or reasonCode denial
    DI-->>C: Strictly validated course authorization
    C->>C: Require matching userId/tenantId; create TenantContext
    C->>S: answer_question(context, question) exactly once
```

## 5. Files and components affected

All paths below are relative to `services/chat-service/` unless they start with `docs/` or `contracts/`.

| Path | Change | Task |
|---|---|---|
| `app/core/config.py` | Add typed Tenant URL/token/timeout fields, explicit origin validation and auth config validation | T1 |
| `.env.example` | Document non-secret Tenant URL, placeholder service token, timeout and origin list; no real secret | T1 |
| `app/integrations/tenant_authorization/__init__.py` | New integration package export | T2 |
| `app/integrations/tenant_authorization/schemas.py` | New typed wire models and strict semantic validators | T2 |
| `app/integrations/tenant_authorization/errors.py` | New allowlisted failure classifier and sanitized Chat exceptions/status mapping | T2 |
| `app/integrations/tenant_authorization/client.py` | New async Tenant HTTP client methods using injected HTTPX client | T2 |
| `app/main.py` | App lifespan, settings/startup validation, app-scoped HTTPX client, explicit CORS configuration | T3 |
| `app/dependencies.py` | `get_tenant_authorization_client(Request)` provider; maintain existing DB dependency | T3 |
| `app/api/controllers/chat_controller.py` | Origin/selector/cookie extraction and ordered authorization orchestration | T4 |
| `app/core/exceptions.py` | Only if needed for reusable 502/503/504 typed public exceptions; retain current envelope and codes elsewhere | T4 |
| `pyproject.toml`, `uv.lock` | Declare PyYAML directly in `dev` extra for loading the OpenAPI YAML in tests; enable SQLAlchemy's existing asyncio extra because the baseline lock omits its required greenlet package and importing the app fails; refresh lock | T5 |
| `tests/contract/test_tenant_authorization_contract.py` | New assertions against actual YAML paths, methods, security, request/action/response schemas | T5 |
| `tests/unit/test_tenant_authorization_schemas.py` | New valid/invalid envelope, ID, role, booleans and reason/status cases | T5 |
| `tests/unit/test_tenant_authorization_client.py` | New MockTransport checks for HTTP requests, forwarding, timeout/network/status/malformed responses | T5 |
| `tests/unit/test_chat_authorization_policy.py` | New Origin, config, cookie selection and CSRF policy checks | T1/T5 |
| `tests/unit/test_chat_lifecycle.py` | New app lifespan/client creation, settings failure and close tests (not present at baseline) | T3 |
| `tests/unit/test_health.py` | Update/add checks for health/readiness behavior with valid startup configuration and failed auth-config startup | T3/T6 |
| `tests/unit/test_generate.py` | Update/add checks that internal LLM is reachable with valid app startup and retains separate bearer auth | T3/T6 |
| `tests/integration/test_chat_api.py` | Extend ASGI route tests for orchestration, call ordering, mappings and fail-closed regressions | T6 |
| `tests/conftest.py` | Shared fake Tenant client/settings fixture only if existing fixture design cannot support overrides cleanly | T6 |

Do not edit Auth/Tenant source, `contracts/openapi/tenant-authorization.v1.yaml`, retrieval implementation, history/feedback controllers, gateway config or persistence models under this plan.

## 6. Ordered implementation tasks

One Codex owner; tasks run serially because they share Chat config, application and controller boundaries. No parallel worker/coordination record is planned.

| ID | Task | Files | Verify with | Expected | Depends on |
|---|---|---|---|---|---|
| T0 | Re-fetch `origin`, confirm base and user worktree state; create clean sibling worktree/branch `codex/chat-auth-01` from refreshed `origin/Linh` at candidate path `D:\Software Engineer\thanh-tam-tam-linh-chat-auth-01` (first verify path/branch unused). Do not modify or integrate `feat/chat-persistence`. Inspect its overlapping changes only to confirm isolation; revalidate the Linh baseline files before coding. | Git metadata/worktree only | `git status`, `git rev-parse origin/Linh`, `git worktree list`, `git log <base>..HEAD`; inspect shared-file diff | Isolated clean worktree at verified Linh-derived SHA; no user files overwritten or feature-branch changes imported. If source moved materially, stop and seek approval. | User approves plan |
| T1 | Add/validate Tenant and Origin settings and safe `.env.example`; remove permissive localhost default and reject missing/invalid service config instead of allowing chat without auth. | `app/core/config.py`, `.env.example`, `tests/unit/test_chat_authorization_policy.py` | `uv run --extra dev pytest tests/unit/test_chat_authorization_policy.py -k settings`; `uv run --extra dev ruff check app/core/config.py` | Valid settings accepted; missing URL/token, token shorter than 32, invalid URL, nonpositive timeout, empty or wildcard origin list prevent startup. No secret value is in docs/logs. | T0 |
| T2 | Implement wire models, allowlisted error classifier and HTTPX client interface/requests. | New `app/integrations/tenant_authorization/*`; `tests/unit/test_tenant_authorization_schemas.py`, `tests/unit/test_tenant_authorization_client.py` | `uv run --extra dev pytest tests/unit/test_tenant_authorization_schemas.py tests/unit/test_tenant_authorization_client.py`; Ruff on changed files | Correct context/check method/path/body/headers; timeout bounded; no retry; known failure maps; unknown/malformed/status mismatch fails closed. | T1 |
| T3 | Add lifespan-managed app-scoped client, dependency provider and explicit CORS preflight settings; test global startup consequences when required auth config is absent and endpoint behavior when valid. | `app/main.py`, `app/dependencies.py`, new `tests/unit/test_chat_lifecycle.py`, `tests/unit/test_chat_authorization_policy.py`, `tests/unit/test_health.py`, `tests/unit/test_generate.py` | `uv run --extra dev pytest tests/unit/test_chat_lifecycle.py tests/unit/test_chat_authorization_policy.py tests/unit/test_health.py tests/unit/test_generate.py` | Missing config fails startup and therefore makes health/readiness/internal-LLM unavailable; valid config permits normal health checks and internal LLM remains protected by its own bearer. This impact is explicit and covered. | T1, T2 |
| T4 | Implement course endpoint request validation and authorization ordering, reject duplicate `tokenAdmin` cookie names, and define safe Chat public exceptions using current envelope. | `app/api/controllers/chat_controller.py`, `app/integrations/tenant_authorization/errors.py`, possibly `app/core/exceptions.py` | Focused ASGI tests in `tests/integration/test_chat_api.py` | Missing cookie maps to 401 `SESSION_INVALID`; duplicate cookie name is rejected as 400 `VALIDATION_ERROR` without calling Tenant; exact Origin and selector checked; context/CSRF precede check; check precedes context creation and one ChatService call; no fallback. | T1–T3 |
| T5 | Add direct PyYAML dev dependency and OpenAPI-backed contract checks. Also declare SQLAlchemy's asyncio extra to restore the baseline-required greenlet package exposed as missing when importing the current async database session. | `pyproject.toml`, `uv.lock`, `tests/contract/test_tenant_authorization_contract.py` | `uv lock`; `uv lock --check`; `uv run --extra dev pytest tests/contract/test_tenant_authorization_contract.py` | Tests read the tracked Tenant YAML and verify client paths/security/body/actions/envelopes/reason enum; lock installs SQLAlchemy's already-required asyncio dependency; contract drift fails locally; no duplicate contract file. | T2 |
| T6 | Complete the 13-case ASGI regression matrix plus duplicate-cookie, startup/health/internal-LLM impact, secret-redaction, and service-call ordering assertions; run Chat suite and baseline-aware lint gates. | `tests/integration/test_chat_api.py`, `tests/integration/test_chat_authorization.py`, `tests/unit/test_chat_lifecycle.py`, `tests/unit/test_health.py`, `tests/unit/test_generate.py`, optionally `tests/conftest.py` | `uv run --extra dev pytest tests/unit tests/contract tests/integration/test_chat_api.py tests/integration/test_chat_authorization.py`; Ruff on every changed Python file; full `uv run --extra dev ruff check app tests`; compare JSON findings to approved baseline SHA with same Ruff/config/scope; `git diff --check` | All required regressions pass; changed-file Ruff passes; zero new Ruff findings and no increase from baseline; full Chat Service Ruff is reported honestly; ChatService never runs on failed authorization; no whitespace issues. | T1–T5 |
| T7 | Run optional isolated Auth/Tenant runtime integration with non-production test credentials/data if those services/fixtures are available; separately report whether it ran and its result. | No source changes expected; local test orchestration only | Existing start commands: `npm run dev --workspace @saas/auth-service`, `npm run dev --workspace @saas/tenant-service`; Chat: `uv run --extra dev uvicorn app.main:app --host 127.0.0.1 --port 8000`. No dedicated cross-service E2E runner exists; if isolated DB/network/session/course setup is unavailable, record BLOCKED/NOT RUN. | Mock tests remain distinct from runtime E2E; never report E2E PASS when only mocks ran. No production secrets. | T6 |

**Parallelism:** None by default. T1–T4 share application and request code; T5 contract test has some conceptual independence but touches lock/test setup and should be serialized to keep the implementation reviewable.

## 7. Dependencies and prerequisites

- User approves this proposed plan before any COOK work. The plan approval does not authorize commit, push, PR, merge, deployment or production secret changes.
- At Cook start, use a separate worktree from the freshest `origin/Linh`; preserve current `feat/chat-persistence` checkout and all its changes. Current feature branch changes six overlapping Chat files, so verify merge order and re-diff them before implementation. Do not transplant those changes automatically.
- Auth/Tenant contract is present at baseline. The YAML is the source for client contract tests; Tenant/Auth implementation remains unchanged.
- Runtime settings need actual non-production Tenant URL and Chat/Tenant shared `CHAT_SERVICE_TOKEN`; never add operational secret values to repository. Missing values must prevent startup, never authorize. `CORS_ORIGINS` must be explicit; the current localhost default is removed so production cannot inherit it silently.
- PyYAML is present transitively in `uv.lock`; declare it as a direct dev-only dependency before the test imports YAML, and update/check the lock. Do not add runtime package dependencies.
- Baseline `uv.lock` omitted SQLAlchemy's optional `greenlet` needed by the already-existing async database engine; initial test import failed before test collection. Enable SQLAlchemy's official `asyncio` extra and lock it as a narrowly scoped dependency correction; do not alter persistence behavior.
- At COOK, open `.agents/skills/cook/SKILL.md`; at verification/review open `.agents/skills/test/SKILL.md` and `.agents/skills/review/SKILL.md`. No frontend specialist skill applies to this Python backend integration; follow Chat conventions and the approved plan.
- Approved additions: test fail-fast configuration impact across startup, health and internal LLM; reject multiple `tokenAdmin` cookie occurrences; do not import or integrate any `feat/chat-persistence` commits/files.
- Branch policy: after approval, new `codex/chat-auth-01` worktree based on refreshed `origin/Linh`; do not branch from or alter active `feat/chat-persistence`. No commit/push/PR/merge without explicit authorization.
- Commands are Python service checks, run from `services/chat-service/`. Root npm checks cover Node workspaces and do not validate Chat Python behavior.
- Real Auth/Tenant/Mongo-backed runtime environment may not be available; this is not a blocker for unit/mock coverage, but any E2E claim requires actual runtime execution.

## 8. Testing and verification strategy

### Test levels and commands

- Unit/schema/security tests: `uv run --extra dev pytest tests/unit/test_tenant_authorization_schemas.py tests/unit/test_tenant_authorization_client.py tests/unit/test_chat_authorization_policy.py tests/unit/test_chat_lifecycle.py`.
- OpenAPI contract test: `uv run --extra dev pytest tests/contract/test_tenant_authorization_contract.py` (loads `contracts/openapi/tenant-authorization.v1.yaml` through a repo-relative path; verifies actual file and required contract facets).
- ASGI integration and regressions: `uv run --extra dev pytest tests/integration/test_chat_api.py`.
- Combined Chat suite: `uv run --extra dev pytest tests/unit tests/contract tests/integration/test_chat_api.py tests/integration/test_chat_authorization.py`.
- Ruff verification is baseline-aware for CHAT-AUTH-01 only:
  - Run Ruff on every Python file changed by this task; all must pass.
  - Run `ruff check app tests` for the whole Chat Service and report its actual PASS/FAIL result.
  - Compare machine-readable findings against baseline `fa481e1abad589512f52ad58c44977eac2a8496b` using the same Ruff version and `app tests` scope. The baseline/current repository has no explicit Ruff config file or `[tool.ruff]` table, so both use Ruff defaults. Normalize paths and compare rule/file/message occurrences; classify line shifts separately.
  - CHAT-AUTH-01's lint gate passes only when changed-file Ruff passes, new findings are zero, and current findings do not exceed baseline findings. Existing baseline findings remain technical debt and must not be described as PASS.
  - This is a bounded acceptance exception for CHAT-AUTH-01; it does not modify repository-wide lint policy or waive the requirement to run/report full Chat Service Ruff.
- Whitespace: `git diff --check`.
- `uv lock --check` after lock update. No configured mypy/pyright command was found; do not report a typecheck unless one is added and run.
- Optional runtime tier: run against isolated Auth + Tenant services, seeded test user/session/active membership/course and throwaway matching service credentials. Use the existing `npm run dev --workspace @saas/auth-service` and `npm run dev --workspace @saas/tenant-service` starts plus `uv run --extra dev uvicorn app.main:app --host 127.0.0.1 --port 8000` for Chat if local environment supports dependencies. There is no dedicated cross-service E2E runner; mark runtime tier NOT RUN/BLOCKED if setup is unavailable. Never use production secrets. Mock/contract tests alone are not E2E.

Startup-impact verification is separate from normal ASGI tests: run the app lifespan with missing auth settings and prove startup fails (so `/health`, `/health/live`, `/health/ready`, and `/internal/llm/generate` cannot be served); run with valid test settings and prove health works and internal LLM still enforces its own bearer. Report this service-wide availability consequence explicitly.

### Matrix mapped to test checks

| Case | Verification | Expected |
|---|---|---|
| 1. Valid user/course | ASGI integration with successful fake context/check | Both calls in order; correct request values; ChatService once with trusted context. |
| 2. Missing `tokenAdmin` | Cookie parser unit + ASGI failure path | Local 401 `SESSION_INVALID`; no Tenant call/course check/ChatService. |
| 3. Expired/revoked session | Client classifier + ASGI reason fixture | Only `SESSION_INVALID` maps to 401; no business call. Runtime revocation only in optional real integration. |
| 4. Invalid `CHAT_SERVICE_TOKEN` | Client contract fixture for 401 `SERVICE_CREDENTIAL_INVALID` | Public 503 dependency failure; never login/logout 401. |
| 5. Invalid Tenant→Auth `AUTH_TENANT_TOKEN` | Client fixture for 503 `AUTH_SERVICE_CREDENTIAL_INVALID` | Public 503 dependency failure; no business call. |
| 6. Revoked tenant membership | ASGI fixture `TENANT_ACCESS_DENIED` | 403 and no course check/ChatService. Runtime membership mutation only in optional integration. |
| 7. Other tenant selected | ASGI with valid selector but denied/mismatched canonical context | Deny or protocol failure; never trust client headers; no ChatService. |
| 8. No course permission | ASGI fixture `COURSE_ACCESS_DENIED` | 403; no ChatService. ACL role/enrollment rules themselves are Tenant runtime tests, not claimed by Chat mock. |
| 9. Forged identity headers/browser bearer | Regression ASGI test with spoofed `X-User-Id`, `X-Role`, `Authorization` | Identity still comes from Tenant cookie flow; browser bearer is not sent as service auth; no bypass. |
| 10. Tenant timeout/network | HTTPX MockTransport raises timeout/connect/network exceptions; ASGI orchestration fixture | Timeout 504/network 503; no retry and no ChatService. |
| 11. Tenant malformed response | Client/ASGI fixtures for invalid JSON, missing fields, unknown reason/status, false allowed, identity mismatch | 502/503 per mapping, fail closed, sanitized envelope, no ChatService. |
| 12. CSRF/Origin | Policy + ASGI + CORS preflight tests for missing/bad/allowed Origin and missing/bad/good CSRF | Invalid/missing Origin 403 before Tenant; missing CSRF yields context false then 403 before check; invalid CSRF maps 403; valid CSRF and allowed Origin can proceed. |
| 13. Personal history without course | Scope-preservation test/static diff review | No fake courseId or new `authorization/check` for history; history/ownership implementation remains untouched. Not a runtime history feature test. |
| 14. Duplicate `tokenAdmin` | Cookie parser unit + ASGI test with repeated pair and repeated Cookie header | 400 `VALIDATION_ERROR` before Tenant/ChatService; no arbitrary cookie selection. |

Every mock-based test is labeled unit/contract/ASGI only. Optional runtime integration is separately reported. Do not claim end-to-end success from mocked Auth/Tenant responses.

## 9. Risks and mitigations

- **User workspace overlap:** current `feat/chat-persistence` changes controller/config/DI/lifespan/TenantContext/tests and `.env.example`. Mitigation: Cook worktree from Linh, do not modify current checkout; inspect latest origin and coordinate integration order first.
- **Public API compatibility:** adding required `X-Tenant-Id` changes client request needs. Mitigation: document 400 for missing/invalid selector; verify no client/gateway currently owns another selector before release. Gateway itself is out of scope.
- **Origin/CORS confusion:** CORS alone does not reject all cross-origin requests. Mitigation: separate exact Origin request gate from CORS middleware; test both POST rejection and allowed credentialed preflight.
- **Upstream error ambiguity:** Tenant reason and HTTP status can disagree or be unknown. Mitigation: allowlist status/reason pairs and map unknown/malformed responses to sanitized dependency errors, never session invalid.
- **Cookie parsing/forwarding:** forwarding the whole browser Cookie header exposes unrelated cookies. Mitigation: select only `tokenAdmin`, test absence and duplicate/ambiguous handling, and assert logs omit values.
- **Missing config:** default settings or blank token could otherwise produce misleading behavior. Mitigation: validate at startup and fail app initialization; no route fallback.
- **Contract drift:** YAML and source may diverge. Mitigation: contract tests parse tracked YAML and assert the client wire behavior; Auth/Tenant source remains the implementation owner.
- **No full E2E environment:** mocked Tenant cannot prove actual JWT/Auth/database membership behavior. Mitigation: report test tiers separately and keep runtime integration optional/blocked when services unavailable.
- **Ruff baseline debt:** the verified base has 240 findings under Ruff 0.17.1; the current tree has 232. For this task only, require changed-file Ruff PASS, zero new findings and no increase; keep the existing 232 findings visible as repository technical debt. Do not change the repository-wide lint policy here.
- **Shared Chat file changes on parallel feature branch:** separate history can produce conflicts. Mitigation: rebase plan assumptions only after user-directed integration order; do not merge automatically.

## 10. Acceptance criteria

- [x] AC1: Required authorization settings are validated at startup; missing/invalid values reject lifespan startup. (T1/T3; lifecycle and policy tests.)
- [x] AC2: Credentialed CORS preflight is limited to configured exact origins and required headers; the course POST independently checks Origin. (T3/T4; lifecycle and ASGI tests.)
- [x] AC3: HTTP client requests and responses match the tracked OpenAPI contract, including bearer, cookie, CSRF, body, reason and schema handling. (T2/T5; YAML contract and HTTPX MockTransport tests.)
- [x] AC4: Only `tokenAdmin` and context CSRF are forwarded; forged browser claims are ignored; exercised request logs/responses do not expose tested secrets. (T2/T4/T6; assertions and caplog.)
- [x] AC5: Context precedes course check; session, service credential and dependency errors remain distinct; false CSRF blocks before course authorization. (T4/T6; client + ASGI tests.)
- [x] AC6: Course check uses verified tenant, route course ID and `action="chat:ask"`; returned identity and tenant must match context. (T4/T6; HTTP + ASGI assertions.)
- [x] AC7: ChatService runs exactly once after both gates; tested failure cases have zero ChatService calls. (T6; spies/mocks.)
- [x] AC8: Existing public error envelope is retained; known, malformed, unknown, timeout and network failures fail closed without defaulting to session-invalid. (T2/T4/T6; classifier + ASGI tests.)
- [x] AC9: Course-chat cases are covered by unit, contract and ASGI mocks; personal history without courseId remains outside the changed endpoint/scope. Runtime checks are reported separately. (T5–T7; test report.)
- [x] AC10: All 269 tests, lock and diff checks pass; Ruff passes on every task-changed Python file; comparison against baseline SHA `fa481e1abad589512f52ad58c44977eac2a8496b` using Ruff 0.17.1 defaults and `app tests` scope reports zero new findings and no increase (240 baseline → 232 current; 8 resolved). Full Chat Service Ruff is still run and reported as FAIL with 232 existing baseline findings, recorded as technical debt rather than PASS. This bounded exception applies only to CHAT-AUTH-01 and does not change repository-wide lint policy. (T5/T6; test report and machine-readable baseline comparison.)
- [x] AC11: Changes are limited to Chat integration/config/tests/docs and the required dependency metadata; Auth/Tenant, history ownership, gateway, deploy and production secrets are untouched. (T0/T6; final diff/review.)
- [x] AC12: Invalid authorization config fails lifespan; valid startup serves health, keeps internal LLM separately bearer-protected, and CORS preflight works. (T1/T3; lifecycle + health/LLM tests.)
- [x] AC13: Missing session maps to 401 `SESSION_INVALID`; duplicate `tokenAdmin` in one or repeated Cookie headers maps to 400 `VALIDATION_ERROR` before Tenant/Chat. (T4/T6; ASGI tests.)
- [x] AC14: No `feat/chat-persistence` source was brought into this worktree. (T0/T6; isolated base and diff.)

## 11. Rollback or recovery

- No database schema/migration change is planned. If implementation fails before an authorized commit, preserve the worktree and fix/review the diff; do not reset/clean/stash or delete files.
- If an authorized implementation commit is later found unsafe, revert only that commit on the feature branch with a normal `git revert`; do not rewrite history or merge to `Linh`/`main` automatically.
- If required runtime configuration is absent, the service must fail startup as designed; restore valid non-production config through the owner rather than weakening validation. No real secret values belong in Git.
- Keep `feat/chat-persistence` untouched. If its work is integrated into Linh before Cook, compare the current Chat files and revise this plan or create a fresh plan against that baseline before coding.

## 12. Completion checklist

- [x] T0–T6 implementation tasks completed; T7 runtime Auth/Tenant E2E is not run because no isolated runtime/credential fixture was available.
- [x] Acceptance criteria have test evidence and test tiers are distinguished; AC10 passes under the user-approved baseline-aware Ruff gate. Full-service Ruff still fails on documented existing debt.
- [x] Self-review decision recorded; no in-scope critical issue remains.
- [x] `.env.example`, dependency metadata/lock and OpenAPI contract tests updated.
- [x] Handoff updated with Cook/Test/Review results and actual branch/worktree/SHAs.
- [x] Plan was approved before Cook; no commit, push, PR, merge or deploy was performed.
