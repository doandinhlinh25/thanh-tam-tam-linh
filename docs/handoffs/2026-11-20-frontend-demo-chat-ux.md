# Handoff: 2026-11-20-frontend-demo-chat-ux

## Task

- Task ID: `2026-11-20-frontend-demo-chat-ux`
- Original request: continue the frontend course-scoped demo/chat UX using the `document.pdf` structure, in multiple careful phases.
- Branch / worktree: `thanh/fe-demo-chat-ux` at `8f36675` baseline, `/tmp/thanh-fe-demo-chat-ux`.
- Owner: Thanh / Codex.

## Approved decisions

| Date | Decision | Approved by | Source |
| --- | --- | --- | --- |
| 2026-11-20 | Use fixture-backed course/chat UX as the first FE direction. | User | Conversation |
| 2026-11-20 | Implement the approved multi-phase plan. | User | Conversation |

## Cook — 2026-11-20

- Status: `DONE`
- Inputs: `docs/plans/2026-11-20/frontend-demo-chat-ux.md`, `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-brainstorm.md`, `origin/Linh:docs/architecture/document.pdf` at `9b7b910`.
- Completed:
  - Extracted demo chat scenario mapping into `chatScenarios.ts` with discriminated answered/insufficient/error results and retry semantics.
  - Added fixture unit tests for citations, no-evidence, technical error, and retry behavior.
  - Added retry UI that replaces the technical response without adding a duplicate student question.
  - Replaced citation `<details>` controls with an accessible citation drawer: named dialog, close button focus, Escape close, backdrop close, and explicit no-real-download disclosure.
  - Added App tests for citation drawer and retry behavior; updated the citation selector to match the new button structure.
  - Preserved existing role/course/demo boundaries; no API route, auth, CSRF, upload, retrieval, streaming, or backend change was added.
- Files changed:
  - `apps/web/src/features/demo/adapters/chatScenarios.ts`: fixture result boundary.
  - `apps/web/src/features/demo/adapters/chatScenarios.test.ts`: scenario regression tests.
  - `apps/web/src/features/demo/adapters/demoData.ts`: typed scenario map.
  - `apps/web/src/shared/domain/types.ts`: local demo scenario/retry types.
  - `apps/web/src/features/student/pages/StudentWorkspace.tsx`: retry flow and citation drawer.
  - `apps/web/src/shared/theme/styles.css`: citation/retry/drawer styles.
  - `apps/web/src/app/App.test.tsx`: observable drawer/retry tests.
- Checks:
  - `npm run typecheck`: PASS.
  - `npm test -- --run`: PASS, 4 files / 34 tests.
  - `npm run build`: PASS.
  - `git diff --check`: PASS.
  - `npm run test:e2e`: BLOCKED, Playwright Chromium executable is not installed in this environment.
- Known limitations:
  - Fixtures remain demo-only; backend authorization, public gateway, session/CSRF, ingestion `READY`, retrieval, citation authorization, and live feedback are unverified.
  - Citation drawer focus is placed on the close control and Escape is supported; full browser E2E and screen-reader verification remain for Test/Review.
  - `npm ci` reports one high dependency audit finding inherited from the existing frontend dependency tree; no dependency upgrade was made.
- Recommended next skill: `$test` for independent acceptance verification, followed by `$review`.

## Test — resumed 2026-11-20

- Overall: FAIL (AC4 modal keyboard behavior); remaining coverage PARTIAL.
- Re-ran frontend typecheck, 34 tests, build and diff whitespace checks: PASS.
- Playwright: BLOCKED before assertions by missing chromium_headless_shell-1248 after successful web-server startup outside sandbox.
- Source inspection: citation drawer lacks focus containment and return to opener; chat E2E and several planned regression cases remain absent.
- Report: `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-ux-test.md`.
- Next stage: return to Cook for focused fixes, then rerun Test. No source changes, commits or pushes made in this resumed Test stage.

## Cook follow-up — 2026-11-20 (in progress)

User confirmed continuing Cook after the Test findings. Preserve all prior uncommitted edits. Main owner handles production code, App tests, scenario tests and documentation. Modal now uses native showModal with explicit close focus/return; course drafts are scoped; pending callbacks remain scoped by course. No API or backend changes planned.

### Coordination

| Owner | Exclusive write ownership | Scope |
| --- | --- | --- |
| Main agent | StudentWorkspace.tsx, styles.css, App.test.tsx, scenario fixtures/tests, types, docs | Focus/draft/history fixes and regression verification |
| chat_component_tests | apps/web/src/features/student/pages/StudentWorkspace.test.tsx (new) | Course drafts, duplicate pending submission, history and rating isolation |
| chat_e2e | apps/web/e2e/demo.smoke.spec.ts | Demo chat → citation → feedback, modal keyboard/backdrop and representative viewports |

Read-only gap investigation completed without edits. Test-only parallel work starts after the modal behavior fix; agents must not alter production code or one another's files.

## Cook follow-up — completed 2026-11-20

- Status: IMPLEMENTED; this section supersedes the earlier Cook DONE claim for the focused Test findings. Historical Test FAIL report is retained.
- Fixed citation modality/focus with native dialog, scoped drafts by course, guarded in-flight submission, paired history/recent answers with latest question, and added a distinct empty chat state.
- Added approved opt-in demo feedback failure/retry and multi-citation fixtures; updated API map.
- Expanded component/security/scenario coverage and E2E for 390/768/1440 px. Screenshot QA identified and fixed mobile disclosure/demo-controls grid width.
- Checks: typecheck PASS; 45 tests / 5 files PASS; build PASS; Playwright 5/5 PASS after final CSS fix; diff-check PASS. Chromium installed in local cache; no package/lockfile change.
- Coordination complete: component and E2E agents edited only their assigned files; main integrated production/docs changes and inspected screenshots/diff.
- Details, file-to-plan mapping, commands, deviations and screenshot paths: `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-ux-cook-followup.md`.
- Original checkout remained on thanh/init-fe with its existing untracked work unchanged. Continued feature work is in /tmp/thanh-fe-demo-chat-ux. No commit, push, merge or PR performed.
- Remaining: independent Test, then Review after stage go-ahead; no live integration or screen-reader/non-Chromium guarantees are claimed.

## Test — independent retest after Cook, 2026-11-20

- Overall: **FAIL** — drawer disclosure and metadata label fail the UI skill contrast gate (2.770:1 and 4.096:1; normal text requires 4.5:1). Verified from actual browser computed styles.
- Configured checks: typecheck PASS; 45 tests / 5 files PASS; build PASS; Chromium E2E 5/5 PASS (11.5s); diff-check PASS.
- Additional browser cases: no assigned course, composer boundaries, logout during pending, and hostile/long fixture text at 320/640px PASS. Initial no-course probe setup was corrected and retested separately.
- Baseline comparison: exported 8f36675 has inline details citations and no new drawer labels; new failing styles are introduced with this feature. Baseline-wide contrast compliance is not claimed.
- Coverage gap: explicit permission/dependency fixture and tenant/user fixture metadata from plan phase 1 remain absent. No backend-security vulnerability inferred.
- Source/config/test/plan/API-map SHA-256 comparison: 47 files unchanged during Test. No implementation fixes, dependency changes, commits or remote operations made.
- Report updated with latest retest plus historical run: `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-ux-test.md`. Browser scripts/results/screenshots: `/tmp/fe-chat-test-20261120/`.
- Next: return to Cook for localized contrast fixes and fixture-gap resolution/explicit deferral, then Test again. Test/browser servers were stopped.

## Cook — contrast and fixture fixes (2026-11-20, in progress)

User invoked Cook to inspect Test and fix the reported defects. Scope: localized contrast colors and regression assertion (phases 4–5), explicit permission/dependency error scenarios plus demo context metadata (phase 1) and their UI/tests (phases 2–3). No live authorization or API change. Existing worktree/branch/edits retained.

### Current exclusive ownership

| Owner | Files | Responsibility |
| --- | --- | --- |
| Main | StudentWorkspace.tsx, demoData.ts, chatScenarios.ts, types.ts, scenario/component/App tests, styles.css, docs | Production/fixture changes, unit checks, report/handoff |
| contrast_fixture_e2e | apps/web/e2e/demo.smoke.spec.ts only | Browser contrast regression and permission/dependency fixture interactions |

Test worker may edit only its assigned E2E file; production changes remain single-owner. Browser checks wait until new UI/scenarios are ready.

## Cook — Test fixes completed, 2026-11-20

- Status: IMPLEMENTED. Drawer disclosure/meta contrast now 5.708:1; permission/dependency badge contrast 4.901:1, checked in Chromium.
- Added explicit non-retryable permission and recoverable dependency fixtures, empty error citations, distinct labels and browser controls. Added tracing-only demo tenant/user/course metadata for seeds, submitted questions, adapter results and retries.
- Checks: typecheck PASS; 56/56 unit/component tests PASS; build PASS; final E2E 6/6 PASS (14.2s); diff-check PASS. Contrast JSON and screenshots persist under `/tmp/fe-chat-cook-fixes-20261120/playwright`.
- Main retained all production ownership; E2E worker edited only its assigned file. Original checkout/user work preserved.
- Report: `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-ux-cook-test-fixes.md`.
- User subsequently requested local commits after every completed item. The completed related feature/code/tests/docs on this branch are authorized for a local commit; generated results and unrelated files are excluded. The resulting commit is recorded in Git history and the final response. No push/merge/PR authorized.
- Next stage: fresh independent Test, then Review with stage go-ahead. Prior Test report is retained as historical evidence.

## Review — 2026-11-20

- Reviewed commit: `437a550`, approved source base `8f36675`. User asked to continue after the completed test runs. A separate agent independently reviewed the actual production/test diff; main verified evidence and the additional contrast probe.
- Decision: **REQUEST CHANGES**, one Medium confirmed defect. Drawer heading eyebrow “NGUỒN THAM KHẢO MẪU” inherits #7772d9 on white and computes to 4.043699:1 at 390/1280px, below required 4.5:1. Existing contrast loop did not include this selector.
- No new Critical/High correctness/security defect identified in the fixture-only scope. Earlier metadata/disclosure and permission/dependency fixes are verified.
- Independently reran 18/18 adapter tests and 2/2 critical E2E (6.0s); both PASS. New eyebrow probe FAIL, exit1. No implementation/test/style files changed in Review.
- Report: `docs/reports/2026-11-20/2026-11-20-frontend-demo-chat-ux-review.md`. Evidence: `/tmp/fe-chat-review-20261120/`.
- Next: Cook a drawer-only eyebrow color override and include it in the browser contrast regression loop; then rerun affected checks. Review stage remains read-only for implementation.
- User's standing authorization covers a local commit of this completed Review report/handoff; no push/merge/PR performed.
