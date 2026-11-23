# P02-tenant — independent REVIEW (2026-10-31)

## Decision and provenance

**Decision: APPROVE.** No blocking security, correctness, compatibility or scope defect was found in the P02 diff against the approved AC-P02-01 through AC-P02-06 plan. This is approval for integration planning, not permission to commit or merge.

- Reviewed `.worktrees/p02-tenant-r0` on `ai/p02-tenant-r0`; HEAD and `merge-base Linh HEAD` both `066baea8592f6f45e538272b947a3a2473c77305`. `git diff 066baea...HEAD` is empty because P02 is uncommitted. The review therefore inspected the working-tree diff and every P02 untracked file.
- Tracked diff: `services/tenant-service/services/course.service.ts` only. Staged diff: empty. Untracked P02 files: `services/tenant-service/test/internal.integration.test.ts`, `docs/plans/2026-10-31/p02-tenant.md`, `docs/handoffs/2026-10-31-p02-tenant.md`, `docs/reports/2026-10-31/2026-10-31-p02-tenant-cook.md`, `docs/reports/2026-10-31/2026-10-31-p02-tenant-test.md`. This REVIEW adds only this report and a handoff entry.
- The `Linh` checkout still has its pre-existing tracked assignment edit and untracked user files. The P02 worktree appears there as `.worktrees/`; no original checkout source file was changed by P02. No Auth, Chat, Document, Gateway, contract, root manifest or P08 file changed in the P02 worktree.

## Acceptance criteria

| AC | Result | Direct evidence and limits |
| --- | --- | --- |
| AC-P02-01 — Course state | PASS | `course.service.ts:71-73` checks active status for only the `document:upload`/`chat:ask` set before the owner/admin branch; other action branches retain their prior order. `internal.integration.test.ts:210-219` asserts active grants, draft/archived 403 and unchanged quota count. No alternate Tenant upload/chat authorization path was found in the existing internal router/controller and quota service. |
| AC-P02-02 — Student list | PASS | `course.service.ts:342-353` calls `canAccessCourse(..., course:read)` then rechecks active membership in the same tenant and an owner/admin/lecturer role. Lecturer assignment and course status remain checked by `canAccessCourse`; student is excluded. HTTP test `:222-276` covers manager detail/list/edit/assign/enroll, student denial and lecturer active/draft behavior. Additional membership lookup is a small performance cost. |
| AC-P02-03 — Tenant isolation/credentials | PASS within P02 boundary | `canAccessCourse` queries tenant/member/course with matching IDs and active tenant/member; admin routes also use `resolveTenant`, writes use `withTenant`. HTTP tests `:278-353` show cross-tenant read 403, mutation 404 with course name unchanged, wrong assignment/enrollment 403, wrong service tokens 401, missing session 401 and forged actor header 403. The P02 suite stubs Auth's identity response, so real Auth handshake is for P08. |
| AC-P02-04 — Quota/idempotency | PASS | No quota source/model change. `quota.service.ts` checks course access before request lookup or usage increment; transaction and tenant/request unique index remain. HTTP tests `:210-219` assert non-active chat does not create extra rows/increment; `:356-370` assert retry `consumed:false`, conflict and limit 409, final 2 request rows and `chatCount=2`. Platform quota concurrency test passed in TEST. |
| AC-P02-05 — Test evidence | PASS | TEST report records focused 5/5, platform 11/11, tenant build/typecheck exit 0. Reviewer independently reran `$env:MONGOMS_RUNTIME_DOWNLOAD='false'; node --import tsx --test services/tenant-service/test/internal.integration.test.ts` outside sandbox: exit 0, 5 pass/0 fail/0 skip. Disposable Mongo test root had 0 entries after run. TEST-stage change to the test cleanup loop is within the plan's owned test file and preserves behavior. |
| AC-P02-06 — Compatibility/scope | PASS | No route, controller, validator, model, collection, index, migration, endpoint, request/response structure, billing policy or HTTP 409 change in the diff. `git diff --check` exit 0; all untracked files were listed and read. Rollback is limited to the two changed course methods and the P02 test/artifacts, without touching the original checkout or data. |

## Finding

### P02-R01 — LOW — Concern — nonblocking

- **Location:** `services/tenant-service/test/internal.integration.test.ts:278-353`, especially negative HTTP assertions near `:291`, `:320-350`.
- **Direct evidence:** The `request` helper parses response JSON, but most denial cases assert only `.status`; they do not assert `body.code` or `body.message`. Selected mutation/usage cases do check DB state (`:292`, `:316`, `:353`), and quota tests check DB counts (`:218-219`, `:366-370`).
- **Expected vs actual:** Expected regression evidence for negative response envelope as well as status. Actual tests prove the status and selected DB effects, while negative envelope shape is supported mainly by unchanged controller/error-handler code and the passing platform suite.
- **AC:** AC-P02-03, AC-P02-05, AC-P02-06.
- **Impact:** A future error-envelope regression could pass these focused tests if it preserves status. No present response regression or security bypass is demonstrated.
- **Minimal recommendation:** In a later P02/P08 test update, assert `body.code` for representative 401/403/404/409 cases and assert DB counts for each state-changing denial. No production change is indicated.
- **Blocks integration:** No. The relevant response construction was not modified, and current HTTP and platform tests pass.

## Test quality, security and remaining risk

- The test mounts the actual Tenant internal/admin routers, uses real Mongoose models and a disposable replica set, and stubs only `AuthClient.getIdentity`; it does not prove the real Auth cookie/JWT introspection. P08 must cover that boundary and the combined Document/Chat callers. The stub's acceptance of a test cookie is explicitly local to the suite, not a production change.
- Tests share seeded course fixtures and the management test mutates draft name/assignment/archived enrollment. Node's default top-level test execution ran them sequentially and quota tables are cleared in `beforeEach`; the current suite passes. Explicit per-test fixture reset would make future parallel execution safer, but there is no demonstrated failure under the declared command.
- The test uses test-only service credentials and a memory-server URI; no production secret/database is read. Teardown restores the Auth method/environment, closes server/Mongoose/MongoDB and verifies the unique temp path before removal. Reviewer rerun left zero P02 temp entries.
- The approved behavior change denies owner/admin upload/chat on draft/archived; read and management actions remain. No unapproved TO-BE feature, destructive data action or hardcoded production secret was found. The added membership query in `getCourseStudents` is tenant-scoped; no migration or cross-service database lookup is introduced.
- `git diff --check` does not inspect untracked files; they were inspected directly. No whitespace or out-of-scope artifact was found. The root checkout has other users' work and should not be used for P02 integration without a fresh diff.

## Controlled next step

Coordinator may plan an authorized commit of the P02-owned source/test/report artifacts on `ai/p02-tenant-r0`, then integrate into the chosen target only after a fresh scope diff and combined P08 test/review. Do not commit or merge the root checkout's unrelated untracked files. This REVIEW performed no commit, push, merge, rebase, PR or source/test edit.
