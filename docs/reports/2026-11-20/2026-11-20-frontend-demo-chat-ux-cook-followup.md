# Cook follow-up: course-scoped demo chat UX

Date: 2026-11-20
Status: IMPLEMENTED — focused Cook checks pass; independent Test/Review remain separate stages.

## Authorization and baseline

User request: “xác nhận tiếp tục cook”. Scope is the approved plan and the findings in `2026-11-20-frontend-demo-chat-ux-test.md`.

Continued the existing `/tmp/thanh-fe-demo-chat-ux` worktree, branch `thanh/fe-demo-chat-ux`, HEAD `54ec950` (documentation commit), approved source baseline `8f36675`. All existing tracked and untracked edits were retained. No branch creation/rebase, main update, commit, push, merge, or PR occurred. Remote-main freshness was not re-established or claimed; this is continuation of the explicitly approved branch.

Read Cook, frontend workflow, architecture, UI engineering, RAG chat, security, testing and Git-flow skills before writing. One read-only agent identified gaps; two agents owned disjoint test files after the modal fix stabilized. Coordination is recorded in the handoff.

## Changes mapped to the plan

| File | Plan phase | Change / reason |
| --- | --- | --- |
| `apps/web/src/features/student/pages/StudentWorkspace.tsx` | 2–4 | Native modal citation drawer; focus entry/containment/return, native Escape and backdrop handling; unique accessible title; per-course drafts; synchronous in-flight guard; empty conversation state; history/recent answers paired with their latest question; opt-in demo feedback failure/retry; reduced-motion scrolling. |
| `apps/web/src/shared/theme/styles.css` | 3–4 | Preserve existing drawer appearance with native-dialog geometry/backdrop and scrollable/wrapping content; style local feedback failure; fix mobile disclosure and demo controls occupying only half the context grid. |
| `apps/web/src/features/demo/adapters/demoData.ts` | 1, 3 | Two explicit fixture citations for the AI scenario, including a visibly synthetic second excerpt. No source access URL inferred. |
| `apps/web/src/shared/domain/types.ts` | 1, 3 | Local feedback failure stores the attempted rating without replacing the last successful rating. Existing scenario/retry additions preserved. |
| `apps/web/src/features/demo/adapters/chatScenarios.test.ts` | 1 | Verify multiple citation IDs, cross-course/unknown-course refusal, personal-fixture gating, technical failure and retry. |
| `apps/web/src/app/App.test.tsx` | 3, 5 | Verify fresh-answer citation rendering rather than accepting the seeded answer; modal focus/cancel/backdrop; inert hostile text and unsafe Markdown link text; feedback failure retains previous rating and retry applies the intended choice. |
| `apps/web/src/features/student/pages/StudentWorkspace.test.tsx` | 2, 3, 5 | Six regression tests: separate drafts, duplicate submission/pending controls, delayed response isolation, latest-question history status, history/rating isolation, no feedback on technical/refusal results. |
| `apps/web/e2e/demo.smoke.spec.ts` | 4–5 | Preserve entry/library smoke and add 390/768/1440 px demo chat → citation → feedback/failure/retry; native modal/background focus, Tab/Shift+Tab, Escape/close/backdrop return, viewport bounds, horizontal overflow, course/history/retry isolation and console error checks. |
| `docs/engineering/frontend-api-map.md` | 0, 5 | Record exact fixture behaviors and unavailable live operations. |
| `docs/plans/2026-11-20/frontend-demo-chat-ux.md` | 0, 5 | Reconcile obsolete section-12 DRAFT text with existing approval and user-confirmed Cook continuation. |
| `docs/handoffs/2026-11-20-frontend-demo-chat-ux.md` | 5 | Coordination, results, deviations and next stage. |

The earlier untracked `chatScenarios.ts` implementation was preserved. Existing routes, personas and other role screens were retained.

## Behavior decisions and limited deviations

- Drafts are keyed by course: switching shows that course's draft or empty input; returning restores the previous draft. Sending clears only that course's draft.
- An accepted fixture question remains in its original course while its timer completes. The other course remains usable; results never enter the newly selected course. This retains existing captured-course timer behavior rather than silently cancelling an accepted question on navigation.
- A response retry replaces its failed assistant response and does not create another student question. A refusal remains distinct from technical failure.
- The drawer uses native `showModal()` to make background content inert. Its sole interactive control is Close; Tab and Shift+Tab stay there. Cleanup returns focus to the still-connected opener. No dialog polyfill or new dependency was introduced; actual browser behavior is covered by Playwright, separately from jsdom's existing test stub.
- Feedback failure is explicitly opt-in through “Mô phỏng lỗi đánh giá một lần”. It affects one local attempt, preserves the successful rating, announces the simulated error, and retries the attempted choice. This is not a fabricated network/API contract.
- Source inspection found history/recent cards independently selecting the newest question and newest old answer. Pairing the answer after that question is a small necessary fix within course/history scope.
- Screenshot inspection found a pre-existing narrow-grid issue affecting disclosure/demo controls. Only their mobile `grid-column` rule was changed, with geometry assertions added.

## Checks executed during Cook

All commands below run from `apps/web` unless specified:

| Command | Result |
| --- | --- |
| `npx playwright install chromium` | PASS, exit 0; browser binaries installed in the local Playwright cache. No package/lockfile change. |
| `npm run typecheck` | PASS, exit 0. |
| `npm test -- --run` | PASS, exit 0; 5 files / 45 tests. |
| `npm run build` | PASS, exit 0; 92 modules. Rebuilt after final CSS fix. |
| `npm run test:e2e -- --workers=1` | PASS, exit 0; 5 tests / 11.0 seconds after the final mobile fix. |
| `git diff --check` at worktree root | PASS. |
| Diff inspection for new browser requests, raw HTML insertion and token storage | No additions found. |

During test development, a few initial assertions used ambiguous navigation names or treated the existing EmptyState title as a heading. They were corrected to observable markup; final tests passed. No production safeguards or assertions were weakened to obtain a pass. No lint script exists. Root Node workspace checks were not run because this change does not touch Node workspaces.

## Cook verification coverage

| Acceptance | Evidence |
| --- | --- |
| AC1 course context | Workspace course/history tests and browser course-selection journey. |
| AC2 distinct states | Scenario, App, workspace and browser refusal/error/retry cases; empty and pending assertions. |
| AC3 citations | Multi-citation scenario and App assertions; refusal has no sources; browser detail has no guessed download link. |
| AC4 accessible detail | Component focus/cancel/backdrop test and actual Chromium modality, background focus, Tab/Shift+Tab, Escape and focus-return assertions. |
| AC5 duplicate/retry/draft | Same pending submission is guarded, controls disabled, per-course unsent drafts restored; retry does not duplicate student message. |
| AC6 course/history isolation | Delayed response, history-selection and rating-isolation component tests; browser course/history journey. |
| AC7 feedback states | Local submitted/error/retry semantics tested in components and at all three browser widths; only answered messages expose ratings. |
| AC8 responsive/keyboard | 390/768/1440 px browser checks and screenshots; no horizontal overflow; drawer fits; mobile context width regression assertion. |
| AC9 untrusted content | Synthetic answer/title/snippet containing HTML/event handlers and javascript Markdown remains literal text; no injected DOM or anchors. No new network/storage code. |
| AC10 demo boundary | Explicit fixture/source/feedback disclosures and updated API map. |

These are Cook verification results, not an independent Test or Review approval. The previous failed Test report remains historical evidence.

## Visual evidence

Six screenshots were regenerated in `apps/web/test-results/` (generated, untracked):

- `demo.smoke-demo-chat-citat-73768--and-feedback-work-at-390px-chromium/{citation-drawer-390,chat-feedback-390}.png`
- `demo.smoke-demo-chat-citat-c769d--and-feedback-work-at-768px-chromium/{citation-drawer-768,chat-feedback-768}.png`
- `demo.smoke-demo-chat-citat-9bd7e-and-feedback-work-at-1440px-chromium/{citation-drawer-1440,chat-feedback-1440}.png`

Inspected the mobile drawer and mobile/medium/wide chat screenshots. Re-inspected the regenerated mobile chat screenshot after fixing the grid: disclosure and demo controls span the full context width. The browser assertions report no page exceptions or console errors. Existing typography/tokens were preserved; this was not a global visual redesign.

## Completed and outstanding

The focused Cook findings and planned demo regression checks are implemented. No known blocker remains for the next independent Test stage. Browser launch is now unblocked by the installed Chromium cache.

Still outside this demo scope: real Identity/Tenant authorization, sessions/CSRF, gateway contracts, file processing/retrieval, protected citation access and server feedback. Screen-reader testing, non-Chromium browsers, comprehensive contrast auditing, extreme long-content/zoom cases and independent Test/Review have not been completed or claimed. The local course context is not an authorization boundary.

Recommended next action: user-go-ahead for `$test` on this exact diff, followed by a separately authorized `$review`.
