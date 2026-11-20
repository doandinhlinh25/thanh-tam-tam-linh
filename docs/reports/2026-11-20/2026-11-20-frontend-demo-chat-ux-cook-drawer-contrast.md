# Cook: citation drawer heading contrast

Date: 2026-11-20
Status: IMPLEMENTED — corrective-pass verification passes.

## Authorization, scope and baseline

User invoked `$cook bước tiếp` after Review F1. The requested fix is fully specified and falls within approved plan phases 4–5: one drawer-only color override and expanded contrast regression coverage. The standing instruction to commit each completed, verified item authorizes a local commit; no push, merge or PR is included.

Continued branch `thanh/fe-demo-chat-ux` in `/tmp/thanh-fe-demo-chat-ux`. Pre-edit HEAD was `da8b9b1`; reviewed implementation was `437a550`, approved source base `8f36675`. Preflight showed no tracked changes and only existing generated `apps/web/test-results/` as untracked. No branch switch, rebase, remote-main freshness claim, dependency change or unrelated source edit was needed.

## Files changed and plan mapping

| File | Phase | Reason |
| --- | --- | --- |
| `apps/web/src/shared/theme/styles.css` | 4 | Add only `.citation-drawer-heading .eyebrow { color: #6962ce; }`, reusing the existing drawer page-label color. Keep the shared global eyebrow color, font sizes, spacing and layout unchanged. |
| `apps/web/e2e/demo.smoke.spec.ts` | 5 | Expand existing >=4.5:1 browser contrast loop from two selectors to all six visible drawer text elements: eyebrow, document title, document-type label, page label, excerpt and demo disclosure. |
| `docs/handoffs/2026-11-20-frontend-demo-chat-ux.md` | 5 | Record ownership, reproduction, actual results and next stage. |
| This report | 5 | Preserve evidence and map the localized fix to the approved plan. |

Main owned all writes. A read-only assistant confirmed that the six selectors cover every visible text element in the current drawer markup, and the local override does not affect shared eyebrows on other screens. The close control contains an SVG, not omitted visible text. No separate Review stage was started by that assistance.

## Regression proof: before and after

The regression assertion was expanded **before** changing CSS. Executed:

`npm run test:e2e -- --workers=1 --grep 390px --output=/tmp/fe-chat-eyebrow-fix-20261120/before`

Result: expected **FAIL**, exit 1, exactly at `.citation-drawer-heading .eyebrow`: received **4.043699:1**, required >=4.5:1. This demonstrates the new assertion detects the reported defect instead of merely mirroring a CSS value.

Applied the one-line scoped CSS override, then executed the actual frontend checks:

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0. |
| `npm test -- --run` | PASS, exit 0; **56 tests / 5 files**, 6.47s. |
| `npm run build` | PASS, exit 0; 92 modules. |
| `npm run test:e2e -- --workers=1 --output=/tmp/fe-chat-eyebrow-fix-20261120/after` | PASS, exit 0; **6/6**, 14.8s. |
| `git diff --check` | PASS. |

Commands run from `apps/web`, except diff checks from the worktree root. No configured frontend lint script exists. Unchanged Node/OPA checks were not rerun.

## Actual browser measurements

Persisted JSON at 390, 768 and 1440px confirms the same ratios at all three widths:

| Visible text | Contrast |
| --- | --- |
| Drawer eyebrow | **4.954033:1** |
| Document title | 10.908883:1 |
| Document-type label | 5.708172:1 |
| Page label | 4.954033:1 |
| Source excerpt | 5.486109:1 |
| Demo disclosure | 5.708172:1 |

All six satisfy the >=4.5:1 normal-text gate used by the tests. The existing focus/keyboard, geometry, feedback, retry and permission/dependency E2E checks continue to pass. Inspected the regenerated mobile drawer screenshot: the hierarchy and fit remain intact.

## Evidence

Under `/tmp/fe-chat-eyebrow-fix-20261120/`:

- `before/`: expected failing regression trace and error context, retained separately.
- `after/`: successful E2E screenshots, per-viewport `citation-text-contrast.json` and error-badge measurements.
- `checks.json`, `typecheck.log`, `unit.log`, `build.log`: actual exit statuses and output.

Generated evidence and existing `apps/web/test-results/` are excluded from the local commit.

## Completed, deviations and remaining limits

Review F1 is addressed in code and caught by the expanded regression test. No deviations or outstanding implementation tasks remain in this corrective pass. The production diff is one scoped color declaration; no global redesign or unrelated correction was made.

Historical Test/Review reports remain unchanged as records of their reviewed revisions; this Cook verification is not a retrospective independent approval. Next workflow step is `$test`, followed by Review with stage go-ahead. Real services/authorization and broader screen-reader/non-Chromium/site-wide accessibility remain outside this fixture-only fix.
