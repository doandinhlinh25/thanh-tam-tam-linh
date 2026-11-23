# Plan: P02 Tenant ACL and quota regression hardening

- Task ID: `2026-10-31-p02-tenant`
- Status: `APPROVED (by chủ dự án, 2026-10-31)`
- Inputs: `docs/reports/2026-10-31/2026-10-31-p02-tenant-scout.md`, `docs/handoffs/2026-10-31-p02-tenant.md`, P02 prompt v1.0, V4 reference sections 4, 8 and 13, user `PLAN REVISION v1.1` request, and user `P02-tenant — APPROVED → COOK` approval of AC-P02-01 through AC-P02-06.
- Baseline: branch `Linh` at `066baea8592f6f45e538272b947a3a2473c77305`; `git log 066baea..HEAD --oneline` and `git diff -- services/tenant-service` were empty at PLAN start.

## 1. Objective and background

Harden only the existing tenant/course authorization and quota path. Prove tenant separation, assignment/enrollment checks, separate Document/Chat credentials, Auth-derived actor identity and quota retry behavior with regression tests owned by P02. Correct the confirmed code path that authorizes owner/admin chat or upload on a non-active course while preserving their course management and student-list access. Preserve existing endpoint shape, response status including quota 409, and Mongo collections/indexes.

## 2. Scope and non-goals

- Scope: existing `services/tenant-service/**` code and tests. No new endpoint, collection, schema migration, entitlement policy, billing, reserve/commit quota or cross-service lookup.
- Excluded: `test/platform.integration.ts` (P08 owner), other services, root manifests/lockfile, contracts, gateway, production configuration, remote operations. Preserve all pre-existing tracked/untracked work.
- Defer SCOUT's role fall-through finding unless a test demonstrates a bypass with an allowed persisted role. The schema currently limits membership roles to owner, admin, lecturer and student (`models/tenant-membership.model.ts`). Defer broad JSDoc/constant refactor; document public methods added or changed here only.
- No quota 409→429 change. No new interpretation of request payload content for idempotency, because the existing endpoint accepts only tenantId, courseId and requestId (`validates/internal.validate.ts`).

## 3. Current-state findings

- **Verified:** `CourseService.canAccessCourse` checks active tenant, active membership and matching course, but owner/admin returns `true` before `course.status !== "active"` (`services/tenant-service/services/course.service.ts:31-48`). `authorizeUpload` and `checkAuthorization` use it; quota invokes it for `chat:ask` (`controllers/internal.controller.ts`, `services/quota.service.ts`). Runtime outcome has not yet been tested.
- **Verified:** Internal routes require Document or Chat service token plus Auth session introspection (`routes/internal.route.ts`, `middlewares/security.middleware.ts`, `middlewares/admin/auth.middleware.ts`). The current platform test covers some ACL and quota retry but not negative cross-credential calls or `/authorization/check` (`test/platform.integration.ts:588-760`).
- **Verified:** Quota uses a tenant-scoped unique request index and transaction (`services/quota.service.ts`, `models/quota-usage.model.ts`); current platform test checks concurrent limit and same-request retry. Tenant `typecheck` passed during SCOUT. No runtime test was run in SCOUT.
- **Verified dependency:** `CourseService.getCourseStudents` currently authorizes with `document:upload` (`services/tenant-service/services/course.service.ts:307-312`). Denying that action on non-active courses without adjusting this call would also deny owner/admin the existing student-list route. Switching to `course:read` alone would admit enrolled students, because `canAccessCourse` grants student reads; the student-list method must retain its existing owner/admin or assigned-lecturer role boundary.
- **Approved user policy:** Owner/admin may manage and read active/draft/archived courses; upload and chat require `active` for every role. The owner explicitly approved AC-P02-01 through AC-P02-06 for COOK on 2026-10-31.

## 4. Proposed design

1. Add an in-process HTTP integration suite under the Tenant owner path. Mount the existing internal and admin routers in an Express test app, use a disposable MongoDB replica set, seed tenant/membership/course/assignment/enrollment records, and stub only the Auth identity lookup to represent a verified session. Provide test-only cookie/CSRF context for admin routes and distinct Document/Chat credentials for internal routes. Restore the Auth method and process environment after the suite. No real credentials, network service, or persistent DB.
2. Add a narrowly scoped access guard in `CourseService.canAccessCourse`: for **only** `document:upload` and `chat:ask`, deny when the matching course is not `active`, including owner/admin. Keep existing behavior for `course:read`, `document:read`, `document:delete`, `feedback:write` and all other existing actions. Preserve lecturer/student assignment/enrollment checks and existing error mapping. Use named action/status constants for changed logic and JSDoc on changed public method, following user conventions. The method remains `Promise<boolean>`.
3. In `CourseService.getCourseStudents`, authorize through `course:read` so owner/admin retain student-list access on draft/archived. Add an explicit tenant-scoped active membership/role guard that preserves the existing student-list audience: owner/admin or assigned lecturer on an active course; enrolled students remain denied. Continue to rely on `canAccessCourse` for matching tenant/course and lecturer assignment. Keep the endpoint's response contract unchanged.
4. Verify transaction/idempotency with existing quota implementation; change quota code only if the new regression reproduces a defect within the existing contract. Any new bug requires a plan revision before COOK, not an ad hoc extension.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `services/tenant-service/test/internal.integration.test.ts` (new) | HTTP regression fixtures and cases for credential/session/ACL/quota paths; disposable Mongo DB | T1, T3 |
| `services/tenant-service/services/course.service.ts` | Narrow non-active course guard for upload/chat; change student-list authorization to `course:read` with existing audience preserved; JSDoc and named constants for touched logic | T2, T3 |
| `docs/handoffs/2026-10-31-p02-tenant.md` | COOK/TEST/REVIEW evidence in their separate stages | Later stages |
| `test/platform.integration.ts` | No change; send P08 test recommendations in handoff/report | Coordination only |

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T0 | Recheck branch, HEAD, status, owner files; create an isolated P02 branch/worktree for COOK without moving or overwriting current changes. Read this approved plan from original checkout. | No product files | `git status --short --branch`, `git diff -- services/tenant-service` in both checkouts | Existing user work preserved; clean P02 code base | Plan APPROVED |
| T1 | Add regression for current owner/admin upload/chat authorization on draft/archived, and baseline tests for detail, student list and management routes. Seed active tenant/member plus active/draft/archived courses, lecturer assignment and student enrollment. | Tenant test file | `node --import tsx --test services/tenant-service/test/internal.integration.test.ts` | Upload/chat assertions fail for expected 403 before fix; baseline management checks pass | T0 |
| T2 | Move active-course check ahead of owner/admin grant only for upload/chat, preserving other actions and boolean method contract. | `course.service.ts` | Focused test; `npm run typecheck --workspace @saas/tenant-service` | Non-active upload/chat denied; active behavior retained; typecheck passes | T1 |
| T3 | Reproduce the resulting student-list regression on draft/archived, then change `getCourseStudents` to `course:read` plus an active, tenant-scoped membership/role guard. Assert student denied, assigned lecturer behavior unchanged, owner/admin allowed, cross-tenant denied, response shape unchanged. | `course.service.ts`, Tenant test file | Focused test | Draft/archived owner/admin student list restored; no lecturer/student privilege expansion | T2 |
| T4 | Expand owner-path suite for tenant A/B, wrong lecturer assignment, wrong student enrollment, inactive tenant, service credential separation, missing/invalid Auth session, quota same-request retry, conflicting user/course, no quota consumption on non-active chat, and daily quota count. Keep fixtures deterministic and cleanup isolated. | Tenant test file | Focused test | Cases pass with actual HTTP status/body and DB usage assertions | T3 |
| T5 | Verify final owner diff and document P08 requests; no root test edits. | Handoff only | `git diff --check`, `git diff -- services/tenant-service`, focused test, workspace `build`/`typecheck`; `npm run test:platform` if environment permits | Scope-only diff; all runnable checks reported honestly | T4 |

Tasks are sequential because T1 establishes the failing case T2 fixes, T3 resolves its student-list dependency, and T4 shares the same test file. One P02 code owner; no coordination record or agent delegation needed.

## 7. Dependencies and prerequisites

- **Approved policy:** owner/admin may manage/read draft/archived course through existing routes, including student list and assignment/enrollment management. `document:upload` and `chat:ask` require course `active` for every role. V4 explicitly stops chat/upload for archived; user supplied the draft rule in PLAN REVISION v1.1 and approved the revised plan in `P02-tenant — APPROVED → COOK`.
- **Test setup and cleanup:** New suite lives at `services/tenant-service/test/internal.integration.test.ts`; start a disposable `MongoMemoryReplSet` with a unique test DB/path, seed only local fixtures, mount existing routers in a local Express app, and close server/Mongoose in teardown. Delete only the resolved temporary test directory after confirming it lies under the suite's own test root. No production URI or secret is read; the suite uses test-only environment values.
- Existing test dependencies `tsx`, `mongoose`, `mongodb-memory-server` are in root `package.json`; no dependency installation planned. Mongo memory binary may be unavailable in offline sandbox. If so, report test `NOT RUN` with cause; do not claim pass or use real DB.
- P08 owns `test/platform.integration.ts`; request P08 to add end-to-end negative cross-credential and `/authorization/check` scenarios to combined integration verification. P02 tests remain within its owner directory.
- If P02 test reveals a separate contract/security defect, stop and revise the plan. Any Auth, Chat, Document or shared contract change belongs to its owner.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC-P02-01 — Course status | Before/after HTTP regression for active/draft/archived: owner/admin and permitted lecturer/student keep active behavior; draft/archived upload/chat return 403, including owner/admin. Check only these two action guards changed. | Integration, P02 owner-path suite; diff review |
| AC-P02-02 — Management rights | For owner/admin on draft/archived, assert course detail and student list remain 200 with unchanged response keys; exercise existing edit and assignment/enrollment routes. Assert enrolled student still cannot list students; assigned lecturer retains active-course access only. | Integration, P02 owner-path suite |
| AC-P02-03 — Tenant isolation | Use tenant A/B sessions and course IDs; assert cross-tenant detail/list/mutation and mismatched assignment/enrollment deny without record change. Call internal routes with wrong Document/Chat token, missing/invalid Auth session, and forged actor inputs; assert 401/403 and no DB mutation. | Integration, P02 owner-path suite; P08 combined follow-up |
| AC-P02-04 — Quota and retry | On draft/archived, chat quota request returns 403 and creates neither quota request nor usage increment. On active, repeat/concurrently retry same requestId, assert `consumed:false` for retry, 409 for conflicting user/course, DB `chatCount` equals unique accepted requests. | Integration, P02 owner-path suite; existing `npm run test:platform` |
| AC-P02-05 — Verification | First run targeted test before fix and record expected failure; after fix run focused test, tenant build/typecheck and platform test when environment permits. Verify disposable DB path and teardown. Record command, count and PASS/FAIL/NOT RUN. | Red/green integration, build, typecheck, test stage |
| AC-P02-06 — Compatibility and scope | Compare route/validator/model diff; assert quota remains 409, response shapes and collections/indexes unchanged; `git diff --check` and owner-path diff. | Diff review, integration |

`$test` stage reruns checks independently and records exact command, count, PASS/FAIL/NOT RUN. Do not treat successful typecheck as runtime coverage.

## 9. Risks and mitigations

- **Compatibility/security:** Restricting owner/admin on draft/archived changes existing upload/chat authorization output. `getCourseStudents` currently depends on upload permission; T3 switches its check to course read with an explicit role guard, preserving owner/admin access without admitting students or unassigned lecturers. Do not alter HTTP error codes or response shapes.
- **Test realism:** Stubbing Auth lookup does not prove the real Auth handshake. P08 combined integration test must verify the end-to-end boundary. The P02 suite still exercises router token and session middleware with a controlled verified-identity result.
- **Environment:** Mongo memory server may require a cached binary/network. Mark checks NOT RUN if unavailable; use no real database. Avoid unsafe cleanup outside a verified disposable test directory.
- **Concurrent work:** Recheck files immediately before COOK; preserve user changes. Worktree from current HEAD may not contain untracked plan/report, so read artifacts from original checkout and keep artifact ownership explicit.
- **Performance:** Extra active-status guard uses the course already fetched in `canAccessCourse`, adding no query or collection.
- **Observability:** No production log or metric change; tests/report must not print secrets, cookies or JWTs.

## 10. Acceptance criteria

- [ ] AC-P02-01 — Course status: Active upload/chat follows current rights; draft/archived upload/chat denies every role, including owner/admin. Other actions retain current behavior.
- [ ] AC-P02-02 — Management rights: Owner/admin can read detail, list students, edit course and manage assignment/enrollment on draft/archived; student-list response is unchanged. Lecturer/student rights do not expand.
- [ ] AC-P02-03 — Tenant isolation: Tenant A/B cannot borrow identity, membership, assignment or enrollment to read/mutate the other's course. Wrong service credential and unverified session are rejected.
- [ ] AC-P02-04 — Quota and retry: Non-active chat denial does not consume quota. Same `(tenantId,requestId,userId,courseId)` retry does not count twice; conflicting actor/course is rejected without increment.
- [ ] AC-P02-05 — Verification: Record pre-fix failing regression, use a separate disposable HTTP integration test DB with safe teardown, run available build/typecheck/relevant tests and report exact results without invented PASS.
- [ ] AC-P02-06 — Compatibility and scope: Existing routes, response shapes, quota 409 behavior and Mongo collections/indexes remain compatible; owner diff stays in `services/tenant-service/**` plus P02 workflow artifacts.

## 11. Rollback or recovery

Before any rollback, inspect the isolated P02 diff and verify target paths. Revert only P02 changes in `course.service.ts` (both `canAccessCourse` and `getCourseStudents`) and remove only P02's new owner-path test file, leaving pre-existing user files and DB untouched. Test teardown closes local resources and deletes only its verified temporary path. No migration or deployment is planned. If the stage cannot complete, retain the worktree and handoff with the exact outstanding task; no reset/force push.

## 12. Completion checklist

- [x] Revised plan explicitly approved and marked `APPROVED (by chủ dự án, 2026-10-31)`.
- [ ] All tasks done or explicitly deferred with approval.
- [ ] Acceptance criteria verified by `$test` with command/count evidence.
- [ ] `$review` decision recorded.
- [ ] No docs/config/schema/contracts changed beyond P02 artifacts; migrations not applicable.
- [ ] Handoff updated; P08 integration recommendations recorded.
