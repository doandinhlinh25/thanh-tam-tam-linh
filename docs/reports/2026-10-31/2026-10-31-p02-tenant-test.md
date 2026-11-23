# P02-tenant — TEST (2026-10-31)

## Scope and environment

- Tested worktree: `.worktrees/p02-tenant-r0`, branch `ai/p02-tenant-r0`, HEAD `066baea8592f6f45e538272b947a3a2473c77305`, directly based on `Linh`. PLAN status is `APPROVED (by chủ dự án, 2026-10-31)`.
- Actual implementation diff: modified `services/tenant-service/services/course.service.ts`; untracked `services/tenant-service/test/internal.integration.test.ts`, P02 PLAN, handoff and COOK report. No staged files. This TEST stage changes only the approved P02 test file's environment-cleanup loop, this report and the P02 handoff. No production code, other service, contract, root manifest or `test/platform.integration.ts` was changed.
- Node `v26.1.0`, npm `11.13.0`; MongoDB memory-server 7.0.24 binary was found in the user cache (`mongod-x64-win32-7.0.24.exe`, 64,707,584 bytes). Tests used a disposable `MongoMemoryReplSet`, with `MONGOMS_RUNTIME_DOWNLOAD=false`; no runtime/production database or secret was used.
- First sandbox test attempt stopped before assertions with Node `uv_os_get_passwd ENOMEM` (exit 1). Running the same test outside sandbox against the cached binary succeeded. This is an environment failure, not an application test failure.

## Commands and results

| Command | Exit | Tests | Result |
| --- | ---: | --- | --- |
| `$env:MONGOMS_RUNTIME_DOWNLOAD='false'; node --import tsx --test services/tenant-service/test/internal.integration.test.ts` in sandbox | 1 | 0 assertions executed; Node wrapper reported 1 file failure | Environment failure: `uv_os_get_passwd ENOMEM` before test setup |
| Same focused command outside sandbox, final run after test cleanup adjustment | 0 | 5 pass, 0 fail, 0 skipped | PASS |
| `npm run typecheck --workspace @saas/tenant-service` | 0 | n/a | PASS |
| `npm run build --workspace @saas/tenant-service` | 0 | n/a | PASS |
| `$env:MONGOMS_RUNTIME_DOWNLOAD='false'; npm run test:platform` outside sandbox | 0 | 11 pass, 0 fail, 0 skipped | PASS |
| `git diff --check` | 0 | n/a | PASS for tracked diff; untracked P02 files were inspected separately |

Total successful test assertions reported by the runners: 16 tests pass, 0 application failures, 0 skipped. The earlier sandbox wrapper failure is not counted as an application test. No required test remains `NOT RUN`.

## Acceptance criteria

| AC | Result | Evidence |
| --- | --- | --- |
| AC-P02-01 — Course state | PASS | Focused test `owner and admin cannot upload or consume Chat quota on draft or archived courses`: active owner/lecturer upload and admin chat 200; draft/archived owner/admin upload/chat 403. Existing `document:read`, `document:delete`, `feedback:write` manager grants asserted in second test. |
| AC-P02-02 — Student list | PASS | Focused management test: draft/archived owner/admin detail and student list 200, student list 403 for student, assigned lecturer active list 200 and draft list 403; edit, assignment and enrollment endpoints 200. `getCourseStudents` uses `course:read` plus active tenant-scoped membership role check in source diff. |
| AC-P02-03 — Tenant isolation/credentials | PASS within P02 test boundary | Third/fourth focused tests: cross-tenant detail/list 403, cross-tenant edit 404 with course name unchanged, unassigned lecturer and unenrolled student 403, suspended tenant upload 403 and quota 404, wrong service tokens 401, missing session 401, forged actor header 403, valid Chat authorization 200; quota-request count remains 0. Real Auth handshake remains P08's combined-coverage responsibility. |
| AC-P02-04 — Quota/idempotency | PASS | First test asserts only 1 quota-request and `chatCount=1` after one active chat plus four non-active denials. Fifth test asserts first request `consumed:true`, retry `consumed:false`, conflicting user/course 409, daily limit 409, final `chatCount=2` and 2 request rows. Existing platform quota concurrency test also passed. |
| AC-P02-05 — Test evidence/isolation | PASS | Focused 5/5, platform 11/11, build/typecheck exit 0. P02 test creates a unique temp DB path, closes HTTP server/Mongoose/MongoDB and verifies the path before deletion. An empty `run-47U9Cs` directory left by the interrupted COOK download was verified inside the P02 test root and removed without recursion; current focused runs cleaned their own paths. |
| AC-P02-06 — Compatibility/scope | PASS for checked scope | Tracked diff changes only `course.service.ts`; untracked files are only P02 test and workflow artifacts. No route, controller, validator, model, collection/index, schema, migration, contract or other service changed. Quota code and 409 behavior remain; platform integration 11/11 passed. |

## Diff, regression and limitations

- `git status --short` and `git ls-files --others --exclude-standard` show exactly one modified product file and P02-only untracked files. `git diff --cached --name-only` is empty. `git diff --check` returned 0; untracked test/artifact files were read and checked for trailing whitespace separately.
- The approved behavior change is owner/admin upload/chat denial for draft/archived. Existing course management/read behavior remains. The new student-list path performs an additional tenant-scoped membership read; no data migration or response shape change.
- No application bug was found in this TEST run. The sandbox `ENOMEM` remains an environment limitation; outside-sandbox execution with the cached binary provides the runtime evidence. P08 should still verify the real Auth introspection boundary and cross-service credentials in its combined suite; P02's in-process test stubs the Auth identity response.
- Rollback scope remains the P02 changes in `course.service.ts` and P02 test/artifacts only. No Git history or production data was touched.

## Conclusion

Overall TEST status: **PASS**. The implementation is ready for a separate REVIEW request; this stage did not perform review or integration.
