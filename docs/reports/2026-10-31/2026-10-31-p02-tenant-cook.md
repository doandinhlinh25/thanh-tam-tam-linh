# P02-tenant — COOK (2026-10-31)

## Baseline and approval

- User explicitly approved AC-P02-01 through AC-P02-06 in `P02-tenant — APPROVED → COOK`. `docs/plans/2026-10-31/p02-tenant.md` was marked `Status: APPROVED (by chủ dự án, 2026-10-31)` before source edits.
- Source branch `Linh` HEAD `066baea8592f6f45e538272b947a3a2473c77305`. New worktree `.worktrees/p02-tenant-r0` is on `ai/p02-tenant-r0`, created directly from `Linh`; its HEAD remains `066baea`. No commit, push, merge, rebase or PR.
- Original checkout's tracked/untracked user work was preserved. PLAN and handoff were untracked there and copied to this worktree after checking target files did not exist.

## Implemented by task

| Task | File | Old behavior | Change | Evidence/status |
| --- | --- | --- | --- | --- |
| T0 | Worktree and P02 artifacts | PLAN/handoff absent from new worktree | Created P02 branch/worktree from `Linh`; copied approved artifacts | `rev-parse HEAD` and `merge-base Linh HEAD` both `066baea`; done |
| T1 | `services/tenant-service/test/internal.integration.test.ts` | No owner-path HTTP regression for course state | Added fixture and expected 403 assertions for draft/archived upload/chat | Pre-fix run failed during test setup: sandbox Node `uv_os_get_passwd ENOMEM`; outside sandbox Mongo binary 7.0.24 absent and began a ~600 MB download, which was stopped. Assertions `NOT RUN`; no false red result claimed. |
| T2 | `services/tenant-service/services/course.service.ts` | Owner/admin bypassed active-course check | Only `document:upload` and `chat:ask` require active course before owner/admin grant; other actions retain prior branch order | Typecheck/build exit 0; HTTP assertions `NOT RUN` |
| T3 | Same source and test file | Student list reused `document:upload`, which would be denied on draft/archived | Use `course:read` plus active tenant-scoped membership role guard; owner/admin retain access, enrolled student still denied, lecturer still needs assignment and active course | Typecheck/build exit 0; HTTP assertions `NOT RUN` |
| T4 | Tenant test file | Missing negative credential/tenant/quota regressions | Added test-only tenant A/B, manager, lecturer, student, wrong service token, missing session, forged actor, quota retry/conflict and DB count checks | Test compiles; runtime `NOT RUN` due missing Mongo binary |
| T5 | This report and handoff | No COOK evidence | Recorded commands, limits, P08 follow-up, rollback | Done |

## Acceptance criteria at COOK boundary

| Criterion | Implementation evidence | Runtime evidence |
| --- | --- | --- |
| AC-P02-01 | Narrow active guard in `canAccessCourse`; active/draft/archived HTTP cases added | `NOT RUN` |
| AC-P02-02 | `getCourseStudents` uses `course:read` and explicit role guard; detail/edit/assign/enroll/list cases added | `NOT RUN` |
| AC-P02-03 | No auth middleware or route changes; A/B, assignment/enrollment, token/session negative cases added | `NOT RUN` |
| AC-P02-04 | No quota code or 409 change; non-active and retry/conflict/DB count cases added | `NOT RUN` |
| AC-P02-05 | Disposable test DB and verified temp-path cleanup in test file; build/typecheck ran | Build/typecheck PASS; HTTP `NOT RUN` |
| AC-P02-06 | No route, validator, model, schema, collection or contract edit; owner code diff limited to `course.service.ts` plus P02 test/artifacts | `git diff --check` exit 0; full runtime compatibility pending TEST |

## Commands and actual results

- `git ... worktree add -b ai/p02-tenant-r0 .worktrees/p02-tenant-r0 Linh`: PASS after Git metadata write was approved outside sandbox.
- `node --import tsx --test services/tenant-service/test/internal.integration.test.ts` before source fix: FAIL in sandbox at `uv_os_get_passwd` (`ENOMEM`) before tests executed. Same command outside sandbox reached `mongodb-memory-server`, found MongoDB 7.0.24 binary missing and began ~600 MB download. Download was stopped; tests were `NOT RUN`, not a demonstrated application failure.
- `npm run typecheck --workspace @saas/tenant-service`: PASS, exit 0, after changes.
- `npm run build --workspace @saas/tenant-service`: PASS, exit 0, after changes.
- `git diff --check`: PASS, exit 0 for tracked diff. Untracked test/artifacts are not included by Git's diff check.
- `npm run test:platform`: `NOT RUN`; it uses the same unavailable MongoDB memory-server binary. No real database was used.

## Remaining risk, P08 and rollback

- HTTP regressions and actual status/body/DB assertions still require a cached Mongo binary or a permitted test environment in the separate TEST stage. The in-process Auth stub checks router behavior after identity lookup; P08 should verify the real Auth handshake and cross-service credentials in its combined platform integration suite.
- Compatibility change approved: owner/admin upload/chat on draft/archived now denies access. Other action grants, routes, response shapes, quota 409 and collections stay as before. Student-list lookup adds one tenant-scoped membership read.
- Rollback: inspect P02 worktree diff, then reverse only the two P02 method changes in `course.service.ts` and remove only P02's new test file/artifacts if directed. Do not reset, clean or alter the original `Linh` checkout or any database.
