# Cook: fix Test contrast failure and missing demo fixtures

Date: 2026-11-20
Status: IMPLEMENTED — Cook verification passes.

## Scope and authorization

User invoked `$cook kiểm tra lại test và sửa lỗi` after the independent Test report. Existing approved plan phases 1 and 3–5 cover the missing fixture metadata/scenarios, state presentation, contrast and regression checks. Later in this Cook turn, the user explicitly requested a local commit after each completed item. Local commit preparation therefore includes the completed related FE work already accumulated on this branch; generated browser results and unrelated files are excluded. No push/merge/PR is authorized by that instruction.

Continued `/tmp/thanh-fe-demo-chat-ux`, branch `thanh/fe-demo-chat-ux`, pre-edit HEAD `54ec950`, approved source baseline `8f36675`. Inspected tracked/untracked changes before editing and kept all prior work. The original checkout remains on `thanh/init-fe` with its existing untracked work. No new branch, rebase, dependency change or main update was needed. Remote-main freshness was not claimed.

## Changes and plan mapping

| File | Phase | Change |
| --- | --- | --- |
| `apps/web/src/shared/theme/styles.css` | 4 | Darken drawer metadata/disclosure to the existing `#60667a` shade; preserve font sizes/layout. Also darken the error badge to existing `#a74e58` so new permission/dependency labels meet contrast on their pale-pink background. |
| `apps/web/src/shared/domain/types.ts` | 1 | Define local `DemoChatContext` and `DemoChatErrorKind`; attach optional tracing metadata to the view message type. These are not API DTOs or authorization claims. |
| `apps/web/src/features/demo/adapters/demoData.ts` | 1 | Define deterministic technical, permission and dependency error fixtures with explicit retry policies. A synthetic tenant and the current demo user/course populate seed/submission context. |
| `apps/web/src/features/demo/adapters/chatScenarios.ts` | 1, 3 | Adapter results carry a copied tenant/user/course context and `demoOnly: true`. Permission denial is non-retryable; dependency failure can recover without inventing evidence. Error results have empty citations and distinct causes. |
| `apps/web/src/features/student/pages/StudentWorkspace.tsx` | 2–3 | Add labeled demo scenario controls and distinct error labels in chat/history/recent cards. Capture context with submitted questions; preserve it on retry, and clear obsolete error/retry fields on recovery. |
| `apps/web/src/features/demo/adapters/chatScenarios.test.ts` | 1, 5 | Cover all error causes, permission persistence, dependency recovery, context copy and identity separation, and seed attribution to the actual demo user. Preserve earlier scenario tests. |
| `apps/web/e2e/demo.smoke.spec.ts` | 3–5 | Browser-computed contrast regression at 390/768/1440px; permission/dependency UI semantics, no citation/feedback/retry on denial, scoped history and replacement retry. Persist measured colors/ratios as JSON. |
| `docs/engineering/frontend-api-map.md` | 0, 5 | Document explicit fixture scenarios and tracing-only metadata; keep production contract gaps clear. |
| `docs/plans/2026-11-20/frontend-demo-chat-ux.md` | 5 | Record corrective pass and the user's subsequent local-commit authorization. |
| Handoff and historical Test report | 5 | Record current results without retrospectively changing the independent Test verdict. |

Main agent owned production/fixtures/unit tests/docs. A worker owned only the E2E file after shared behavior stabilized, per the recorded coordination table. Source review compared changes with the previous Test snapshot; only intended production/test/plan/API-map files changed.

## Actual verification results

Commands from `apps/web` unless stated:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0. |
| `npm test -- --run src/features/demo/adapters/chatScenarios.test.ts` | PASS, 17 scenario tests at that point; one additional identity-separation test was then added. |
| `npm test -- --run` | PASS, exit 0; 5 files / **56 tests**, 6.82s. |
| `npm run build` | PASS, exit 0; 92 modules. |
| `npm run test:e2e -- --workers=1 --output=/tmp/fe-chat-cook-fixes-20261120/playwright` | PASS, exit 0; **6 tests**, 14.2s in final run after error-badge assertions and JSON persistence were added. |
| `git diff --check` | PASS from worktree root. |

No configured frontend lint/formatter exists. Root Node/OPA checks were not run because those implementations are unchanged. No test assertion was loosened, no production check removed, and no public endpoint or live authorization added.

### Measured contrast

Browser computed colors confirm:

| Text | Before | After | Requirement |
| --- | --- | --- | --- |
| Drawer disclosure | 2.770:1 | **5.708:1** | >=4.5:1 |
| Drawer metadata | 4.096:1 | **5.708:1** | >=4.5:1 |
| Permission/dependency error badge | 4.133:1 with prior error color | **4.901:1** | >=4.5:1 |

The drawer checks ran at all three configured widths; both new error badges were measured in their browser journey. Inspected the regenerated mobile drawer screenshot: it fits and the text retains the existing visual hierarchy with improved readability.

## Artifacts and preservation

- `/tmp/fe-chat-cook-fixes-20261120/{checks.json,typecheck.log,unit.log,build.log}` contain main-run exit statuses and output.
- `playwright/` below that directory contains current screenshots and per-viewport `citation-text-contrast.json`, plus `error-badge-contrast.json` in the permission/dependency case output folder.
- Earlier Test evidence and Cook screenshots remain in their prior directories.
- Original checkout status was rechecked: its tracked/untracked user work is unchanged.
- Local commit stages only intended feature files and docs; `apps/web/test-results/`, built assets, node_modules and external `/tmp` evidence are excluded.

## Completed, deviations and remaining limits

The two reported contrast defects and the missing phase-1 fixture cases/metadata are addressed. No scoped item from this corrective pass remains outstanding. The small additional badge-color change is within the same error-state surface and follows a measured 4.133:1 failure; it reuses an existing color rather than redesigning the theme.

Metadata is synthetic fixture tracing. Real authorization, tenant isolation, session/CSRF, gateway routes, retrieval and source access remain outside scope and unverified. Screen readers, other browsers and comprehensive site-wide accessibility are not certified by these tests.

These are Cook verification results. The previous independent Test FAIL remains historical; the recommended next workflow stage is a fresh Test of the committed diff, then Review after stage go-ahead.
