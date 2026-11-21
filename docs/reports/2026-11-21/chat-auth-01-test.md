# CHAT-AUTH-01 Implementation and Test Report

- Initial implementation run: 2026-11-21
- Acceptance gate adjustment and rerun: 2026-11-22
- Stage: `COOK + TEST`
- Status: `COMPLETE` under the user-approved CHAT-AUTH-01 baseline-aware Ruff gate
- Branch/worktree: `codex/chat-auth-01` / `D:\Software Engineer\thanh-tam-tam-linh-chat-auth-01`
- Base: `origin/Linh` at `fa481e1abad589512f52ad58c44977eac2a8496b`
- HEAD: `fa481e1abad589512f52ad58c44977eac2a8496b` (no commit created)

## Implemented

- Required Tenant URL, `SecretStr` service token, bounded authorization timeout and explicit exact Origin allowlist; startup fails closed when invalid.
- Lifespan-managed app-scoped async HTTPX client, dependency injection and credentialed CORS preflight for the explicit origins/headers.
- Strict Tenant context/course wire schemas and HTTP client. Context forwards only `tokenAdmin` and optional `X-CSRF-Token`; course check forwards only `tokenAdmin`; both use the server service bearer. No retry/cache or browser Authorization/identity forwarding.
- Course chat checks tenant selector, Origin, course ID, session cookie uniqueness and CSRF header uniqueness; resolves context, requires `csrfVerified=true`, checks `chat:ask`, compares identity/tenant and calls `ChatService` once only after both Tenant gates pass.
- OpenAPI contract tests against the tracked Tenant YAML. Added direct PyYAML test dependency and enabled SQLAlchemy's existing asyncio extra because initial test collection exposed the baseline missing `greenlet` dependency.
- Startup/health/internal LLM and CORS tests document the service-wide consequence of mandatory authorization configuration: invalid config prevents lifespan startup and therefore prevents all routes serving. With valid config, health works and internal LLM keeps its separate bearer check.

## Test results

Final command from `services/chat-service`:

```text
uv lock --check
uv run --extra dev pytest tests/unit tests/contract tests/integration/test_chat_api.py tests/integration/test_chat_authorization.py
uv run --extra dev ruff check app tests
git diff --check
```

- Unit: `PASS` — 173 passed.
- Contract: `PASS` — 74 passed, including the tracked Tenant OpenAPI assertions.
- ASGI integration: `PASS` — 22 passed with a mocked Tenant dependency.
- Total pytest: `269 passed, 0 failed, 0 skipped`.
- Lock check: `PASS` — `uv lock --check` resolved 44 packages with no lock changes required.
- Ruff on all task-touched Python files: `PASS` — rerun 2026-11-22.
- Ruff baseline comparison: `PASS` — Ruff `0.17.1`, same `app tests` scope. Neither baseline nor current tree has an explicit Ruff config file or `[tool.ruff]` table; both use Ruff defaults. Baseline SHA `fa481e1abad589512f52ad58c44977eac2a8496b`: 240 findings across 81 files. Current: 232 findings across 76 files. New: 0; resolved: 8; line-shifted: 0; unclassified: 0. Machine-readable output was captured under `C:\Users\Admin\AppData\Local\Temp\chat-auth-acceptance-ruff-b5f851e265ef41d1b7f3f69d1da60b7a\`.
- Required full `ruff check app tests`: `FAIL` (exit 1) — 232 existing baseline findings remain. This is reported as technical debt, not PASS. Under the user's bounded CHAT-AUTH-01 acceptance adjustment, it does not fail this task because changed-file Ruff passes, new findings are zero and current findings are below baseline. Repository-wide lint policy is unchanged.
- `git diff --check`: `PASS`.
- Runtime Auth/Tenant E2E: `NOT RUN` — no isolated Auth/Tenant runtime with non-production session, membership and service-credential fixtures was available. Mocked tests are not represented as E2E evidence.

Initial test iterations found fixture/setup issues and an invalid course-ID test bypass through a mock. These were corrected; final suite results above are from the rerun after fixes. No test was removed, skipped or weakened to obtain the result.

## Coverage notes

Automated checks cover valid course chat; missing/invalid session; service credential and Auth dependency credentials; tenant and course denial; tenant/identity mismatch; forged browser identity headers; timeout, network and malformed responses; missing/invalid CSRF; duplicate tokenAdmin and CSRF headers; exact Origin/preflight; startup failure; and the no-courseId boundary. Personal history remains outside this endpoint and was not implemented or assigned a fabricated course ID.

## Scope and Git

- No Auth/Tenant source or behavior, history/feedback ownership, gateway, deployment or production secret was changed.
- `feat/chat-persistence` was not integrated or modified.
- No commit, push, PR, merge or deploy was performed.
- Working tree contains the implementation and reports; HEAD remains the verified base SHA.

## Verdict

`COMPLETE` for CHAT-AUTH-01 under the user's explicit, bounded baseline-aware acceptance gate: all 269 tests, lock/diff checks and changed-file Ruff pass; the same-config Ruff comparison has zero new findings and no increase. Full Chat Service Ruff remains `FAIL` with 232 baseline findings and is recorded as technical debt, not as a passing check. Runtime Auth/Tenant E2E remains `NOT RUN` and is not inferred from mocked tests.
