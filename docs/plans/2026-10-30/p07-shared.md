# Plan: P07 shared contract hardening R0

- Task ID: `2026-10-30-p07-shared`
- Status: `APPROVED (by user, 2026-10-30)`
- Inputs: `docs/reports/2026-10-30/2026-10-30-p07-shared-scout.md`, P07 prompt v1.0, `docs/architecture/document.pdf`, `AGENTS.md`, `docs/development/coding-conventions.md`
- Baseline: `Linh` at `63065d4` (checked again on 2026-10-30; no commits or diff in P07 code since SCOUT)

## 1. Objective and background

Harden the existing shared response and HTTP error behavior without changing public function signatures or adding product capabilities. The V4 document is a target, not evidence of a deployed API. Existing Auth/Tenant/Chat response differences are integration risks for their owners.

## 2. Scope and non-goals

Only `packages/common/**` and `packages/http/**` may change in COOK. `contracts/openapi/common.yaml` is in the P07 whitelist but remains unchanged in this plan because OpenAPI 3.0.3 null constraints and consumer impact require a separate contract decision. No service, web, root test/config, gateway, database, endpoint, or domain-model edits. No breaking response envelope, commit, push, or merge.

## 3. Current-state findings

- Verified: `failure()` checks truthiness but spreads arbitrary `fieldErrors` values (`packages/common/src/index.ts:35-44`).
- Verified: `parseInstant()` checks a regex and `Date`, which can normalize invalid calendar dates (`packages/common/src/index.ts:65-75`).
- Verified: `registerErrorHandler()` has branches for `HttpError` and unknown errors, but shared HTTP tests only exercise JSON and 404 (`packages/http/src/index.ts:65-85`, `packages/http/test/http.test.js`).
- Verified: `HttpError.status` is not validated; no service call site was found in SCOUT. Defer implementation pending a compatibility decision.
- Verified: `contracts/openapi/common.yaml` has `paths: {}`. Auth/Tenant legacy responses and Chat schemas differ from the common envelope; report to those owners, do not change here.

## 4. Proposed design

Preserve `success`, `failure`, `formatInstant`, `parseInstant`, `HttpError`, and HTTP helper signatures and successful outputs. Reject malformed error detail objects at the `failure()` boundary with the existing `TypeError`, including non-object `fieldErrors` and non-string field values. Reject impossible calendar timestamps with the existing `RangeError`, preserving valid offset timestamps and UTC formatting. Add direct HTTP regression coverage for current known and unknown error mapping; only change HTTP implementation if a test demonstrates a defect within this scope. Avoid a general schema refactor.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `packages/common/src/index.ts` | Narrow runtime validation for malformed errors and invalid calendar dates; retain exports/signatures/JSDoc | T1, T2 |
| `packages/common/test/contracts.test.js` | Focused regression tests | T1, T2 |
| `packages/http/test/http.test.js` | Cover structured and unexpected error branches | T3 |
| `packages/http/src/index.ts` | Only if T3 reveals a confirmed bug; document exact fix in handoff | T3 conditional |

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Add malformed error-detail tests, then validate `failure()` input shape while retaining response shape and TypeError | common source/test | `npm run build --workspace @saas/common`; `node --test packages/common/test/contracts.test.js` | Existing and new cases pass; valid envelope unchanged | None |
| T2 | Add invalid-calendar and valid-offset cases, then make `parseInstant()` reject invalid calendar values using RangeError | common source/test | Same common build/test | Bad date rejected; valid offset and fractional seconds accepted | T1 (same files) |
| T3 | Add HTTP tests for known `HttpError` and unknown exception, including no leaked message; correct implementation only if test proves bug | http test; source conditionally | `npm run build --workspace @saas/http`; `node --test packages/http/test/http.test.js` | Existing status/envelope retained; 500 generic | T1 (uses common build) |

Tasks are sequential because T1/T2 share files and T3 depends on common. One owner; no multi-agent coordination needed. No specialist skill beyond `$cook`, `$test`, `$review` is required; branch policy: preserve current worktree and use an isolated branch/worktree only if the current checkout gains conflicting P07 changes, without resetting user work.

## 7. Dependencies and prerequisites

COOK requires explicit approval of this plan (`Status: APPROVED`) and a clean P07 diff preflight. No API/DB dependency. Service response migration, `HttpError.status` semantics, and OpenAPI null schema are excluded pending decisions by contract/service owners.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 | `npm run build --workspace @saas/common`; `npm run build --workspace @saas/http`; `npm run typecheck --workspace @saas/common`; `npm run typecheck --workspace @saas/http` | build/typecheck |
| AC2 | `node --test packages/common/test/contracts.test.js packages/http/test/http.test.js` with malformed/valid examples and HTTP 4xx/500 checks | unit/integration |
| AC3 | Inspect `git diff` and exports; confirm response keys, signatures, and existing successful cases remain identical | manual/review |
| AC4 | Parse `contracts/openapi/common.yaml` and confirm `paths` remains `{}`; `git diff` confirms no contract edit | contract/manual |
| AC5 | `git diff --name-only` contains only P07-owned code/tests plus own workflow artifacts | scope/manual |

Root `npm test` includes platform integration requiring MongoDB/SMTP and is optional for this shared-only change; `$test` must report its actual result or `NOT RUN` with reason.

## 9. Risks and mitigations

- Stricter runtime validation rejects malformed inputs previously coerced; mitigate with tests for all valid shapes and a diff check of public types/signatures. This is a bug fix for invalid inputs, not a new envelope.
- Calendar parsing with offsets can produce a different UTC date; validate the source calendar fields before conversion, test positive/negative offsets and leap dates.
- Changing `HttpError.status` could alter internal callers; deferred. HTTP source changes require a failing regression.
- OpenAPI `nullable` is weaker than runtime; defer schema tightening to a separate compatibility decision. No new paths.
- No DB/security/observability/performance changes are in this task.

## 10. Acceptance criteria

- [ ] AC1: Shared packages build and typecheck.
- [ ] AC2: Regression tests cover malformed error details, invalid/valid timestamps, known/unknown HTTP errors and pass.
- [ ] AC3: Public signatures and valid response envelope remain unchanged.
- [ ] AC4: `common.yaml` remains pathless and unchanged.
- [ ] AC5: No changes outside P07 ownership and own workflow artifacts.

## 11. Rollback or recovery

Revert only the P07 source/test diff after preserving any concurrent edits. No schema or data migration exists. Rerun the shared build/typecheck/tests to restore the baseline. Do not reset the whole branch or other owners' work.

## 12. Completion checklist

- [ ] All approved tasks done or explicitly deferred
- [ ] `$test` records evidence for AC1–AC5
- [ ] `$review` records its decision
- [ ] No docs/config/migration update required beyond P07 handoff
- [ ] Handoff updated after each stage
