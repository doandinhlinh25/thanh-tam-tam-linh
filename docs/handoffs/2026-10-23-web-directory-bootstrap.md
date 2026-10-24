# Handoff: 2026-10-23-web-directory-bootstrap

## Task

- Task ID: `2026-10-23-web-directory-bootstrap`
- Original request: “giúp mình tạo ra thư mục đầy đủ cho web như trong file 01-frontend-Thanh.md yêu cầu”
- Branch / worktree: `thanh/init-fe` at `1056c71`, `/home/thanh/Documents/1.Projects/thanh-tam-tam-linh`
- Owner(s): Codex; Scout, Brainstorm, Plan, Cook and Test completed; Review returned `APPROVE WITH CONDITIONS`.

## Approved decisions

| Date | Decision | Approved by | Source |
| --- | --- | --- | --- |
| 2026-10-23 | Continue on the existing `thanh/init-fe` branch and preserve current dirty work; no switching, cleanup, or history changes. | User | Earlier project instruction: “hãy làm việc trên nhánh thanh/init-fe” |
| 2026-10-23 | Approve Option A: complete a mock-backed, contract-ready frontend structure now; defer live resource operations until service contracts exist. | User | User message: “xác nhận phương án A” |
| 2026-10-23 | Approve the implementation plan at `docs/plans/2026-10-23/web-directory-bootstrap.md` and proceed to Cook. | User | User message: “mình xác nhận plan hãy tiếp tục” |

## Stage log

### Scout — 2026-10-23 — Codex

- Status: `DONE — AWAITING DIRECTION`
- Inputs read: Root `AGENTS.md`; frontend feature workflow, Scout and Git-flow skills; assignment `docs/documents/assignments/01-frontend-Thanh.md`; frontend discovery/README; package scripts; current Git state; app entry points, types, fixtures, OpenAPI and service tree; existing demo feature records.
- Completed work and evidence: Compared the assignment with the current web code. `apps/web` already contains a React/Vite/TypeScript role-based demo, but has no router, API client, query cache, contracted backend paths, or frontend test/E2E setup. See [Scout report](../reports/2026-10-23/2026-10-23-web-directory-bootstrap-scout.md) for the file map and requirements gap table.
- Files or modules affected: Added this handoff and the Scout report only; no source/configuration changed.
- Assumptions (unverified): “Full web directory” could mean either finishing an isolated demo architecture or creating a production-oriented integration scaffold; these differ because required backend contracts are absent.
- Open questions / decisions needed: Choose mock-backed architecture versus contract-dependent live integration scope; confirm whether the previous preference to work on `thanh/init-fe` remains for this broader task.
- Risks and blockers: Current branch is dirty with the previous feature's uncommitted work and an unrelated/unknown untracked `.aws` path, all preserved untouched. Remote `main` freshness is unknown. No OpenAPI resource paths or functional business endpoints exist.
- Remaining work: Brainstorm scope and acceptance criteria; plan approved structure; then Cook and Test in separate stages. Preserve current work and avoid branch changes until Git Flow is resolved.
- Recommended next skill: `$brainstorm` — the requested “full frontend” spans demo architecture and live integration, and the boundary must be agreed before planning.

### Brainstorm — 2026-10-23 — Codex

- Status: `DONE — AWAITING USER DIRECTION`
- Inputs read: Scout report/handoff; assignment 01; current frontend package/structure; OpenAPI; frontend feature workflow and API integration guidance; related assignments for Auth/Tenant, Document and Chat ownership.
- Completed work and evidence: Framed requirements and compared (A) contract-ready mock-backed architecture, (B) wait for contracts before frontend integration, and (C) assume handbook API shapes. Recommended A: retain the current role demo, add explicit routing/client-cache/test boundaries, keep mock adapters isolated, and defer live resource calls until versioned contracts exist. Full trade-offs, edge cases and ACs are in the [Brainstorm report](../reports/2026-10-23/2026-10-23-web-directory-bootstrap-brainstorm.md).
- Files or modules affected: Added the Brainstorm report and appended this handoff; no app source/configuration changed.
- Assumptions (unverified): “Full web directory” means completing an architecture and test foundation around current demo flows while preparing, but not claiming, future service integration.
- Open questions / decisions needed: User to approve Option A or choose another direction; confirm “full” means mock-backed architecture/test setup now with live operations deferred to contract owners. Branch preference is already confirmed as `thanh/init-fe`.
- Risks and blockers: `contracts/openapi/common.yaml` has no paths and business services are skeletons. Real Auth/Tenant/Document/Chat operations and cross-tenant E2E are blocked until owners publish contracts and a runnable test environment. Existing dirty work and untracked `.aws` remain untouched.
- Remaining work: After direction approval, create an ordered `$plan`; Cook only against an approved plan and preserve all current work.
- Recommended next skill: `$plan` after approval of the recommended direction and scope.

### Plan — 2026-10-23 — Codex

- Status: `DRAFT — AWAITING PLAN APPROVAL`
- Inputs read: Approved Option A; Scout/Brainstorm records; plan and Git Flow skills; frontend feature workflow and plan template; live package/lockfile/source; common OpenAPI; related Identity/Tenant/Document/Chat assignments.
- Completed work and evidence: Drafted a seven-task plan for frontend tooling, URL routing, feature/shared folder migration, generic gateway/query boundaries, UI/Playwright tests, docs/API map/wireframe and final verification. See [plan](../plans/2026-10-23/web-directory-bootstrap.md).
- Files or modules affected: Added plan and updated this handoff; no application source/configuration changed.
- Assumptions (unverified): React Router, TanStack Query, Vitest/Testing Library and Playwright are proposed; package/toolchain compatibility and dependency acquisition must be verified during Cook. Existing demo behavior remains the baseline.
- Open questions / decisions needed: User approval of the plan as written or requested revisions.
- Risks and blockers: No resource API contract exists; live calls and real cross-tenant E2E are explicitly deferred. Worktree remains dirty on user-selected `thanh/init-fe`; preserve `.aws` and all earlier edits. Browser availability and package network access may limit Playwright/install checks.
- Remaining work: Await plan approval before Cook; no source/configuration edits have been made in this stage.
- Recommended next skill: `$cook` after explicit approval of the draft plan.

### Cook — 2026-10-23 — Codex

- Status: `DONE`
- Plan: Implemented approved Option A from [the plan](../plans/2026-10-23/web-directory-bootstrap.md), continuing on `thanh/init-fe` at baseline `1056c71`. No commit, push, merge, branch switch, reset, stash or clean was performed. `.aws` was not opened or changed.
- Completed tasks: T1–T6 are implemented: test/router/query dependencies and scripts; route/provider composition; migrated `src/` into app/feature/shared ownership; generic common-envelope gateway transport; 24 Vitest cases across UI/API/cache-scope behavior plus a Playwright smoke spec; README, API map and route wireframe. Empty legacy `src/pages`, `src/data` and `src/components` directories were removed only after confirming they contained no files.
- Task evidence:
  - **T1:** `npm run typecheck --prefix apps/web` — PASS; `npm test --prefix apps/web -- --run` — PASS after fixes.
  - **T2–T3:** `src/app/App.test.tsx` covers login/signup, role route rendering/scope, student navigation/upload, teacher course scope, admin evaluation, and unknown paths. Routes remain demo navigation and do not authorize server operations.
  - **T4:** `src/shared/api/apiClient.test.ts` covers envelope success/failure, network/HTTP/malformed responses, and rejection of absolute internal URLs. Source search found no feature-owned `fetch`, `/api/` call, local/session storage use, or embedded HTTP endpoint. Query-key tests distinguish user, tenant and course scope; `App` clears query state on demo login/logout.
  - **T5:** final Vitest result is **27 passed, 0 failed** across 3 files. Playwright smoke configuration is present, but browser execution is blocked because the Chromium headless executable is absent. Initial server start in the sandbox failed `listen EPERM`; after authorized escalation, Vite started and Playwright reached browser launch, which reported the missing executable. No browser was downloaded.
  - **T6:** Added [screen-to-operation API map](../../engineering/frontend-api-map.md), [route hierarchy/wireframe note](../../engineering/frontend-wireframe.md), and frontend setup/test guidance in `apps/web/README.md`.
  - **T7 (Cook checks):** final `npm run typecheck --prefix apps/web` — PASS; `npm test --prefix apps/web -- --run --reporter=dot` — PASS (27/27); `npm run build --prefix apps/web` — PASS; `git diff --check` — PASS. Playwright result is blocked as above. The subsequent `$test` stage is recorded below.
- Files/modules changed by plan task:
  - **T1:** `apps/web/package.json`, `package-lock.json`, `vite.config.ts`, `playwright.config.ts`, `src/test/setup.ts`, `src/vite-env.d.ts` — compatible router/query/UI/E2E dependencies and configured scripts/test environment.
  - **T2:** `src/main.tsx`, `src/app/App.tsx`, `src/app/Providers.tsx`, `src/app/routes.ts`, `src/shared/ui/NotFoundPage.tsx` — URL routing, provider and transient demo-session boundary.
  - **T3:** former components/pages/data/types/styles are migrated to `src/features/**`, `src/shared/**`; the earlier student upload and admin evaluation changes remain in the new feature paths.
  - **T4:** `src/shared/api/**`, `src/shared/query/**`, plus API/query tests — centralized generic transport, error normalization, query cache setup and scope helper.
  - **T5:** `src/app/App.test.tsx`, API/query tests and `apps/web/e2e/demo.smoke.spec.ts` — visible behavior coverage and isolated mock-only browser journey.
  - **T6:** `apps/web/README.md`, `docs/engineering/frontend-api-map.md`, `docs/engineering/frontend-wireframe.md`, this handoff — setup, capability boundary and route record.
- Deviations and decisions: jsdom 30 required a newer Node release than the available Node 24, so compatible jsdom 26 is used. Two browser-only methods (`scrollIntoView`, `<dialog>.showModal/close`) are stubbed in the jsdom setup. No application endpoint or resource DTO was invented because `contracts/openapi/common.yaml` still has `paths: {}`. Playwright browser download is left to a browser-enabled environment; its blocked status is recorded, not counted as a pass.
- Known limitations and risks: Uploaded file bytes remain local to the file picker and are neither sent nor read; student entries contain demo metadata only. Admin evaluation and AI output stay fixture-driven. `npm install` reported one high-severity audit item; `npm audit` could not reach the npm registry (`EAI_AGAIN`), so dependency details could not be checked or remediated in this environment. No accessibility audit or viewport/browser rendering review was performed because Playwright Chromium is unavailable.
- Git/scope evidence at Cook close: branch remained `thanh/init-fe`; existing student-upload/admin-evaluation task artifacts were preserved. The failed Cook browser attempt's generated `apps/web/test-results/` directory was removed after inspection because it contained only output from that failed run. `.aws` was excluded from inspection. All implementation changes remain uncommitted.
- Remaining work at Cook close: T7 browser smoke and visual capture needed independent verification in `$test` when Chromium is installed and local binding is available. `$review` follows the Test stage as a separate stage.
- Recommended next skill at Cook close: `$test`.

### Test — 2026-10-23 — Codex

- Status: `PARTIAL — READY FOR REVIEW WITH BROWSER LIMITATION`
- Report: [Test report](../reports/2026-10-23/2026-10-23-web-directory-bootstrap-test.md), with the AC-by-AC evidence table and coverage details.
- Scope: Verified the current dirty `thanh/init-fe` worktree based on `1056c71`; inspected `git status`, staged diff (none), tracked diff, untracked source inventory, routes, docs, source boundaries and the OpenAPI contract. Did not inspect `.aws`. The failed Playwright attempt generated untracked diagnostics in `apps/web/test-results/`; they remain in the worktree. No backend contract/functional operation was available (`paths: {}`).
- Commands: `npm run typecheck --prefix apps/web` — PASS; `npm test --prefix apps/web -- --run --reporter=verbose` — PASS (27/27, 3 files); `npm run build --prefix apps/web` — PASS; `git diff --check` — PASS; source scan and route/docs inspection — PASS. Formatter/linter and root Node workspace checks were skipped because none applies/is configured for the standalone frontend.
- Playwright: `npm run test:e2e --prefix apps/web` first failed to start Vite under sandbox local-bind restrictions (`EPERM`). Escalated rerun started Vite but could not launch Chromium because the configured Playwright headless binary is absent. No test assertion ran; no browser was downloaded. The E2E criterion and visual/accessibility browser checks remain blocked pending Chromium availability.
- Regression analysis: No source/test/build regression is indicated; all local checks passed. The E2E blocker occurs before assertion execution and is environmental. No base worktree was created because the current frontend checks passed and creating a worktree could affect unrelated dirty state without adding evidence about the missing browser binary.
- Coverage gaps: Browser rendering/responsive/keyboard/screen-reader review, real cross-tenant/auth/CSRF enforcement, upload transfer/ingestion, and live AI behavior remain unverified or contract-blocked as described in the report.
- Overall status: `PARTIAL`. Existing dirty work and task artifacts remain present; no stage/commit/push/merge or branch change. `$review` is the recommended next stage. Rerun Playwright when Chromium is installed and local server binding is available.

### Review — 2026-10-23 — Codex

- Status: `APPROVE WITH CONDITIONS`
- Report: [Review report](../reports/2026-10-23/2026-10-23-web-directory-bootstrap-review.md).
- Summary: Compared the approved plan and Test evidence with the current tracked diff and untracked source tree on `thanh/init-fe` at `1056c71`. No staged changes or commits are present. `.aws` was not opened. No implementation source was edited during review.
- Findings:
  - **Medium, confirmed defect — API URL authority escape:** `src/shared/api/apiClient.ts:38` allows slash-backslash paths. `new URL("/\\evil.example/path", "https://gateway.example.test")` resolves to `https://evil.example/path`, so a future request can bypass the intended gateway. Existing tests reject absolute `https://...` URLs but do not cover this normalization case. Recommendation: reject backslashes and/or enforce the final resolved origin, with a regression test.
  - **Low, suggestion — chat ownership:** the approved target tree includes `features/chat`, while assistant, citation, history, and feedback presentation remain inside `features/student/pages/StudentWorkspace.tsx`. This is maintainability guidance, not a blocker for the mock-only flow.
- Acceptance coverage: AC1–3, AC5–8, AC10 and observed-state AC12 pass. AC4 is partial pending API-path hardening. AC9 and AC11 are partial because Playwright stops before assertion execution without the Chromium headless binary. See the report for criterion-level evidence.
- Test evidence: Typecheck, build, and 27/27 Vitest results in the Test report are consistent with the inspected source/config. Deterministic URL parsing reproduced the AC4 finding. No browser rendering/a11y evidence is available. One npm audit high-severity advisory was reported during install, but registry failure prevented identification; verify it before production deployment.
- Conditions: (1) Harden `requestApi` against slash-backslash URL authority escape and test the resolved origin; (2) run the configured Playwright smoke journey after installing Chromium and record the result. Recommendation: return to `$cook` for condition 1, then `$test`; the chat extraction is optional/deferred.
- No implementation source was changed during Review. No commit, push, merge or branch change occurred.
- Post-review remediation: condition (1) was addressed in `apps/web/src/shared/api/apiClient.ts`: backslashes are rejected and the constructed request URL origin is checked against the configured gateway origin. Added an API-client regression test confirming `/\\evil.example/path` never reaches `fetch`. Post-fix typecheck, production build and 28/28 Vitest cases passed. Condition (2) remains open because Playwright Chromium is not installed; the smoke test still has not reached its assertions. The earlier review decision remains recorded as `APPROVE WITH CONDITIONS` pending an independent re-review of the transport fix and future browser verification.
