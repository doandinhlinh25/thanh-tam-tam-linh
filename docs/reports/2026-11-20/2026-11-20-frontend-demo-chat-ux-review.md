# Review: final course-scoped demo chat UX acceptance

Date: 2026-11-20
Reviewed tree: `b4b5a15` (passing Test report commit)
Implementation: `f30b19f`
Approved source base: `8f36675`
**Decision: APPROVE for the approved fixture-only frontend scope.**

## Summary and independence

The user explicitly authorized sequential Test and Review in the current request. Test completed with PASS, and its report/handoff were committed separately as `b4b5a15`. Then an independent agent, which did not author the implementation, reviewed the actual source/test diff and current evidence. Main assessed scope and verified the implementation remained unchanged after Test.

No unresolved confirmed Critical, High, Medium or Low defect remains in the current feature diff. No additional implementation changes or acceptance conditions are required for this demo slice. The prior Review F1 is resolved and now has permanent regression coverage.

Only this Review report and the handoff are written in this stage. The user's standing local-commit instruction authorizes committing this completed record; no push, merge or PR is included. Existing generated `apps/web/test-results/` is preserved and excluded.

## Scope and prior finding resolution

The complete `8f36675...b4b5a15` diff matches the approved fixture-backed student course/chat journey. The latest production fix is a single drawer-scoped color override, and its test change expands the existing browser contrast loop. There are no dependency, backend, gateway, API contract, authentication or streaming changes.

Prior confirmed F1 is **resolved**:

- `apps/web/src/shared/theme/styles.css:795` scopes `#6962ce` to `.citation-drawer-heading .eyebrow`; the global shared eyebrow style is untouched.
- `apps/web/e2e/demo.smoke.spec.ts:95` now measures all six visible drawer text elements.
- Current-run JSON at 390/768/1440px contains six measurements each, minimum **4.954033:1**, compared with the former **4.043699:1** failure.
- The before-fix red regression and after-fix success are retained as evidence; the threshold was not lowered and no safeguard was removed.

## Acceptance coverage

| Criterion | Review result | Source and test evidence |
| --- | --- | --- |
| AC1 course context | PASS within demo scope | Assigned-course filtering/selected context; component and browser course/history assertions. |
| AC2 distinct states | PASS | Discriminated result model; explicit technical, permission and dependency scenarios; separate empty/pending presentation. |
| AC3 citations | PASS | Answered fixtures supply metadata; errors/refusals contain no citations; no guessed source URL. |
| AC4 accessible detail | PASS within tested browser | Native showModal, focus entry/return, native cancel, backdrop dismissal and browser assertions for modality/inert background/Tab/Shift+Tab/Escape. |
| AC5 duplicate/retry/draft | PASS | Synchronous timer Map guard, per-course draft state, disabled controls, retry replacing a response without duplicating its question. |
| AC6 course/history isolation | PASS within local demo state | Originating course/context captured by delayed callback; latest question paired with its following answer; copied metadata traces fixtures only. |
| AC7 feedback | PASS | Answer-only rating; failed intent preserves successful rating; retry applies the intended choice. |
| AC8 responsive/keyboard/UI quality | PASS for tested surface | 390/768/1440px geometry/overflow/grid/focus and all six drawer text contrasts; prior F1 fixed locally. |
| AC9 untrusted content/security | PASS within fixture boundary | Literal React text rendering and hostile-content assertions; no added live transport, raw HTML insertion or token storage. |
| AC10 demo boundary | PASS | UI/fixtures/API map identify synthetic data, simulated permissions, local feedback and unavailable real source access. |

## Assessment of test evidence

Read the current canonical Test report and its actual logs/exit-status JSON under `/tmp/fe-chat-final-test-20261120/`:

- `npm run typecheck`: exit 0.
- `npm test -- --run`: exit 0, **56/56 tests / 5 files**, 6.26s.
- `npm run build`: exit 0, 92 modules.
- `npm run test:e2e -- --workers=1 --output=/tmp/fe-chat-final-test-20261120/playwright`: exit 0, **6/6 Chromium E2E**, 15.1s.
- Actual contrast JSON, not just the report: eyebrow/page label 4.954033:1; title 10.908883:1; metadata/disclosure 5.708172:1; excerpt 5.486109:1. Permission/dependency badges 4.901223:1.

The tests target meaningful observable regressions: duplicate submission, delayed course isolation, history pairing, refusal/error distinctions, native browser modality, feedback failure/retry and inert text rendering. The former contrast selector gap is closed.

No duplicate test/server runs were needed during Review: Test had just rerun the full configured suite on the exact unchanged implementation. Verified `git diff --exit-code f30b19f..HEAD -- apps/web contracts infrastructure packages services` and the saved frontend SHA-256 manifest: all 45 tracked frontend files remain identical to the tested source. `git diff --check 8f36675...HEAD` passes. No implementation files were changed in either verification stage.

## Non-blocking suggestions (not defects or acceptance conditions)

### S1 — Suggestion, Low: retain extra boundary probes

- **Location:** `apps/web/e2e/demo.smoke.spec.ts` and prior temporary Test scripts under `/tmp/fe-chat-test-20261120/`.
- **Finding/evidence:** Permanent tests cover the critical flow, but earlier no-course/long-content browser probes were retained only as temporary scripts, not the current configured suite.
- **Impact:** Future work could lose convenient regression coverage for those additional cases; no present failure is demonstrated.
- **Recommendation:** Add them in a separately scoped test-maintenance task when that coverage is prioritized.

### S2 — Suggestion, Low: define a real history policy before integration

- **Location:** `StudentWorkspace` in-memory conversation state and message-list rendering.
- **Finding/evidence:** The current slice is a session-local fixture demo with no server history/pagination contract.
- **Impact:** Real data sizes will need an explicit retention/pagination/rendering policy; this review does not establish a current demo performance defect.
- **Recommendation:** Agree that policy with the Chat contract owner before adding real server history, rather than inventing an endpoint or pagination rule now.

## Remaining risks and decision boundaries

APPROVE applies to the approved demo only. Real server authorization, tenant isolation, session/CSRF, gateway routes, ingestion/retrieval, protected sources and persisted feedback remain unimplemented/outside scope. Passing mocks or browser-selected context is not proof of those controls.

Screen readers, non-Chromium browsers, comprehensive site-wide contrast, extreme histories and full zoom/IME behavior remain unverified and are not certified by this approval. These disclosed limitations are not newly confirmed regressions in the reviewed slice.

## Completion and next action

The approved demo slice can be accepted at implementation `f30b19f`. Test PASS and Review APPROVE are now both recorded. Commit this completed Review record/handoff locally under standing authorization. A new feature or real integration requires its own scoped requirements/contract work; no push, merge or PR is performed by this acceptance.

---

## Historical Review (superseded for the current revision)

# Review: course-scoped demo chat UX

Date: 2026-11-20
Reviewed source commit: `437a550`
Approved source base: `8f36675`
**Decision: REQUEST CHANGES — one remaining Medium accessibility defect leaves AC8 unmet.**

## Scope and independence

The user asked whether testing was complete and instructed continuation if it was. The latest Cook evidence records typecheck, 56 unit/component tests, build and 6 E2E passing on the source now committed as `437a550`. Proceeded with Review, using that actual evidence rather than interpreting historical Test FAIL reports as current functional failures.

A separate agent, independent of the Cook implementation, inspected the actual `8f36675...437a550` source/test diff against the approved plan. Main independently checked scope, test artifacts and the reported contrast finding, and reran targeted critical tests. No implementation, test, style, plan or API-map changes were made during Review. Allowed writes are this report and the handoff. The user's earlier instruction authorizes a local commit of each completed item, including this completed Review record; it does not authorize a push/merge/PR.

The change stays inside the approved fixture-backed student chat journey. No service/gateway contract, dependency, real authentication, streaming or retrieval implementation was added. Existing synthetic personas and data remain disclosed as demo-only.

## Summary

No confirmed Critical or High correctness/security defect was found in the reviewed fixture-only scope. Course drafts, pending responses, synchronous duplicate protection, retry replacement, history pairing, native modal lifecycle, local feedback and literal-text rendering are coherent and covered by useful tests. Earlier drawer disclosure/metadata contrast failures and missing permission/dependency fixtures are fixed.

One additional text label in the new drawer reuses a shared color that falls below the selected UI skill's normal-text contrast gate. The current regression loop measures the disclosure and metadata only, so it did not catch this label. This is a specific, reproducible acceptance failure, not a claim that the entire pre-existing theme was contrast-compliant.

## Findings, sorted by severity

### F1 — Confirmed defect, Medium: drawer eyebrow text contrast

- **Location:** `apps/web/src/features/student/pages/StudentWorkspace.tsx:303`; shared `.eyebrow` color at `apps/web/src/shared/theme/styles.css:86`; drawer white background at `styles.css:793`.
- **Finding:** “NGUỒN THAM KHẢO MẪU” renders with `rgb(119,114,217)` (`#7772d9`) on white. Browser-computed contrast is **4.043699:1**, below the required **4.5:1**.
- **Impact:** This normal-sized label is harder to read and prevents AC8 from meeting the required UI quality gate. It is 12px at weight 800 in the actual browser, which does not qualify as large text.
- **Evidence:** All `.eyebrow` selectors were inspected; the teacher-specific alternate color does not apply. A Chromium probe confirmed the computed color, white background, 12px font and ratio at both 390px and 1280px widths. The probe exited 1. The requirement is in `.agents/skills/frontend-ui-engineering/SKILL.md:33`, selected by the plan.
- **Reproduction:** Enter the student demo → Trợ lý AI → open the Neural Networks citation → inspect the uppercase label above the document title.
- **Smallest recommendation:** Override only `.citation-drawer-heading .eyebrow`, for example with the existing `#6962ce` color (about 4.954:1 on white), then include that selector in the browser contrast regression loop. Preserve the global shared style and the surrounding layout. Recheck all visible drawer text rather than adding another disclosure-only assertion.
- **Regression classification:** A shared baseline color is reused by new drawer content; the failing current feature surface is new. This does not establish a global baseline accessibility regression.

No other confirmed defects were identified in this review. Screen-reader/non-Chromium and extreme-history behavior remain limitations, not newly demonstrated regressions.

## Acceptance coverage

| Criterion | Review result | Evidence |
| --- | --- | --- |
| AC1 course context | PASS within demo scope | Scoped courses/documents, selected-course rendering, component and E2E course/history checks. |
| AC2 distinct states | PASS | Empty/pending/answered/refusal/technical/permission/dependency scenarios; error causes and retry policy are explicit. |
| AC3 citations | PASS | Two fixed citations only on answered results; error/refusal cases have empty citations; no guessed source/download URL. |
| AC4 modal interaction | PASS | Native showModal, close focus, Tab/Shift+Tab handling for sole close control, native cancel/Escape, backdrop and opener restoration; browser checks exercise these. |
| AC5 duplicate/retry/draft | PASS | Per-course drafts, synchronous timer Map guard, disabled controls and retry replacing the original response. |
| AC6 course/history isolation | PASS | Captured context/course, course-keyed messages, latest question paired only with its following answer, local rating isolation. This is UI state behavior, not backend authorization proof. |
| AC7 feedback | PASS | Answer-only ratings; opt-in failure retains prior rating; retry applies intended choice. |
| AC8 responsive/keyboard/UI quality | **FAIL** | Responsive geometry/overflow/keyboard checks pass; F1 text contrast remains below the required threshold. |
| AC9 untrusted data/security | PASS within fixture boundary | React text rendering, hostile-content regression test, no new raw HTML insertion, browser request or token storage; context metadata is explicitly tracing-only. |
| AC10 demo boundary | PASS | UI disclosures and API map distinguish fixtures from unavailable live operations. |

The decision follows the Review skill rule for unmet acceptance criteria. There are no unresolved Critical/High findings, but the confirmed AC8 failure prevents APPROVE.

## Assessment of test evidence

### Existing evidence checked

The Cook report and `/tmp/fe-chat-cook-fixes-20261120/checks.json`/logs record typecheck, all **56 tests / 5 files**, and build exiting 0. The final full Chromium E2E run passed **6/6**, with contrast JSON and screenshots at 390/768/1440px under `/tmp/fe-chat-cook-fixes-20261120/playwright`.

The tests assert observable states and interactions and would catch relevant regressions. In particular, duplicate submission and delayed-course isolation use a controlled timer; permission denial cannot retry away its error; feedback failure preserves its successful selection; browser tests verify true native modality and focus return. No assertion weakening or production safeguard removal was found.

The contrast helper correctly measures the selected opaque text/background colors. Its **selector coverage**, rather than its formula, is incomplete: `apps/web/e2e/demo.smoke.spec.ts:94–102` covers disclosure and metadata, not the heading eyebrow.

### Critical checks independently rerun during Review

| Command | Result |
| --- | --- |
| `npm test -- --run src/features/demo/adapters/chatScenarios.test.ts` | PASS, exit 0; **18/18**, 469ms. |
| `npm run test:e2e -- --workers=1 --grep '390px\|permission denial' --output=/tmp/fe-chat-review-20261120/playwright` | PASS, exit 0; **2/2**, 6.0s. Drawer metadata/disclosure remain 5.708:1; permission/dependency badges remain 4.901:1. |
| `node /tmp/fe-chat-review-20261120/eyebrow-contrast.mjs` | **FAIL**, exit 1; heading eyebrow 4.043699:1 at both widths. |
| `git diff --check HEAD^` | PASS. |
| `git diff --exit-code -- apps/web contracts infrastructure packages services` | PASS; implementation unchanged during Review. |

No source fix was made to turn a failed check into a pass. Full unrelated Node/OPA checks were not rerun, and no frontend lint script exists. Local browser/server instances used for the probe were closed.

## Evidence and remaining risks

- Current Review artifacts: `/tmp/fe-chat-review-20261120/eyebrow-contrast.{mjs,json}`, `drawer-eyebrow-390.png`, `drawer-eyebrow-1280.png` and `playwright/`.
- Prior Cook/test evidence remains retained. Historical Test verdicts were not rewritten.
- Real Identity/Tenant authorization, sessions/CSRF, gateway contracts, retrieval/ingestion, protected sources and server feedback remain unimplemented/outside this demo approval scope.
- Non-Chromium, screen-reader, comprehensive theme contrast, extreme-history performance and full zoom/IME coverage are not certified. Retaining the previous temporary no-course/long-content probes as repository tests is a useful future improvement, not an additional confirmed defect here.

## Recommended next action

Return to Cook for the single scoped eyebrow color fix and expanded drawer-text contrast assertion, rerun the affected checks, and commit the completed fix under the user's standing local-commit instruction. Review-only rules prohibit implementing that fix in this stage. Do not accept the feature as fully approved or begin live integration on the strength of the passing functional suite alone.
