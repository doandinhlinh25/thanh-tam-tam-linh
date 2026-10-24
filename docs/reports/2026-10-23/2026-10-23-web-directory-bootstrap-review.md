# Review: Complete the frontend structure from assignment 01

## Summary

- Reviewed the approved Option A plan against the actual worktree on `thanh/init-fe`, baseline `1056c71`.
- `HEAD` remains the baseline; implementation is uncommitted. There is no staged diff. The tracked diff is a source migration and configuration change; new feature/shared/test/docs files are untracked. Existing admin evaluation and student upload task artifacts remain in the worktree. `.aws` was not opened.
- Most of the mock-backed architecture is in place and the Test report records passing typecheck, build, and 27/27 Vitest cases. Playwright is blocked before assertions because Chromium is not installed.
- **Decision: APPROVE WITH CONDITIONS.** Resolve the confirmed API path origin escape before any production call site uses the transport, and rerun the browser smoke journey once Chromium is available. This review changed only this report and the handoff.

## Findings

### Medium — Confirmed defect: backslash path can escape the configured gateway

- **Location:** [apiClient.ts:38](/home/thanh/Documents/1.Projects/thanh-tam-tam-linh/apps/web/src/shared/api/apiClient.ts:38)
- **Finding:** The path guard rejects absolute URLs and strings beginning with `//`, but accepts a slash followed by a backslash. The WHATWG URL parser treats that path as an authority-relative URL for special schemes, so it resolves to another origin.
- **Impact:** A future caller can bypass the intended public-gateway boundary. If a request is built with sensitive headers or a body, the transport can send those to an unintended host. No feature currently calls `requestApi`, which limits current exposure but does not make the shared boundary safe for its intended future use.
- **Evidence:** `new URL("/\\evil.example/path", "https://gateway.example.test").href` evaluates to `https://evil.example/path`. The same escaping behavior is accepted by the guard at line 38 and then passed to `fetch` at line 45. The existing absolute-URL unit test covers `https://...`, not slash-backslash input.
- **Recommendation:** Reject backslashes in API paths and/or validate after URL construction that the resolved origin equals the configured gateway origin. Add a regression test asserting the fetcher is not called for slash-backslash paths.
- **Classification:** Confirmed defect.

### Low — Suggestion: make chat ownership explicit in the feature tree

- **Location:** [StudentWorkspace.tsx](/home/thanh/Documents/1.Projects/thanh-tam-tam-linh/apps/web/src/features/student/pages/StudentWorkspace.tsx)
- **Finding:** The approved target structure names `features/chat/` for assistant UI, citation presentation, and conversation states, but those responsibilities remain embedded in the student workspace module.
- **Impact:** This is still understandable for the current student-only mock flow, but it makes the planned feature boundary less explicit and may make a later contract-backed chat integration harder to isolate.
- **Evidence:** The live source tree contains `features/student/pages/StudentWorkspace.tsx` and no `features/chat/`; the workspace file implements assistant answer states, citations, history, and feedback.
- **Recommendation:** Consider extracting the chat page/presentation when that feature receives its API contract or independent work; no immediate refactor is required for this structure-only delivery.
- **Classification:** Suggestion.

## Acceptance criteria coverage

| AC | Status | Review evidence |
| --- | --- | --- |
| AC1 Existing student, teacher, admin, upload and evaluation demo behavior | **PASS** | Inspected migrated student, teacher and admin modules. The 27 passing tests cover student upload invalid/progress/cancel/completion and deterministic/unmatched evaluation. |
| AC2 Explicit routes, recoverable unknown URL, no authorization claim | **PASS** | `src/app/routes.ts` contains the login/signup and all role destinations. `App.tsx` keeps role checks in-memory and routes mismatched roles back to their own demo home. Unknown paths render `NotFoundPage`. This is not server authorization. |
| AC3 Clear app/features/shared ownership and reusable UI/theme | **PASS** | Live source tree has meaningful `app/`, role/feature modules, demo adapters, and `shared/api`, `query`, `ui`, `theme`, `domain`, and `lib`. The missing dedicated chat folder is recorded as a suggestion. |
| AC4 Central, public-gateway and contract-safe transport | **PARTIAL — CONDITION** | Feature modules do not call `fetch`, and no business endpoint/DTO is invented. However, confirmed slash-backslash parsing can escape to an arbitrary origin. Fix and add a regression test before this criterion is accepted. |
| AC5 No browser token storage; demo auth stays synthetic | **PASS** | `App.tsx` stores demo identity only in React state, clears query state at entry/logout, and tests cover invalid login and transient protected-route behavior. Source scan found no `localStorage` or `sessionStorage`. Cookie/CSRF remain deferred to Identity contract. |
| AC6 Mock data/citations/uploads stay isolated and labeled | **PASS** | Demo adapters are feature-local. Student upload UI stores metadata only and labels the selected file as neither uploaded nor read; chat citations are fixed samples disclosed as demo. |
| AC7 Query cache scope/reset policy | **PASS** | `scopedQueryKey` includes user, tenant, course, resource, and params; the query test differentiates user/tenant/course, and login/logout clears the cache. No live query or stale-response behavior is claimed while contracts are absent. |
| AC8 Ten meaningful user-visible tests | **PASS** | Test report command output shows 27 passed cases, including auth, roles, upload, citation/refusal/technical error, feedback, and evaluation behaviors. |
| AC9 Playwright smoke configured; real cross-tenant E2E deferred | **PARTIAL — ENVIRONMENT CONDITION** | The isolated smoke journey exists, but no browser assertion ran. Escalated execution started Vite and failed before launch because the Chromium headless executable is absent. Real service and tenant-denial E2E is correctly deferred. |
| AC10 README, API map and wireframe match actual capability | **PASS** | Inspected the new docs against route manifest and OpenAPI; all business operations are explicitly mock-only or contract-blocked, and screenshot unavailability is disclosed. |
| AC11 Typecheck, production build, UI tests, Playwright status | **PARTIAL — ENVIRONMENT CONDITION** | The Test report provides exit-0 evidence for typecheck, build, 27/27 Vitest, and diff check. Playwright remains blocked before assertion execution. |
| AC12 Branch and prior dirty work preserved | **PASS FOR OBSERVED STATE** | `git status` shows `thanh/init-fe`, no staged changes, and prior task artifacts remain present. No commit, push, merge, branch switch, reset, stash, or clean occurred. `.aws` was excluded from review. |

## Test evidence assessment

- The Test report at [2026-10-23-web-directory-bootstrap-test.md](2026-10-23-web-directory-bootstrap-test.md) contains exact commands and output summaries. Its typecheck, build, and 27 passing Vitest results are consistent with the inspected scripts and tests.
- The absolute URL rejection test is too narrow for the gateway guarantee: it does not test WHATWG URL backslash normalization. The reproduction above is deterministic and supports the confirmed finding.
- The Playwright result is accurately reported as blocked, not passed. No visual, responsive, keyboard, screen-reader, or browser network review is evidenced.
- A previous dependency installation reported one high-severity audit item, while registry access prevented `npm audit`. Its package and exploitability are not established by this review. Confirm the advisory before production deployment.

## Remaining risks

- No functional OpenAPI business paths exist. Real auth/session/CSRF, tenant authorization, document transfer/ingestion, chat, feedback, and AI evaluation remain outside verified behavior.
- The student upload persists only file metadata in demo state; it does not upload or read file bytes.
- Playwright browser and visual/accessibility review await Chromium installation.
- Revisit the unresolved dependency audit finding before production deployment.

## Final decision

**APPROVE WITH CONDITIONS**

Conditions:

1. Harden `requestApi` against URL authority escape (including slash-backslash) and add a regression test before adding production API call sites.
2. Install the configured Playwright Chromium executable in a browser-enabled environment and rerun `npm run test:e2e --prefix apps/web`; record the assertion result. This is an environment verification condition, not an assertion failure observed in this run.

No implementation source was changed during Review. `$cook` should address condition 1; after the conditions are satisfied, rerun `$test` and then this review as needed.
