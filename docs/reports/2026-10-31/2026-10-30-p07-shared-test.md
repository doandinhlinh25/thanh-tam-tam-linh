# P07-shared — TEST (2026-10-31)

- Task ID: `2026-10-30-p07-shared`
- Status: **FAIL**
- Scope: approved P07 plan `docs/plans/2026-10-30/p07-shared.md`; uncommitted diff on branch `Linh`, HEAD `63065d4`.
- Environment: Windows / PowerShell / Node workspaces. Other pre-existing user changes remain untouched.

## Commands and results

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run build --workspace @saas/common` | PASS, exit 0 | TypeScript build completed. |
| `npm run build --workspace @saas/http` | PASS, exit 0 | TypeScript build completed. |
| `npm run typecheck --workspace @saas/common` | PASS, exit 0 | No diagnostics. |
| `npm run typecheck --workspace @saas/http` | PASS, exit 0 | No diagnostics. |
| `node --test packages/common/test/contracts.test.js packages/http/test/http.test.js` | PASS, exit 0 | 5 tests passed, 0 failed. |
| Direct Node reproduction against `packages/common/dist/index.js` | FAIL behavior, command exit 0 | `fieldErrors: new Date(...)` and `fieldErrors: new Map([['email','Required']])` both returned `{}` rather than throwing `TypeError`. |
| Parse `contracts/openapi/common.yaml` with `yaml` | PASS, exit 0 | `paths {}`. |
| `git diff --name-only 63065d4 -- packages/common packages/http contracts/openapi/common.yaml`; `git diff --cached --name-only`; `git diff --check` | PASS, exit 0 | Only three approved P07 code/test paths changed, no staged paths, no whitespace errors. |
| Root `npm test` | NOT RUN | Includes platform integration requiring a MongoDB replica set and SMTP; optional for this shared-only plan. |

## Acceptance criteria

| Criterion | Status | Reason |
| --- | --- | --- |
| AC1: shared build and typecheck | PASS | All four commands above succeeded. |
| AC2: regression coverage and behavior | **FAIL** | Existing focused tests pass, but malformed `Date`/`Map` `fieldErrors` pass validation and are silently coerced. |
| AC3: public signatures and valid envelope unchanged | PASS | Diff inspection: exports/signatures and `successful/data/error` keys unchanged; existing valid-case tests pass. |
| AC4: `common.yaml` pathless/unchanged | PASS | YAML parse shows `paths {}`; no contract diff. |
| AC5: scope | PASS | Diff lists only `packages/common/src/index.ts`, `packages/common/test/contracts.test.js`, `packages/http/test/http.test.js` plus own workflow artifacts. |

## Failure reproduction and cause

Run after the common build:

```powershell
node -e "const {failure}=require('./packages/common/dist/index.js'); for (const [name,value] of [['Date',new Date('2026-01-01')],['Map',new Map([['email','Required']])]]) { try { console.log(name,JSON.stringify(failure({errorCode:'E',errorMessage:'m',fieldErrors:value}).error.fieldErrors)); } catch(error) { console.log(name,error.name); } }"
```

Observed: `Date {}` and `Map {}`. The new guard uses `typeof === 'object'`, rejects arrays, then checks `Object.values(...).every(...)`. Empty enumerable value lists satisfy `every`, so non-record objects pass and object spread drops their content. This is a gap introduced by the P07 hardening attempt, not a new behavior in the pre-existing unguarded shared function; the earlier function also accepted and coerced these inputs. The approved T1 objective remains incomplete.

## Coverage and limits

Focused tests cover null/string/array/numeric `fieldErrors`, invalid calendar date, valid offsets, 404, known `HttpError`, and unexpected 500. They omit non-record objects and some timestamp edge cases. No service integration or production behavior is claimed. No test or product file was changed during TEST.

## Next action

Return to P07 COOK to restrict `fieldErrors` to a plain record and add Date/Map regression cases, then rerun TEST. Do not commit, push, or merge while AC2 fails.
