# Plan: Complete the frontend structure from assignment 01

- Task ID: `2026-10-23-web-directory-bootstrap`
- Status: `APPROVED (by user, 2026-10-23)` <!-- DRAFT → APPROVED (by <who>, <YYYY-MM-DD>) → SUPERSEDED by <path> -->
- Inputs: [Scout](../../reports/2026-10-23/2026-10-23-web-directory-bootstrap-scout.md), [Brainstorm](../../reports/2026-10-23/2026-10-23-web-directory-bootstrap-brainstorm.md), [handoff](../../handoffs/2026-10-23-web-directory-bootstrap.md), [assignment 01](../../documents/assignments/01-frontend-Thanh.md), `contracts/openapi/common.yaml`, current `apps/web` package and source.
- Baseline: `thanh/init-fe` at `1056c71`; user explicitly selected this existing branch. The worktree is dirty from preceding task files; preserve and build on it. Cached `origin/main` is not treated as fresh.

## 1. Objective and background

Complete the frontend architecture and directory structure requested by `01-frontend-Thanh.md`, evolving the existing React/Vite/TypeScript role demo instead of replacing it. Add clear app/shared/feature boundaries, URL routing, a centralized gateway transport/query boundary, isolated mock adapters, and UI/E2E test foundations. Preserve the in-progress student-upload and admin-evaluation changes.

The selected scope is the mock-backed, contract-ready Option A. No production resource calls, auth/session policy, document ingestion semantics, or chat/citation DTOs may be guessed: `contracts/openapi/common.yaml` currently has `paths: {}` and service business operations are not available.

## 2. Scope and non-goals

### In scope

- Organize `apps/web/src/` into explicit `app/`, `features/`, and `shared/` ownership with real modules, not empty placeholder folders.
- Add URL routes for the existing login/signup and role-specific demo surfaces, including a recoverable not-found route. Route presentation is not authorization.
- Add a shared theme/token location and retain current visual behavior across the existing role flows.
- Add a public-gateway transport boundary and common response/error parsing from the checked-in shared envelope. Do not add resource endpoint paths or resource DTOs without an agreed contract.
- Add a query-cache provider and document future cache key/invalidation rules. Do not create fake live queries for resources that have no API contract.
- Keep existing role, course, document, chat, feedback, evaluation and settings behavior in isolated mock modules/adapters with explicit demo disclosure.
- Add frontend component/integration tests and an isolated Playwright smoke path using the supported mock/demo UI. Cover at least ten valuable behaviors.
- Add setup/test documentation, a screen-to-operation contract map with implemented/mock-only/blocked status, and a wireframe/demo-artifact note.
- Keep all changes on `thanh/init-fe`; preserve all existing tracked and untracked user work, including `.aws`.

### Out of scope

- Implementing backend Identity/Tenant, Document, Chat, AI evaluation, storage, ingestion, or authorization.
- Adding guessed API routes, payload DTOs, error-code taxonomies, CSRF token mechanics, polling states, file quotas or MIME enforcement.
- Presenting demo login as real authentication, role routes as permission enforcement, mock citations as verified server citations, or mock upload as real transfer/processing.
- Running real cross-tenant denial E2E until service contracts, services and isolated tenant fixtures exist.
- Committing, pushing, merging, switching branches, resetting, stashing, or cleaning the worktree.

## 3. Current-state findings

- **Verified:** `apps/web` is a standalone React 19 / Vite 8 / TypeScript 5 app with `dev`, `typecheck`, and `build` scripts; no test, lint, router, or query-cache package is configured (`apps/web/package.json`).
- **Verified:** Current source uses `components/`, `pages/`, `data/`, and top-level `App.tsx`, `main.tsx`, `styles.css`, and `types.ts`; role/page changes are controlled through local React state (`apps/web/src/App.tsx`, `StudentWorkspace.tsx`, `TeacherWorkspace.tsx`).
- **Verified:** Existing demo pages use in-memory fixtures and explicit demo disclosures (`apps/web/README.md`, `src/data/`, role workspace pages).
- **Verified:** OpenAPI defines only shared success/error envelopes and no resource operations (`contracts/openapi/common.yaml`).
- **Verified:** Business services are skeletons with health routes; assignments 02–04 identify Auth/Tenant, Document and Chat contract dependencies (`docs/documents/assignments/02-platform-saas-Duy-Tam.md`, `03-document-retrieval-Linh.md`, `04-chat-rag-evaluation-Thanh-Tam.md`).
- **Verified:** Current worktree has uncommitted student-upload/evaluation changes plus task artifacts and untracked `.aws`; no changes are to be discarded or overwritten.
- **Assumption:** Use React Router, TanStack Query, Vitest + React Testing Library/jsdom, and Playwright as the proposed frontend tooling because the assignment explicitly calls for routing, query cache, UI tests and Playwright. The exact dependency versions and compatibility will be confirmed against the current package/toolchain during Cook before install/update.

## 4. Proposed design

Target meaningful structure:

```text
apps/web/src/
  app/                 # router, providers, route manifest, demo session boundary
  features/
    auth/              # existing mock login/signup and demo session UI
    courses/           # role-scoped course views and course selection UI
    documents/         # shared admin/teacher documents and student personal library
    chat/              # assistant UI, conversation states, citation presentation
    feedback/          # feedback list and answer feedback UI
    evaluation/        # admin demo evaluation
    admin/             # overview, settings, tenant-admin-only demo compositions
    teacher/           # teacher dashboard composition
  shared/
    api/               # gateway base configuration, transport, common envelope/errors
    query/             # QueryClient and cache-key policy helpers
    ui/                # reusable controls and page primitives
    theme/             # shared tokens and global responsive/accessibility rules
    lib/               # formatting and small cross-feature utilities
  test/                # render helpers and shared test fixtures
  main.tsx
```

Move/rename existing modules by feature ownership and update imports without changing established demo behavior. Keep mock data behind feature-local mock adapters. The API transport supports the already-defined common envelope and explicit base configuration through the public gateway origin, but no call site gets a resource path until a contract exists. Query cache setup is foundational only; live keys/hooks are deferred to contract-backed feature work. Role/courseset changes clear or partition query state; the demo itself remains ephemeral.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `apps/web/package.json`, `apps/web/package-lock.json` | Add router, query-cache, UI test, and E2E tooling plus actual scripts; pin compatible resolved versions | T1 |
| `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/index.html` | Configure test environment, path aliases only if adopted, and route fallback-compatible SPA metadata | T1, T2 |
| `apps/web/src/main.tsx`, `apps/web/src/App.tsx` | Move to provider composition and URL router; preserve in-memory demo session boundary | T2 |
| `apps/web/src/app/**` | Add route table, route paths, provider composition, demo session context, not-found page | T2 |
| `apps/web/src/components/**`, `src/pages/**`, `src/data/**`, `src/types.ts`, `src/styles.css` | Migrate existing modules into feature/shared ownership, preserving current flows and labels | T3 |
| `apps/web/src/features/**` | Feature-local pages/components/mock adapters for auth, course, documents, chat, feedback, evaluation, admin and teacher | T3 |
| `apps/web/src/shared/api/**`, `src/shared/query/**`, `src/shared/theme/**`, `src/shared/ui/**`, `src/shared/lib/**` | Generic gateway transport/common envelope handling, query setup, reusable UI/theme/utilities | T4 |
| `apps/web/src/test/**`, `apps/web/src/**/*.test.tsx` | Render harness and at least ten behavior-level component/integration tests | T5 |
| `apps/web/e2e/**`, `apps/web/playwright.config.ts` | Isolated Playwright demo smoke journey, with no false backend authorization claim | T5 |
| `apps/web/README.md` | Setup, run, checks, test commands, mock/live boundary | T6 |
| `docs/engineering/frontend-api-map.md` | Screen-to-operation matrix; mark operations mock-only or blocked until contract exists | T6 |
| `docs/engineering/frontend-wireframe.md` | Record route hierarchy/wireframe; include screenshot capture or explain unavailable browser artifact | T6 |
| `docs/handoffs/2026-10-23-web-directory-bootstrap.md` | Record Cook/Test/Review outcomes and service contract gaps | T6 |

No backend service, OpenAPI resource path, `.aws`, or unrelated current-task file may be changed by this plan.

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Add frontend test/config foundation and selected router/query/test dependencies. Keep the standalone `apps/web` package boundary and existing root convenience command intact. | `apps/web/package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, new test config/setup | `npm run typecheck --prefix apps/web`; `npm test --prefix apps/web -- --run` | Toolchain installs/uses compatible versions; baseline tests can render the current demo before migration. | None |
| T2 | Establish `app/` entry, provider composition, route manifest, explicit routes for login/signup and each existing student/teacher/admin view, unknown-route state, and demo-session behavior on navigation/reload. | `src/main.tsx`, `src/App.tsx`, new `src/app/**`, auth/session modules | `npm run typecheck --prefix apps/web`; UI route tests | Direct route navigation renders the intended demo view; refresh returns to a safe demo-auth state when session is not durable; route UI makes no authorization claim. | T1 |
| T3 | Move existing pages/components/types/fixtures into feature/shared folders; migrate sidebar links and existing callback/local state behavior to routes; retain role scoping and latest upload/evaluation changes. | Existing `src/components/**`, `src/pages/**`, `src/data/**`, `src/types.ts`, `src/styles.css`; new `src/features/**`, `src/shared/ui/**`, `src/shared/theme/**`, `src/shared/lib/**` | `npm run typecheck --prefix apps/web`; existing and new UI tests | Feature ownership is clear and current demo flows preserve their observable behavior without cross-feature imports of mock internals. | T2 |
| T4 | Add gateway transport boundary for same-origin/public-gateway requests, generic common-envelope/error normalization, QueryClient provider and documented query-key/session-boundary helpers. Do not add resource API operations or unsupported DTOs. | `src/shared/api/**`, `src/shared/query/**`, app provider/session boundary, API unit tests | `npm test --prefix apps/web -- --run`; source search to verify no fetch/API URL inside feature UI | Future data access has one boundary; transport distinguishes network, HTTP and common-envelope errors; no internal route or invented endpoint exists. | T1, T2 |
| T5 | Add at least 10 valuable UI behavior tests and Playwright demo smoke setup. Cover login/demo identity states; role/course scoping; upload valid/invalid/progress/cancel; assistant answered/citation, insufficient evidence and technical error; feedback; admin evaluation deterministic/unmatched result; basic cross-route navigation. Playwright tests use only isolated demo behavior and do not claim real tenant denial. | `src/test/**`, `src/**/*.test.tsx`, `e2e/**`, `playwright.config.ts`, package scripts | `npm test --prefix apps/web -- --run`; `npm run test:e2e --prefix apps/web` if browser installed | At least 10 distinct meaningful assertions pass; Playwright test can run in supported environment and documents browser prerequisite otherwise. | T2, T3, T4 |
| T6 | Write setup/test guide, screen-to-operation/API-contract map, wireframe/route hierarchy, screenshots if browser becomes available, and contract-owner dependencies. | `apps/web/README.md`, `docs/engineering/frontend-api-map.md`, `docs/engineering/frontend-wireframe.md`, handoff | Link/path review; execute documented commands from clean dependency state when possible | Docs state exact supported mock behavior and explicitly list contract-blocked operations and owners. | T2–T5 |
| T7 | Final verification and diff/scope review on the user-selected branch. Run available frontend checks; record browser/a11y/network limitations; inspect tracked and untracked file inventory without opening `.aws`. | All task-owned paths; handoff and report | `git diff --check`; `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; `npm test --prefix apps/web -- --run`; `npm run test:e2e --prefix apps/web` when executable | Checks report truthful pass/partial/block status; existing dirty files and `.aws` are preserved; only planned task paths are changed. | T1–T6 |

Tasks are sequential because route migration, feature moves, and shared types touch overlapping files. No parallel workers planned.

## 7. Dependencies and prerequisites

- Product direction Option A is approved by the user: build contract-ready architecture around current mock demo; real operations are deferred until contracts exist.
- Branch policy is already explicit from the user: continue on `thanh/init-fe`. Worktree is dirty; edit in place and preserve existing files, including the unknown untracked `.aws`; no branch change, stash, reset, clean, commit or push.
- `contracts/openapi/common.yaml` currently defines no resource paths. Before live integration, owners must publish versioned contracts for:
  - Identity: login/logout/current session, cookie attributes, CSRF, expiry, error semantics.
  - Tenant: memberships/role/course permissions, tenant switching, pagination.
  - Document: upload, supported PDF constraints, scan/quota errors, ingestion states, retry/cancel and polling.
  - Chat: request/answer/refusal/error DTOs, validated citation metadata, history and feedback.
- Frontend dependencies proposed: React Router, TanStack Query, Vitest, React Testing Library, user-event, jsdom, and Playwright. Confirm versions/toolchain compatibility and lockfile behavior before install; if dependency acquisition is blocked, preserve lockfiles and report the exact blocker rather than generating a fake setup.
- No backend or deployed environment is required for mock UI tests; real cross-tenant E2E remains deferred.
- Specialist skills to use during Cook: `frontend-architecture`, `frontend-api-integration`, `frontend-ui-engineering`, `frontend-forms`, `frontend-security`, `frontend-testing`; also follow `frontend-git-flow` under the existing explicit branch policy.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level (unit/integration/e2e/manual) |
| --- | --- | --- |
| AC1 Existing demo flows and prior upload/evaluation changes remain available | Route/render tests for student, teacher, admin and evaluation/upload pages; compare affected source/diff | UI integration + regression |
| AC2 URL routes resolve expected views and unknown paths recover | React Router tests for direct navigation, refresh-safe demo session and not-found action | component/integration |
| AC3 Feature/shared architecture has clear ownership and reusable UI states | Inspect final `src/` tree and imports; verify loading/empty/error/denied/success components have meaningful usages | source + UI integration |
| AC4 API access is centralized and contract-safe | Unit tests for common envelope success/failure, HTTP failure, network failure; `rg` source check for fetch and endpoint strings | unit + source/security |
| AC5 Session behavior stores no token and does not imply real auth | Auth/logout route tests; source scan for local/session storage and auth claims; review cookie behavior remains deferred | UI + security source review |
| AC6 Mock is isolated and citations/uploads remain clearly synthetic | Test demo disclosures and citation fixture status; inspect feature dependency boundaries | UI + source |
| AC7 Cache/session scope and stale requests are documented | Inspect query key helper contract and provider session reset; unit test key distinction/clear behavior without resource DTOs | unit/source |
| AC8 At least ten user-visible behaviors are covered | `npm test --prefix apps/web -- --run`; enumerate test cases in report | component/integration |
| AC9 Playwright path works for current mock journeys; real protected E2E is deferred | `npm run test:e2e --prefix apps/web` where browser exists; verify config uses isolated demo fixture and has no live-service claim | e2e |
| AC10 README, API map and wireframe reflect actual capability | Link check/source review; compare map entries with OpenAPI and mock pages | docs review |
| AC11 Frontend build, typecheck and test setup pass | `npm run typecheck --prefix apps/web`, `npm run build --prefix apps/web`, `npm test --prefix apps/web -- --run`; Playwright separately | build/unit/e2e |
| AC12 User branch and all pre-existing dirty/untracked work is preserved | `git status --short --branch`, review diff/file inventory without reading `.aws`; no destructive git commands | git inspection |

## 9. Risks and mitigations

- **API mismatch:** No operations are contracted; keep API client generic and add no live feature call until owner contract and gateway route align.
- **Auth/security false confidence:** Demo session stays visibly synthetic; no token storage or authorization claim. Backend checks remain the security boundary.
- **Mock/live leakage:** Put fixtures/adapters under feature-owned mock folders and clearly mark all outputs; tests verify disclosure and no network calls in demo paths.
- **Refactor regression:** Move one feature group at a time, preserve prop behavior and run tests after each task; do not alter business behavior in the structural task.
- **Unbounded scope:** Tenant switcher and operational admin data are included only as documented contract-dependent route slots/states, not working live features.
- **Dependency/network availability:** Check compatibility before modifying lockfiles; if package acquisition fails, ask for the needed network/install permission instead of bypassing it.
- **Testing environment:** Browser binary may be unavailable; Vitest remains required and Playwright coverage is reported accurately.
- **Dirty worktree collision:** Continue only in the selected branch, never switch/reset/stash/clean; review pre-existing diff in each touched file before migration and preserve `.aws` untouched.

## 10. Acceptance criteria

- [ ] AC1: Existing student, teacher, admin, student-upload and admin-evaluation demo behavior remains available after migration.
- [ ] AC2: Login/signup and every existing demo destination has an explicit URL route; unknown routes show a recoverable not-found view; route handling makes no authorization claim.
- [ ] AC3: `src/app`, `src/features`, and `src/shared` contain meaningful modules with clear responsibilities; shared UI/theme and page states are reused rather than empty folders.
- [ ] AC4: All future browser HTTP access passes through one public-gateway transport; no feature component calls `fetch`, no internal service URL is used, and no uncontracted resource endpoint/DTO is added.
- [ ] AC5: No session token is stored in `localStorage` or `sessionStorage`; demo sign-in and logout remain labeled mock behavior until cookie/CSRF contract exists.
- [ ] AC6: Mock adapters/fixtures remain separable from live transport; mock uploads and citations are visibly synthetic.
- [ ] AC7: Query cache setup documents session/user/tenant/course scoping and reset behavior; no unsupported live resource query is wired.
- [ ] AC8: At least ten meaningful UI tests cover auth states, role navigation/scope, upload states, assistant answer/citation/refusal/error, feedback and deterministic evaluation behavior.
- [ ] AC9: A Playwright smoke journey is configured for supported demo UI; live lecturer-upload-to-student-citation and cross-tenant denial tests are explicitly deferred until contracts and services exist.
- [ ] AC10: README, screen-to-contract/API map and route wireframe exist and distinguish implemented, mock-only and contract-blocked behavior; screenshot availability is recorded honestly.
- [ ] AC11: Frontend typecheck, production build, configured UI tests, and runnable Playwright smoke (where browser available) pass or have an explicit environment blocker.
- [ ] AC12: All work remains on `thanh/init-fe`; existing dirty work and `.aws` are preserved; no commit/push/merge occurs.

## 11. Rollback or recovery

- Revert only task-owned paths using reviewed, path-specific edits after comparing them with the pre-task worktree. Do not run `git reset`, `git clean`, broad checkout, stash, or branch switching.
- If a route migration breaks current demo flows, restore the previous view under the new route boundary before proceeding; do not remove the mock demo to make the architecture appear complete.
- If dependency installation or browser acquisition is blocked, leave unrelated files and lockfiles intact, report exact command/output, and ask for approval only for the needed environment/network operation.
- If service contracts arrive and conflict with the proposed generic boundary, return to Brainstorm/Plan before adding resource calls.

## 12. Completion checklist

- [ ] All tasks are done or explicitly deferred with user agreement.
- [ ] Acceptance criteria are verified by `$test` with evidence.
- [ ] `$review` decision is recorded.
- [ ] Docs/configuration are updated; no unsupported API contract is implied.
- [ ] Handoff records implementation, deviations, checks, blockers and next work.
