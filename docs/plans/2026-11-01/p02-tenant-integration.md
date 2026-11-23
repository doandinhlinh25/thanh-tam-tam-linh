# P02-tenant — Integration plan

Status: APPROVED (by chủ dự án, 2026-11-01)
Date: 2026-11-01
Stage: INTEGRATION_PLAN
Owner: P02-tenant
Approval: project owner authorized the eight-file P02 commit and local P07-based integration execution on 2026-11-01; merge into `Linh`/`main` and push remain unapproved.

## 1. Objective and approved basis

Package the reviewed P02 implementation into one auditable commit, then integrate that commit after P07 on a separate branch. This document is a plan only. The approved P02 implementation plan remains `docs/plans/2026-10-31/p02-tenant.md`; its AC-P02-01 through AC-P02-06 and REVIEW decision `APPROVE` define the scope. The integration branch has not been created or tested.

## 2. Scope and boundaries

The proposed commit contains only the eight P02 files in section 5. Integration will not silently include P01, P03, P04 or unrelated work from `Linh`. No endpoint, shared contract, database schema, other service, gateway, root package file, or `test/platform.integration.ts` change is proposed. Do not alter the original `Linh` checkout, its tracked or untracked user work, or `main`. The owner separately authorized the exact P02 staging, source commit and local P07-based cherry-pick on 2026-11-01; merge, rebase and push remain outside that authorization.

## 3. Verified repository state at planning time

| Ref/worktree | Verified state |
|---|---|
| P02 source | `.worktrees/p02-tenant-r0`, `ai/p02-tenant-r0`, HEAD `066baea8592f6f45e538272b947a3a2473c77305`; merge-base with local `Linh` is the same commit. No staged files before this plan. |
| Local `Linh` | HEAD `066baea8592f6f45e538272b947a3a2473c77305`; checkout has pre-existing tracked and untracked user changes. Preserve it. |
| `origin/Linh` | `63065d4339a1941f39519eb668239b95dd2ec2b6` at remote verification; local `Linh` has an additional commit. |
| `origin/main` | `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b` at remote verification. P07 has not been integrated there. |
| P07 | `integrate/p07-shared-20261031` at `53b84c91300f773ff0e0db35feb7e645e6e91aae`; its separate worktree was clean and remote ref matched at verification. This commit is a child of `6663a36`. |

`Linh` and P07 diverge in history: `git rev-list --left-right --count Linh...integrate/p07-shared-20261031` returned `8 1`, with merge-base `6663a36`. Their trees were identical at planning time (`git diff --name-status Linh integrate/p07-shared-20261031` returned no paths). This is a current observation, not a promise that either ref will remain fixed. P02's tracked diff changes only `services/tenant-service/services/course.service.ts` (57 additions, 14 deletions); `git diff --check` passed. The P02 test and six pre-existing workflow artifacts were untracked; all were inspected for this plan. The new plan becomes a seventh untracked artifact. No staged file was present.

## 4. Integration branch decision

After approval and a fresh ref check, create a **new isolated branch**, proposed name `integrate/p07-p02-tenant-20261101`, from the verified P07 commit `53b84c9` (or its then-approved successor). Cherry-pick only the newly created P02 commit onto it. This preserves the P07 worktree and avoids bringing the eight other commits in `Linh` history through a branch merge. Do not integrate P02 directly into `origin/main` or the dirty `Linh` checkout. If P07's tree, target ref, or remote history changes, compare again and pause for a revised integration decision if the change materially affects scope or conflict risk.

## 5. Exact proposed P02 commit contents

| Path | Purpose/state before this plan |
|---|---|
| `services/tenant-service/services/course.service.ts` | Tracked P02 behavior change: active-only upload/chat and student-list authorization. |
| `services/tenant-service/test/internal.integration.test.ts` | Untracked P02 HTTP regression suite. |
| `docs/plans/2026-10-31/p02-tenant.md` | Untracked, approved implementation plan. |
| `docs/handoffs/2026-10-31-p02-tenant.md` | Untracked P02 stage handoff; append this integration-plan stage. |
| `docs/reports/2026-10-31/2026-10-31-p02-tenant-cook.md` | Untracked COOK evidence. |
| `docs/reports/2026-10-31/2026-10-31-p02-tenant-test.md` | Untracked TEST evidence. |
| `docs/reports/2026-10-31/2026-10-31-p02-tenant-review.md` | Untracked REVIEW decision and P02-R01. |
| `docs/plans/2026-11-01/p02-tenant-integration.md` | This P02-only integration plan, untracked until a later authorized commit. |

Proposed commit message: `fix(tenant): enforce active course access and preserve student list permissions`

The first seven paths match the proposed P02 implementation package; this eighth path is the plan artifact required by the current request. Do not stage the root checkout's files or any other P02/P07 artifact by directory wildcard.

## 6. Ordered execution after approval

1. Record approval in this plan and recheck P02 source branch, HEAD, merge-base, full tracked/untracked/staged status, P07 ref/worktree, `Linh`, and remote `main`/P07. Resolve any new drift before proceeding.
2. Stage the eight exact paths in section 5 using explicit path arguments. Check `git diff --cached --name-status`, `git diff --cached --check`, and the staged content. Abort the planned commit if any path or content is outside P02. Verify no untracked P02 file was omitted.
3. Commit on `ai/p02-tenant-r0` only after separately authorized execution. Confirm its parent is `066baea`, its file list is exactly section 5, and the source worktree status is understood. Do not push automatically.
4. Create a separate clean worktree/branch from the then-approved P07 integration ref. Confirm the branch starts at P07, then cherry-pick only the P02 commit. Review conflicts path by path; do not discard user work or continue an ambiguous cherry-pick automatically.
5. Compare the combined branch to the P07 parent (`git diff --name-status` and content review). Confirm that only P02 paths were added and that P07 behavior remains present. Run the matrix in section 8 and document actual outputs.
6. Obtain combined integration review before any further promotion. Moving the combined branch into `Linh` or `main`, publishing it, or opening a PR requires a separate decision.

## 7. Ancestry, dependency and conflict checks

At planning time, P02 has no tracked path overlap with P07's changed shared packages, tests and reports; local `Linh` and P07 have identical trees despite divergent commit histories. Recheck this after approval, including untracked P02 artifacts against target paths. Compare `git merge-base`, `git rev-list --left-right --count`, and target/source tree diff before cherry-pick. Inspect shared contracts and workspace dependency graph because P07 affects shared packages consumed by Tenant Service. If target already includes any P02 file or an equivalent behavior change, stop and choose a nonduplicating integration method. Do not incorporate P01/P03/P04 automatically.

## 8. Post-integration test matrix

| Check on proposed combined branch | Expected evidence | Planning-time status |
|---|---|---|
| Tenant typecheck: `npm run typecheck --workspace @saas/tenant-service` | Exit 0, no type errors against P07 packages. | P02 source PASS; combined NOT RUN. |
| Tenant build: `npm run build --workspace @saas/tenant-service` | Exit 0. | P02 source PASS; combined NOT RUN. |
| P02 HTTP integration: `node --import tsx --test services/tenant-service/test/internal.integration.test.ts` | 5 tests pass; active/draft/archived authorization, tenant isolation, quota/idempotency. Use isolated temporary test DB and cached Mongo binary with runtime download disabled. | P02 source 5/5 PASS; combined NOT RUN. |
| Platform integration: `npm run test:platform` | Existing 11 tests pass; verify no shared-package/contract regression. | P02 source 11/11 PASS; combined NOT RUN. |
| Contract/dependency and Git scope review | Compare combined branch with P07 parent; inspect Tenant imports, contracts and dependency versions; no unapproved path or API/schema change. | Path comparison only at planning time; combined NOT RUN. |
| Security and state checks | Review HTTP negative responses and DB before/after assertions for cross-tenant access, inactive-course quota, retry `requestId`, and HTTP 409. Record any fixture limits. | P02 reports reviewed; combined NOT RUN. |

If cached MongoDB 7.0.24 or a permitted isolated test environment is unavailable, report `NOT RUN` and do not claim integrated test PASS. Do not download a large binary or use production DB/secrets merely to complete this matrix. Re-run broader checks only for a concrete conflict or required gate.

## 9. Risks and follow-up ownership

- **P02-R01 (LOW):** Some negative HTTP tests assert status without `body.code`. Track as a regression coverage gap for a later authorized P02 or P08 test update; it is not a confirmed product defect and does not expand this integration commit.
- **P08:** P02 HTTP tests use an Auth stub. Real Auth introspection, trusted session propagation and cross-service credential boundaries require P08's combined integration checks. P02's 5/5 and platform 11/11 results do not close that dependency.
- **History drift:** Local `Linh` and P07 contain equivalent trees with different ancestry, and remote refs may advance. Fresh ancestry/tree checks are mandatory before creating an integration branch.
- **Environment:** Node sandbox previously failed with `uv_os_get_passwd ENOMEM`; outside-sandbox tests passed using a cached MongoDB binary. Keep future test environment isolated and record where each command runs.

## 10. Integration acceptance criteria

- Approval is explicit and this plan is marked APPROVED before execution.
- The source commit contains exactly the eight P02 paths in section 5, with no pre-existing user or parallel-task changes.
- The new combined branch starts from the verified P07 integration commit and contains only that base plus the P02 commit; `Linh` and `main` are unchanged.
- All required combined checks in section 8 have recorded command, exit code and real PASS/FAIL/NOT RUN results; no baseline result is reused as combined evidence.
- Any conflict, scope drift, or P08 dependency is documented before requesting downstream promotion.

## 11. Rollback plan

Before promotion, abandon the isolated combined branch after preserving its inspection evidence, or revert only the P02 commit on that branch with explicit authorization. If a P02 commit has been promoted later, propose `git revert <P02-commit>` on the affected integration branch and rerun the matrix; do not rewrite shared history. Keep P07's commit intact. Do not use `git reset --hard` on the user's checkout, `git clean`, force push, database reset/volume deletion, or production secrets. Review the actual branch state before any rollback command.

## 12. Completion checklist for this planning stage

- [x] Read AGENTS/workflow and P02 PLAN, handoff, COOK, TEST and REVIEW evidence.
- [x] Verify source/P07/Linh/main refs, P02 tracked/untracked/staged status and current ancestry.
- [x] Specify exact commit package, integration target, test matrix, P02-R01/P08 follow-up and rollback.
- [x] Project owner approves this plan on 2026-11-01.
- [ ] Authorized execution stages, combined checks and integration review occur later.

Planning stage stops here. No commit or integration has been performed.
