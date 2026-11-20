# Test: final course-scoped demo chat UX verification

Date: 2026-11-20
Implementation tested: `f30b19f`
Approved source base: `8f36675`
**Overall status: PASS for the approved fixture-only frontend scope.**

## Scope and environment

User explicitly requested “tiếp tục test và review”, authorizing both stages sequentially. This is the completed Test stage, before starting Review. Standing authorization permits a separate local commit of each completed stage's report/handoff; no push, merge or PR is included.

Continued `/tmp/thanh-fe-demo-chat-ux`, branch `thanh/fe-demo-chat-ux`. The tracked tree was clean at `f30b19f`; existing generated `apps/web/test-results/` was the only untracked content. Compared the actual approved feature diff and the final CSS/test fix, and read source/tests rather than relying only on the Cook report.

Environment: Linux, Node `v24.14.0`, npm `11.9.0`, configured Playwright Chromium. Recorded SHA-256 hashes for all 45 tracked frontend source/config/test files; none changed during verification. No production code, test, config, dependency, backend or public contract changes were made.

## Commands and observed results

Commands from `apps/web` unless noted:

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS, exit 0 | No TypeScript diagnostics. |
| `npm test -- --run` | PASS, exit 0 | **56 tests / 5 files**, 6.26s. |
| `npm run build` | PASS, exit 0 | 92 modules; production JS/CSS generated. |
| `npm run test:e2e -- --workers=1 --output=/tmp/fe-chat-final-test-20261120/playwright` | PASS, exit 0 | **6/6 Chromium tests**, 15.1s; 390/768/1440px chat/citation/feedback plus entry/library, retry/history and permission/dependency journeys. |
| `git diff --check` at worktree root | PASS, exit 0 | No whitespace errors. |
| `git diff --exit-code -- apps/web contracts infrastructure packages services` | PASS, exit 0 | Implementation unchanged during Test. |
| Frontend SHA-256 before/after comparison | PASS | All 45 tracked files unchanged. |

No configured frontend lint/formatter script exists. Unchanged Node/OPA suites were not run. Real backend/session/CSRF/retrieval integration is outside the approved demo slice; no result here proves those unavailable services.

## Acceptance criteria

| Criterion | Status | Current evidence |
| --- | --- | --- |
| AC1 course context | PASS | Workspace tests and browser course/history selection use the correct assigned course and material context. |
| AC2 distinct states | PASS | Scenario/component/E2E checks distinguish empty, pending, answered, insufficient evidence, technical, permission and dependency results; retry semantics are explicit. |
| AC3 citation semantics | PASS | Multi-citation answered fixtures; errors/refusals expose no source/feedback; no fabricated source/download URL. |
| AC4 accessible detail | PASS within tested browser | Real native modal, inert background, close focus, Tab/Shift+Tab, Escape/close/backdrop and focus restoration exercised in Chromium. |
| AC5 duplicate/retry/draft | PASS | Per-course draft restore/clear, synchronous pending guard, disabled controls and retry replacing its original assistant response are asserted. |
| AC6 course/history isolation | PASS within local demo state | Delayed response stays in its original course, history reselects that course, and ratings remain scoped. Fixture metadata is copied and explicitly not authorization proof. |
| AC7 feedback states | PASS | Answer-only rating, successful submission, simulated failure preserving previous rating and retry applying intended choice. |
| AC8 responsive/keyboard/UI quality | PASS for tested surface | Viewport/overflow/mobile-grid/focus checks at 390/768/1440px. All six visible drawer text elements now meet >=4.5:1; the prior Review F1 is reproduced by the expanded test before the fix and absent now. |
| AC9 untrusted content/security | PASS within fixture boundary | Hostile answer/title/snippet/unsafe-link text remains literal; no injected HTML/link. No new live requests or token-storage/raw-HTML path. |
| AC10 demo boundary | PASS | UI and API map identify fixture data, unprocessed personal files, simulated permissions, local feedback and unavailable real source access. |

## Contrast regression results

Current browser-computed ratios are identical at all three viewport widths:

| Visible drawer text | Ratio |
| --- | --- |
| Eyebrow | **4.954033:1** |
| Document title | 10.908883:1 |
| Document-type label | 5.708172:1 |
| Page label | 4.954033:1 |
| Excerpt | 5.486109:1 |
| Demo disclosure | 5.708172:1 |

Permission/dependency badge assertions also pass (4.901223:1). The permanent regression loop now covers every visible drawer text element, including the previously missed eyebrow. Before-fix failure at 4.043699:1 is retained under `/tmp/fe-chat-eyebrow-fix-20261120/before`; no assertions or safeguards were weakened to obtain this pass.

Inspected the current mobile drawer screenshot; content fits and the close control/focus indicator are visible. Current E2E also checks page exceptions and console errors in the three viewport journeys. No new failure was observed.

## Regression analysis and limitations

The earlier Test disclosure/metadata failures and Review eyebrow finding are fixed on `f30b19f`. This latest run supersedes their results for the current implementation while retaining the historical reports below. No remaining confirmed regression was found in the approved slice.

This PASS is not production authorization, comprehensive WCAG certification or approval for live API integration. Screen readers, non-Chromium browsers, comprehensive theme contrast, extreme history sizes and full zoom/IME behavior remain unverified. Earlier temporary no-course/long-content probes remain supporting evidence on a prior revision; they were not counted as fresh tests in this run.

## Evidence and next stage

`/tmp/fe-chat-final-test-20261120/` contains `checks.json`, `e2e-check.json`, `source-hashes.json`, command logs, and `playwright/` screenshots/contrast JSON. Outputs were kept separate from previous Cook/Test/Review evidence and excluded from Git.

Next: proceed to the independently conducted Review already explicitly requested by the user. No additional confirmation is required to start it. Commit only this completed Test record and handoff, preserving the tested source unchanged.

---

## Historical Test reports (superseded for the current revision)

# Test — course-scoped demo chat UX (retest after Cook)

Date: 2026-11-20
**Overall status: FAIL — new citation-drawer text does not meet the required contrast gate.**

Typecheck, all 45 unit/component tests, production build and all 5 configured Chromium E2E tests pass. The previous keyboard-focus failure is fixed. The independent contrast check fails on two new drawer text styles; automated functional success is not a full acceptance pass.

## Scope, environment and unchanged diff

User invoked `$test` after approving the Cook follow-up. Read the actual tracked diff and untracked source/tests, approved plan, Cook handoff, frontend-testing/security/RAG skill guidance and the UI skill contrast gate. A separate read-only agent checked acceptance gaps without editing files or duplicating the test runs.

- Worktree: `/tmp/thanh-fe-demo-chat-ux`, branch `thanh/fe-demo-chat-ux`.
- HEAD: `54ec950`; source baseline: `8f36675`.
- Environment: Linux, Node `v24.14.0`, npm `11.9.0`, configured Playwright Chromium.
- Tested the uncommitted frontend implementation, including `chatScenarios.ts`, its tests, and `StudentWorkspace.test.tsx` (all untracked and therefore absent from plain `git diff`).
- No staged changes. No source/config/test files were edited, no dependencies changed, and no commit/push/merge/PR occurred during Test.
- Compared SHA-256 hashes for 47 source/config/test/plan/API-map files before and after verification: unchanged. Snapshot: `/tmp/fe-chat-test-20261120/source-before.json`.
- Browser results were written to a separate `/tmp/fe-chat-test-20261120/` directory so existing Cook screenshots/results were retained. Local verification servers and browser instances were closed afterward.

## Checks executed

Commands from `apps/web` unless stated otherwise:

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` | PASS | TypeScript completed without diagnostics. |
| `npm test -- --run` | PASS | 5 files / 45 tests; 6.23s. |
| `npm run build` | PASS | 92 modules; production JS/CSS generated. |
| `npm run test:e2e -- --workers=1 --output=/tmp/fe-chat-test-20261120/playwright` | PASS, exit 0 | 5 tests / 11.5s; 390, 768 and 1440 px journeys. |
| `git diff --check` at worktree root | PASS, exit 0 | No whitespace errors. |
| Additional browser boundary probes | PASS after one fixture-setup correction | No assigned course; whitespace/Shift+Enter/500-character limit; logout during pending; long hostile answer/title/snippet at 320 and 640 px. |
| Browser computed-style contrast probe and saved-result assertion | **FAIL**, assertion exit 1 | Disclosure 2.770:1; metadata label 4.096:1; both require 4.5:1. Snippet passes at 5.486:1. |
| Exported-baseline browser comparison at `8f36675` | PASS (classification check) | Baseline has inline details citations and no new drawer disclosure or metadata elements. |

No frontend lint/formatter script is configured. Root Node and OPA checks were not run because those implementations are untouched. Live API/authorization/CSRF/retrieval checks are outside this fixture-only slice and remain unavailable without the contracts/services.

## Acceptance matrix

| Criterion | Status | Executed evidence / limits |
| --- | --- | --- |
| AC1 course context | PASS | Workspace component tests and E2E course selection/history return. Extra no-course probe confirms disabled selection and absent composer/history log. |
| AC2 distinct states | PASS | Scenario/App/workspace tests cover empty, pending, answered, insufficient evidence, technical error and retry. Dedicated permission/dependency scenario remains a plan-detail gap below. |
| AC3 citation semantics | PASS | Matching course yields two fixed citations; other/unknown course and refusal produce no sources; browser opens correct fixture detail with no guessed source link. |
| AC4 accessible citation detail | PASS for modal interaction | Component focus/cancel/backdrop plus real Chromium native modality, inert background, Tab/Shift+Tab, Escape and return-to-opener assertions. Visual contrast failure is tracked under AC8. |
| AC5 duplicate/retry/draft | PASS | Per-course drafts, clear-only-submitted-draft, same-tick duplicate guard, disabled pending controls and replacement retry tested. Extra browser input-boundary probes pass. |
| AC6 history/course isolation | PASS | Delayed answer stays in its originating course; history reselects course and preserves its rating; new pending question does not inherit old answer status. Logout/pending session probe passes. |
| AC7 feedback states | PASS | Only answered messages expose rating; local success, simulated failure preserving old rating, and retry covered by component and browser tests. |
| AC8 responsive/keyboard/UI quality | **FAIL** | Geometry, overflow, mobile full-width controls and keyboard checks pass at configured widths; long-content probes also pass. Two drawer text styles fail the required normal-text contrast threshold. |
| AC9 untrusted content/security | PASS within demo boundary | Component and extra browser probes keep HTML/event handlers/javascript Markdown text inert; no injected DOM/links or payload execution. No new browser request/token-storage/raw-HTML code found. Backend enforcement is not proved by these tests. |
| AC10 demo boundary | PASS | UI and API map disclose fixtures, unprocessed personal files, local feedback and unavailable real source access. |

## Failure F1 — drawer text contrast (required fix)

Severity: moderate accessibility defect; not a runtime or data-isolation failure.

1. Open the demo as student and select Trợ lý AI.
2. Open the Neural Networks citation.
3. Inspect the document-type metadata label and the bottom demo disclosure text.
4. Read browser computed foreground/background colors and calculate the sRGB relative-luminance contrast ratio.

Measured values:

| Selector | Source | Computed color/background | Font | Actual | Required |
| --- | --- | --- | --- | --- | --- |
| `.citation-drawer-disclosure` | `apps/web/src/shared/theme/styles.css:800` | `rgb(150,155,172)` / white | 9px | **2.770:1** | 4.5:1 |
| `.citation-drawer-meta span` (inherits parent color) | `apps/web/src/shared/theme/styles.css:796` | `rgb(119,125,145)` / white | 9px | **4.096:1** | 4.5:1 |
| `.citation-drawer-snippet` | `apps/web/src/shared/theme/styles.css:799` | `rgb(96,102,122)` / `rgb(250,250,255)` | 11px | 5.486:1 | 4.5:1 |

The gate comes from `.agents/skills/frontend-ui-engineering/SKILL.md:33`, selected by the approved plan. This finding uses actual computed styles, not a screenshot-color estimate.

Regression classification: the two failing styles and their corresponding new drawer text were introduced by this feature diff. A separately exported `8f36675` tree was served and checked in Chromium: both selectors have zero matches; the old source UI is inline `<details>`. The old UI also contains pale text, so this is not a claim that the whole baseline was contrast-compliant. The failure is specific to new UI required to meet the chosen quality gate.

Recommended Cook fix: darken only the two failing text colors to meet 4.5:1 on their actual backgrounds and add a focused regression assertion. Preserve surrounding typography and layout; rerun the focused contrast check and relevant browser journey. No production fix was made in this Test stage.

## Additional gaps and limitations

- Plan phase 1 requested an explicit permission/dependency-error fixture and tenant/user metadata. Current `DemoChatResult` has generic technical error only; fixture types do not carry explicit tenant/user identifiers. Record this as incomplete planned demo coverage, not evidence of a backend authorization vulnerability. The no-assigned-course probe checks a different UI case and does not replace a permission-error fixture.
- Screen-reader and non-Chromium testing, comprehensive site-wide contrast, extreme-history performance, actual browser zoom and IME composition have not been verified. Reduced-motion mode was exercised by E2E; this is not a complete motion audit.
- Extra long-content probes changed only module fixture objects in isolated test browser memory. No repository fixture data was edited. They check overflow/inert rendering, not real document access or server validation.
- The first no-course probe changed fixture data after quick-entry buttons had captured their persona data, so its setup failed to create an empty-course session. Retested only that case through the actual login form, which reads the changed fixture at submission; passed. This was a probe-setup error, not a product defect; original and retest output are retained.

## Evidence artifacts

All additional scripts and results are under `/tmp/fe-chat-test-20261120/`:

- `playwright/`: six current-run drawer/chat screenshots at 390/768/1440 px.
- `boundary-probes.mjs`, `boundary-results.json`, `boundary-results-retest.json`: extra browser cases and the corrected no-course run.
- `contrast-probe.mjs`, `contrast-results.json`, `contrast-drawer.png`: computed colors, measured ratios and screenshot.
- `baseline-probe.mjs`, `baseline-results.json`, `baseline/`: exported source-baseline comparison.
- `long-citation-320.png`, `long-citation-640.png`: hostile/long citation wrapping and scrolling.

Visually inspected the current drawer, 320px long-title drawer and wide chat screenshots. The drawer focus regression is fixed and source text wraps/scrolls, but measured contrast prevents a full PASS.

## Next action

Return to `$cook` for the two localized contrast fixes and resolution/explicit deferral of the remaining phase-1 fixture gap, then rerun Test. Do not advance to Review as if this run passed. No source change, commit or remote operation was performed.

---

## Historical Test run before Cook follow-up

The previous report is retained below for traceability; the latest results above supersede it.

# Test — course-scoped demo chat UX

Date: 2026-11-20
Overall: FAIL — AC4 modal keyboard behavior is incomplete; other acceptance coverage is partial.

## Scope and evidence

Tested existing uncommitted implementation on `thanh/fe-demo-chat-ux`, HEAD `54ec950`, baseline `8f36675`, worktree `/tmp/thanh-fe-demo-chat-ux`. Preserved all existing work. This session performed verification only and did not change production code.

## Commands executed

From apps/web:
- `npm run typecheck`: PASS, exit 0.
- `npm test -- --run`: PASS, exit 0, 4 files / 34 tests.
- `npm run build`: PASS, exit 0, Vite production build, 92 modules.
- `npm run test:e2e`: BLOCKED. Sandbox execution could not start the web server; execution outside sandbox started Vite but browser launch failed because Playwright chromium_headless_shell-1248 is absent. No browser assertion ran. System Chrome exists, but the configured project uses Playwright Chromium; no configuration was changed.
- `git diff --check` from worktree root: PASS.

No lint script is configured. Browser visual QA and screen-reader testing were not completed.

## Acceptance mapping

| Criterion | Status | Evidence / gap |
| --- | --- | --- |
| AC1 course context | PARTIAL | Existing course UI and scopedCourses inspected; no chat course-context E2E. |
| AC2 distinct states | PASS | Scenario tests and App tests distinguish answered, insufficient evidence, technical failure and retry. |
| AC3 citation semantics | PARTIAL | Matching fixture and no-evidence tests pass; multi-citation coverage absent. |
| AC4 accessible detail | FAIL | StudentWorkspace.tsx ChatMessageView focuses close button and handles Escape; CitationDrawer declares aria-modal but has no focus containment or return-to-opener behavior. |
| AC5 duplicate/retry/draft | PARTIAL | Retry replacement test passes; duplicate submission and course-switch draft behavior lack assertions. |
| AC6 course/history isolation | PARTIAL | messagesByCourse separates state; no cross-course pending/history regression test. |
| AC7 feedback | PARTIAL | Local positive feedback test passes; planned failure/retry scenario is not implemented. |
| AC8 responsive/keyboard | BLOCKED | Browser not installed for configured Playwright project; no screenshots or keyboard browser evidence. |
| AC9 untrusted content | PARTIAL | Text rendered as React text, no citation URL fabricated; hostile input behavior lacks regression test. |
| AC10 demo boundary | PASS | UI explicitly identifies fixtures, no actual model/API call, and unavailable document download. |

## Findings and reproduction

1. Modal keyboard defect introduced by citation drawer change: open a sample citation, then Tab from its close button. There is no key handler or native modal to prevent focus reaching background controls. Closing removes focused control without restoring focus to its citation opener. This is a source-confirmed missing mechanism, not a browser-observed result. Existing App test checks opening and closing only.
2. Planned chat E2E remains missing: e2e/demo.smoke.spec.ts covers login/home/personal library, not question → citation → feedback or retry.
3. Handoff marks Cook DONE despite missing evidence for several planned checks. Treat delivery as incomplete pending the above acceptance work.
4. Plan header is APPROVED but section 12 still says DRAFT; reconcile in the next implementation/documentation pass.

## Next action

Return to Cook to fix modal focus containment/return, add relevant interaction and course-isolation tests and the planned chat E2E, then rerun Test with a supported browser. Keep live gateway/auth/CSRF/retrieval integration outside this fixture-only scope. No commit, push, merge or PR performed.

## Subsequent Cook follow-up

The user authorized Cook fixes on 2026-11-20. See `2026-11-20-frontend-demo-chat-ux-cook-followup.md` for the implementation and current Cook verification results. This original Test result is retained; it is not retrospectively changed to PASS. Independent retesting is the next stage.

## Subsequent Cook — contrast and fixture fixes

After this Test run, the user authorized Cook fixes. See `2026-11-20-frontend-demo-chat-ux-cook-test-fixes.md`: the reported drawer contrast defects and missing fixture cases/metadata were fixed; Cook verification reports typecheck, 56 tests, build and 6 E2E passing. This historical independent Test verdict has not been relabeled PASS. A fresh independent Test remains the next stage.
