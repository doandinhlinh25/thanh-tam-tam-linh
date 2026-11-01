# P07-shared — REVIEW

- Task ID: `2026-10-30-p07-shared`
- Branch/base: `Linh` / `63065d4`; review of uncommitted P07 diff on 2026-10-30
- Decision: **APPROVE WITH CONDITIONS**

## Summary and scope

Reviewed the actual diff against `docs/plans/2026-10-30/p07-shared.md`: only `packages/common/src/index.ts`, `packages/common/test/contracts.test.js`, and `packages/http/test/http.test.js` changed in P07 code. Public function signatures and the successful/failed envelope keys remain intact. `contracts/openapi/common.yaml` is unchanged with `paths: {}`. No service, web, gateway, DB, migration, secret, or new endpoint changes. Other pre-existing user changes remain outside this review.

## Findings

### 1. Medium — Confirmed defect: malformed `fieldErrors` object passes validation

- **Location:** `packages/common/src/index.ts:40-44`.
- **Finding:** The new check rejects arrays and non-string values, but `Date` and `Map` have `typeof === "object"` and `Object.values(...)` is empty. Both pass and become `{}` after spread.
- **Impact:** The intended runtime shape check in T1 remains incomplete; a caller's malformed error details are silently discarded.
- **Evidence:** Read-only command against the built package: `failure({errorCode:'E',errorMessage:'m',fieldErrors:new Date()})` and the same with `new Map()` both returned `fieldErrors: {}`. The new regression covers string, array, null, and numeric value, but not non-record objects.
- **Recommendation:** Limit `fieldErrors` to a plain record (including an intentional null-prototype record if needed) before copying; add Date/Map regression cases. Preserve the public signature and existing `TypeError`.

### 2. Low — Concern: no independent TEST stage report

- **Location:** `docs/handoffs/2026-10-30-p07-shared.md` and plan AC1–AC5.
- **Finding:** COOK recorded shared build/typecheck and 5 passing tests, but the P07 TEST stage has not run and there is no acceptance report. Root `npm test` is explicitly optional in the plan and was not run.
- **Impact:** AC1–AC5 are not yet verified by the planned independent stage; production/platform integration is not established.
- **Evidence:** No P07 test report under `docs/reports/`; REVIEW reran only the focused tests (5/5 pass), parsed `common.yaml` (`paths {}`), and inspected diff/scope.
- **Recommendation:** After fixing finding 1, run `$test` against AC1–AC5, recording all commands and `NOT RUN` reasons where applicable.

## Acceptance criteria

| AC | Review status | Evidence |
| --- | --- | --- |
| AC1 | Partially verified | COOK recorded both builds/typechecks pass; REVIEW did not repeat them. |
| AC2 | Not fully met | Focused tests 5/5 pass, but Date/Map bypass the intended malformed-input rule. |
| AC3 | Verified for inspected diff | Exports, signatures and envelope keys unchanged; valid examples still pass. |
| AC4 | Verified | YAML parsed with `paths {}`; no contract diff. |
| AC5 | Verified for P07 code | `git diff --name-only 63065d4 -- packages/common packages/http contracts/openapi/common.yaml` lists only the three planned files; own plan/handoff/report artifacts are separate. |

## Remaining risks and decision

**APPROVE WITH CONDITIONS:** fix finding 1 and complete the P07 TEST stage before accepting the change. `HttpError.status`, OpenAPI nullable constraints and legacy Auth/Tenant/Chat envelope differences remain deferred by the approved plan and belong to separate owner/compatibility decisions. No source files were edited during REVIEW. No commit/push/merge performed.
