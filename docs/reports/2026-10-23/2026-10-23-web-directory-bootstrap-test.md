# Test report: Complete the frontend structure from assignment 01

## Scope and environment

- Task: `2026-10-23-web-directory-bootstrap` against approved plan [web-directory-bootstrap](../../plans/2026-10-23/web-directory-bootstrap.md).
- Branch: `thanh/init-fe`; tested the current dirty worktree based on `1056c71`. No staged changes were present. Existing unrelated student-upload/evaluation artifacts remain present and uncommitted.
- Environment: Node 24, npm, installed app dependencies; Playwright package is installed, but its required Chromium headless executable is missing. Local server binding is denied inside the default sandbox and permitted only in the escalated run.
- Test scope: frontend typecheck, component/API/cache unit tests, production build, Playwright smoke attempt, source boundary scan, route/doc inspection, and Git/diff inspection. No backend operation exists in OpenAPI (`paths: {}`), so no live integration, authorization, cookie/CSRF, upload-storage, or ingestion test is available.
- The failed Playwright launch generated untracked files under `apps/web/test-results/`; they remain in the worktree as diagnostic output and are not application source.

## Commands and results

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck --prefix apps/web` | **PASS** | `tsc -b --pretty false`, exit 0. |
| `npm test --prefix apps/web -- --run --reporter=verbose` (initial Test stage) | **PASS** | 3 files; 27 tests passed, 0 failed. |
| Post-review `npm test --prefix apps/web -- --run --reporter=verbose` | **PASS** | 3 files; 28 tests passed, 0 failed, including a slash-backslash path regression test. |
| `npm run build --prefix apps/web` | **PASS** | TypeScript build and Vite 8.3 production bundle succeeded, exit 0. |
| `npm run test:e2e --prefix apps/web` (sandbox) | **FAIL — environment launch** | Playwright's `webServer` could not start because local binding returned `EPERM`; exit 1. |
| `npm run test:e2e --prefix apps/web` (escalated for local bind) | **BLOCKED — browser prerequisite** | Vite started; Playwright then failed before running assertions because `/home/thanh/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell` does not exist; exit 1. No browser download was attempted. |
| `git diff --check` | **PASS** | Exit 0. |
| Source scan: `rg -n 'fetch\(|/api/|https?://|localStorage|sessionStorage' apps/web/src/features apps/web/src/app apps/web/src/shared` | **PASS with test-only matches** | Matches are API-client unit-test fixtures under `src/shared/api`; no feature/app production source contains a fetch, endpoint, HTTP URL, or browser storage reference. |
| Route/API/docs inspection | **PASS** | Route manifest explicitly lists login/signup and each student, teacher and admin destination. API map labels all production operations mock-only/contract-blocked. OpenAPI has `paths: {}`. Wireframe records screenshot unavailable. |
| Formatter/linter | **SKIP** | `apps/web/package.json` does not define formatter or lint scripts. |
| Root Node workspace checks | **SKIP** | The changed scope is the standalone frontend; repository guidance says root build/typecheck/test cover Node workspaces, not `apps/web`. |

## Acceptance criteria

| AC | Status | Evidence / limitation |
| --- | --- | --- |
| AC1 Existing demo and upload/evaluation behavior | **PASS** | UI tests cover student and teacher role flow, invalid file validation, upload progress/cancel/completion, deterministic AI score and unmatched evaluation question. Existing mock paths remain in feature modules. |
| AC2 Explicit routes and recoverable not-found; no authorization claim | **PASS** | `src/app/routes.ts` maps login/signup and all student/teacher/admin destinations. Tests cover not-found, protected demo entry and cross-role route handling; route/session composition inspected in `src/app/App.tsx`. This is demo navigation only. |
| AC3 Meaningful app/features/shared architecture | **PASS** | Live tree contains route/provider modules, role and feature pages, isolated demo adapters, shared API/query/UI/theme/domain modules, and tests. Former empty `src/components`, `src/pages`, `src/data` folders are gone. |
| AC4 Central, contract-safe API boundary | **PASS after post-review fix** | Generic boundary is in `src/shared/api/apiClient.ts`; tests cover shared envelope, network/HTTP/malformed failures, absolute URL rejection, and slash-backslash path rejection before fetch. No feature call sites or resource endpoints/DTOs exist. |
| AC5 No token storage; demo sign-in/logout is transient | **PASS** | Source scan found no `localStorage` or `sessionStorage`; session is React state in `App.tsx`, reset on logout, with query cache cleared. UI labels the session as demo. Cookie/CSRF remain contract-blocked. |
| AC6 Isolated mock with synthetic upload/citation disclosure | **PASS** | Fixtures are under `features/demo/adapters`; UI tests and README/API map describe demo metadata and fixed sample citations. The app never reads or uploads chosen file contents. |
| AC7 Query scope and reset documented/tested | **PASS** | `scopedQueryKey` tests differentiate user, tenant and course; `App.tsx` clears the client at demo entry and logout. No live resource query is wired. |
| AC8 At least ten meaningful UI tests | **PASS** | 20 app-level behavior tests plus 7 API/query tests; 27 total passed. Coverage includes requested UI paths. Contract-dependent scan/quota/ingestion errors are not represented as product capabilities. |
| AC9 Playwright smoke configured; protected cross-tenant E2E deferred | **PARTIAL** | Smoke journey and isolated Vite config exist. Browser journey is not verified because Chromium executable is absent. Real cross-tenant and service-to-service E2E is correctly deferred with no contracts/services. |
| AC10 README, API map and wireframe accurate | **PASS** | Links and route/API docs inspected against route manifest/OpenAPI. Wireframe explicitly says screenshot was not captured due browser/server environment constraints. |
| AC11 Typecheck, build, UI test and E2E status | **PARTIAL** | Typecheck, build, and UI tests pass. Playwright is blocked at browser launch; first sandbox attempt also hit local binding restriction. |
| AC12 Branch and prior work preserved | **PASS for observed state** | `git status` remains on `thanh/init-fe`, all pre-existing plan/report/handoff artifacts remain listed, no commit/stage/branch mutation occurred. `.aws` was excluded from inspection. |

## Failure and regression analysis

The only failed command was the Playwright smoke invocation. In the sandbox, Vite could not bind `127.0.0.1:4173` (`EPERM`). An escalated rerun started Vite successfully, then browser launch stopped before test assertions because the Playwright Chromium headless executable is missing. This is an environment prerequisite, not evidence of an application assertion failure. The smoke test remains unverified until Chromium is installed and the test is rerun.

After the review identified a path-normalization escape, the API client was hardened to reject backslashes and verify the resolved URL origin before fetch. A regression test now confirms the fetcher is not called for `/\\evil.example/path`. Post-review typecheck, build, all 28 Vitest cases, and diff whitespace validation passed. No remaining application regression is indicated by these checks. A separate clean-base worktree was not created because the remaining failure occurs before browser execution; changing the shared worktree would risk unrelated dirty files.

## Coverage gaps and limitations

- No browser rendering, viewport resize, keyboard walkthrough, screen reader, accessibility checker, or console/network inspection was possible without Chromium.
- No real session expiry, CSRF, server authorization, tenant-denial, document transfer/storage, ingestion, or AI service behavior is verifiable: these APIs have no checked-in operations or runnable business handlers.
- Existing demo upload allows PDF/DOCX metadata flow only; it does not transfer or inspect the file bytes.
- `npm install` previously reported one high severity audit item; `npm audit` could not contact the registry (`EAI_AGAIN`) during Cook. This report does not claim the dependency audit passed.

## Overall status

**PARTIAL** — all local typecheck, unit/component tests, build, source checks and documentation checks passed; AC4's reviewed URL-origin escape was fixed and regression-tested after Review. Playwright browser execution and visual/accessibility browser verification remain incomplete because Chromium is unavailable. Rerun Playwright when the browser prerequisite becomes available; independently re-review the post-review transport fix before adding production callers.
