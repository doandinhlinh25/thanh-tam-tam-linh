# Test report: Admin evaluation and student upload

## Scope and environment

- Task: `2026-10-23-admin-evaluation-student-upload`
- Branch/base: `thanh/init-fe` at `1056c71`; tested the current uncommitted worktree diff.
- Environment: React 19 / TypeScript / Vite frontend in `apps/web`; no API paths are defined in `contracts/openapi/common.yaml`.
- Automated browser/component test tooling is not configured in `apps/web/package.json`; it defines only `dev`, `typecheck`, and `build`.
- No browser or desktop app was available through the UI automation environment. The app's dev server was started, but browser-based interaction could not be performed.

## Commands and results

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck --prefix apps/web` | PASS | Exit 0; `tsc -b --pretty false` completed without diagnostics. |
| `npm run build --prefix apps/web` | PASS | Exit 0; Vite 8.3.0 transformed 31 modules and produced the production bundle. |
| `git diff --check` | PASS | Exit 0; no whitespace errors. |
| `find apps/web -maxdepth 3 -type f \( -name '*test*' -o -name '*spec*' -o -name 'playwright.config.*' -o -name 'vitest.config.*' \) -print` | SKIP (no configured tests found) | No project test/spec or Playwright/Vitest config was found. A dependency file named `react-dom/test-utils.js` appeared under `node_modules`; it is not a project test. |
| `rg -n "FileReader|arrayBuffer\(|fetch\(|localStorage|sessionStorage|FormData" apps/web/src/pages/StudentDocumentsPage.tsx apps/web/src/pages/StudentWorkspace.tsx` | PASS (source inspection) | No matching file-read, network, browser-storage or form-data calls in the student upload path. |
| `npm run dev --prefix apps/web -- --host 0.0.0.0` | BLOCKED by sandbox | `listen EPERM` on `0.0.0.0:5173`. |
| `npm run dev --prefix apps/web -- --host 127.0.0.1` | BLOCKED by sandbox | `listen EPERM` on `127.0.0.1:5173`. |
| `npm run dev --prefix apps/web -- --host 127.0.0.1` (approved escalation) | PASS (server startup only) | Vite served `http://127.0.0.1:5173/`; UI automation reported `Browser is not available: iab`, with no browsers/apps in inventory. Server startup does not verify rendered UI. |

## Acceptance criteria

| AC | Status | Evidence / limitation |
| --- | --- | --- |
| AC1: All login/signup and student, teacher, admin pages have readable hierarchy and responsive layouts. | PARTIAL | Shared styles apply globally; typecheck/build pass. No rendered narrow/tablet/desktop inspection was possible. |
| AC2: Student can navigate to the personal library and simulate upload for an enrolled course. | PARTIAL | Navigation, home action, scoped course list and upload handler are present in `StudentWorkspace.tsx` and `StudentDocumentsPage.tsx`; browser interaction not verified. |
| AC3: Upload has accessible empty, selection, validation, progress/cancel, success, remove and no-course states. | PARTIAL | Source contains these states, labels and progress semantics; actual keyboard/screen-reader and interaction behavior not exercised. |
| AC4: Student upload is session-local metadata; file bytes are not read, persisted, transmitted or exposed to shared lists/other personas. | PARTIAL | Upload state is local to `StudentWorkspace`; source search found no file-reading, network or browser-persistence calls in the upload path. `initialDocuments` is separate. Cross-persona/logout isolation has not been exercised in a browser. |
| AC5: Assistant uses only synthetic examples, does not claim to process selected files, and unsupported questions do not get invented citations. | PARTIAL | Synthetic answer/citation fixture and explicit disclosure are in source. The assistant's response matching/refusal behavior was not exercised interactively. |
| AC6: Evaluation scores use 0–100; questions without fixtures are visibly unevaluated. | PASS (source/build) | Seeded data and fixtures use percentage points; `null` renders as “Chưa chạy” and CSV marks it likewise. Typecheck/build pass. |
| AC7: Repeated evaluation returns deterministic question output; answer quality equals the evaluated-question mean; other metrics are labeled illustrative. | PARTIAL | Handler maps fixture scores and computes rounded mean; other metrics are explicitly described as illustrative. Repeated run and export comparisons were not exercised in UI. |
| AC8: Empty runs are blocked, duplicate runs prevented, timer cleaned on unmount, editing/export retained. | PARTIAL | Empty list disables run; running state disables controls and guards repeat calls; effect cleans timer; CSV/JSON code paths remain. Empty/duplicate/unmount/export interactions were not exercised. |
| AC9: Existing role flows remain available; frontend typecheck/build pass. | PARTIAL | Typecheck/build pass; reviewed route/page source retains existing role paths. No navigation/action regression walkthrough was possible. |
| AC10: README/handoff accurately describe demo behavior; no unrelated changes. | PARTIAL | README and handoff state demo-only boundaries; tracked source changes are within planned files. An untracked `.aws` path appeared in final status during this test and was left untouched; its relation to this task is unknown. |

## Failures and regression analysis

- No required automated check failed.
- Browser validation was blocked by the environment: the sandbox rejected local port binding, and after the approved loopback dev-server start the UI automation surface had no available browser. This is a coverage limitation, not evidence of an application defect.
- An untracked `.aws` path appeared in `git status` during final inspection. It was not present in the earlier status snapshot, was not inspected or modified, and is preserved as user work; its origin is unknown.
- The first `find` command returned a dependency test utility filename under `node_modules`; it did not identify an application test suite. The command was corrected by inspecting the package scripts and treating no app test configuration as available.
- No base worktree comparison was needed because the implemented checks succeeded.

## Coverage gaps and risks

- No browser interaction, responsive rendering, keyboard walkthrough, screen-reader inspection, or automated accessibility checker was run.
- The no-file, invalid extension, drop, cancel, success/removal, no-course, logout/second-student isolation and admin/teacher regression journeys remain unverified at runtime.
- Evaluation double-click, repeated-run values, CSV/JSON contents, and leaving the page during progress remain unverified at runtime.
- Source inspection and frontend builds cannot prove backend authorization, durable privacy, real upload or AI evaluation; there are no matching service contracts or endpoints in this task scope.

## Overall status

**PARTIAL** — frontend typecheck and production build pass, and source-level privacy/result mapping checks support the relevant criteria. Required manual browser and accessibility coverage could not be completed because no browser was available. An unrelated untracked `.aws` path is preserved and left uninterpreted. Continue with `$review` while retaining these limitations, or run the missing walkthrough in an environment with a browser.
