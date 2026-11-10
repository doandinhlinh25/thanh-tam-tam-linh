# VT-003 coding-agent plan and review - 2026-11-10

## Prompt (AI GPT-6, planning BEFORE implementation)
"Inspect the real repository HEAD before code. For VT-003 add reviewer read + approve but forbid source edits; risk race condition, concurrency tests, 100 tasks p95<=3s; propose two options, assumptions, files, tests. Tests must RED before patch; keep tenant data ownership and avoid merging. Do not invent metrics."

## Evidence from actual base commit 8aaceec1
- services/tenant-service/models/tenant-membership.model.ts: TenantRole enum lacks reviewer.
- services/tenant-service/validates/admin/membership.validate.ts: Joi role validation lacks reviewer (including invitation).
- services/tenant-service/middlewares/admin/auth.middleware.ts: member course-list, admin-only management; not a reviewer approval permission.
- services/tenant-service/services/course.service.ts: course access checks admins/lecturer assignment/student enrollment, no reviewer.
- services/tenant-service/routes/admin/membership.route.ts: role management endpoints; no approval workflow.
- services/tenant-service/package.json: Express/Mongoose; no service-specific test command. Root integration requires Mongo replica set.

## Agent options
A: Full persistent production role/API + conditional MongoDB approval update + audit, real integration. REJECTED in this assignment slice: no existing approve domain API and no Mongo replica set available to establish empirical red-green; feasible future integration.
B: Independent executable Node HTTP contract harness with frozen source, separate approval metadata and in-process conditional version transition. SELECTED to produce reviewable test-first and honest constrained evidence.

## Two human corrections
1. Agent's initial assumption that reviewer can be enabled only in middleware is false: Mongoose role enum AND Joi/invitations exclude reviewer.
2. Approval must not mutate original document row or be owned by Auth; data ownership and real course ACL belong at existing service boundaries. Future storage must use persistent atomic CAS, not read-then-save.
3. 100 localhost successes/conflicts do not establish actual multi-instance race safety or production p95.

## Predicted scope before coding
Only services/tenant-service/tests/vt003/{reviewer-harness.cjs,reviewer.test.cjs,load-100.cjs,README.md,plan.md,evidence/*}. No pre-existing production source edited. Fake actor tokens are test inputs, NOT Auth validation.
