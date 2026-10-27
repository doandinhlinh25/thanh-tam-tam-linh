# Plan: unblock the sandbox and verify Document upload end to end

- Task ID: `2026-10-26-linh-upload-e2e`
- Status: `APPROVED (by user, 2026-10-27)`
- Inputs: `docs/prompts/ai01/linh/01-upload-e2e.md`, `docs/handoffs/2026-10-26-linh-upload-e2e.md`, `docs/reports/2026-10-26/2026-10-26-linh-upload-e2e-scout.md`, `docs/reports/2026-10-27/pr-6-review.md`
- Baseline: `Linh` at `d8f9270`, rebased onto `origin/main` at `828b302` (2026-10-27)

## 1. Objective and background

Make the isolated Auth/Tenant/Document sandbox start reliably, then prove the upload behavior required by Prompt 01 against running PostgreSQL, Redis, S3, Auth, Tenant, and Document. Report the result of each U1–U7 case with observable side effects.

## 2. Scope and non-goals

Scope: fix the MongoDB bootstrap blocker, prepare disposable sandbox configuration, verify fixtures, add or extend repeatable Document upload integration tests, run U1–U7, and report evidence. The sandbox is for local testing only. Worker ingestion, READY status, retrieval, Chat, UI, gateway routing, and production deployment are outside this plan. Do not put credentials or cookies in Git or reports.

## 3. Current-state findings

- Verified: `infrastructure/sandbox/compose.yaml:57` runs `mongosh --file` without `--nodb`; Auth and Tenant require `mongo-init` success at lines 138 and 159. This blocks first startup (PR #6 review).
- Verified: Docker Engine responds, but `docker compose ls` shows no sandbox stack; `infrastructure/sandbox/.env` does not exist (2026-10-27 inspection).
- Verified: `package.json` declares `yaml`, but current `node_modules` does not contain it; `node --test test/sandbox-config.test.js` fails with `MODULE_NOT_FOUND`. Local Node is 26.1.0; `npm run test:platform` currently fails before tests with `uv_os_get_passwd ... ENOMEM`.
- Verified: `npm run build`, `npm run typecheck`, and Document Maven tests pass after rebase; Maven reports 17 tests, zero failures. These checks do not prove upload with live dependencies.
- Verified: `scripts/sandbox-fixtures.mjs` creates course and lecturer/student sessions; `scripts/sandbox-smoke.mjs` checks a narrower upload flow. Prompt 01 requires U1–U7, including changed bytes, forged identity headers, and Tenant outage with side-effect checks.
- Unknown: whether the Compose images build and all sandbox services become healthy after the MongoDB correction. No live sandbox run has been completed.

## 4. Proposed design

Keep the existing isolated Compose topology and service credentials. Prevent `mongosh` from attempting a local connection before `mongo-init.js` runs, using `--nodb`; retain its explicit connection to `mongo:27017`. Use the existing fixture script as the source of real course IDs and sessions. Extend the test path only where the existing smoke script does not cover Prompt 01. Compare PostgreSQL rows, S3 objects, and Redis events before and after each case, scoped to a unique run ID. Keep direct Document calls distinct from public gateway tests.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- |
| `infrastructure/sandbox/compose.yaml` | Correct `mongo-init` invocation | T1 |
| `test/sandbox-config.test.js` | Add a regression assertion for MongoDB bootstrap invocation | T1 |
| `infrastructure/sandbox/README.md` | Clarify bootstrap/verification commands if behavior changes | T1–T2 |
| `scripts/sandbox-smoke.mjs` or a focused Document integration test under `services/document-service/src/test/` | Cover U1–U7 and before/after side effects using real dependencies | T3 |
| `docs/reports/YYYY-MM-DD/YYYY-MM-DD-linh-prompt-01.md` | Record per-case evidence and conclusion | T4 |
| `docs/handoffs/2026-10-26-linh-upload-e2e.md` | Record progress and result | T4 |

`infrastructure/sandbox/.env` and `.test-data/` are generated local inputs and must remain ignored. No API or database schema change is planned.

## 6. Ordered implementation tasks

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Duy Tâm: correct `mongo-init` and add a regression check | Compose, config test | `npm ci`; `node --test test/sandbox-config.test.js`; `npm run sandbox:check` after init | Config test passes; `mongo-init` can run its script | None |
| T2 | Duy Tâm: generate private config, start stack, verify readiness and course/session fixtures | Sandbox scripts and README only if a defect is found | `npm run sandbox:init`; `npm run sandbox:up`; `npm run sandbox:fixtures`; `npm run sandbox:smoke` | Auth, Tenant, Document ready; lecturer allow 200, student deny 403; smoke verifies upload storage/event | T1 |
| T3 | Linh: implement repeatable U1–U7 verification against the running stack | Smoke script or Document integration test and its fixture | Run the new test command with a unique run ID; inspect PostgreSQL/S3/Redis per case | Each U case has HTTP result and side-effect assertions; no mocks in tests called E2E | T2 |
| T4 | Linh: run full checks and publish evidence | Report, handoff | `npm run build`; `npm run typecheck`; `npm test`; `.\\mvnw.cmd test` from `services/document-service`; U1–U7 command | Command output and per-case PASS/FAIL/BLOCKED recorded without secrets | T3 |

T1 precedes T2; T3 requires real fixtures from T2. Documentation can be prepared independently, but all runtime evidence is sequential. One owner should edit shared sandbox scripts at a time. No multi-agent execution is requested.

## 7. Dependencies and prerequisites

Docker Engine and Compose v2 must be running. `npm ci` must restore lockfile dependencies before the Node test suite; use a supported Node runtime if the current Node 26 environment continues to fail before test execution. Sandbox ports must be free. T2 creates isolated volumes and ignored local secrets; never reuse or rotate an existing `.env` against persisted volumes without inspecting the state. Any new Auth/Tenant defect belongs to Duy Tâm; Linh should record it rather than changing another service to make an assertion pass.

## 8. Testing and verification strategy

| Acceptance criterion | Check | Level |
| --- | --- |
| AC1: sandbox bootstrap and readiness | Config regression test, `sandbox:check`, `sandbox:up`, health endpoints | Unit + integration |
| AC2: real course and allow/deny sessions | `sandbox:fixtures`, Auth profile and Tenant authorization responses | Integration |
| AC3: U1–U7 behavior and side effects | New run-ID-scoped test: HTTP plus PostgreSQL row, S3 object, Redis event deltas | E2E |
| AC4: existing behavior remains valid | `npm run build`, `npm run typecheck`, `npm test`, Document Maven test | Build + unit/integration |
| AC5: reproducible, private evidence | Fresh run following README; inspect report and Git diff for credentials | Manual review |

`npm test` includes Node workspaces and platform tests, not Java or the frontend. The current `yaml` and `tsx` failures are environment blockers to resolve before claiming a passing Node test suite. A passing smoke test alone does not fulfill all U1–U7 cases.

## 9. Risks and mitigations

- Building MinIO from source may be slow or fail because of external source availability; record the exact build failure, without silently substituting an image or changing scope.
- Existing sandbox volumes can retain old credentials or schema; inspect them before cleanup, and scope any reset to this Compose project. Do not delete volumes without explicit authorization.
- Concurrent service writes can make global row/event counts misleading; filter every assertion by run ID and verified tenant/course/user.
- The current branch has rewritten local history and uncommitted/untracked user files. Preserve them; no push, force push, merge, or cleanup is part of this plan.
- Prompt 01 only proves upload acceptance (`QUEUED`), not ingestion to `READY` or retrieval.

## 10. Acceptance criteria

- [x] AC1: Fresh sandbox startup completes MongoDB initialization and all three application readiness checks.
- [x] AC2: Fixtures provide a real course, an authorized lecturer session, and a valid student session denied for upload.
- [x] AC3: U1–U7 pass against real dependencies, including no unauthorized side effects and correct idempotency.
- [x] AC4: Relevant Node and Document checks pass; any unavailable check is reported accurately.
- [x] AC5: Report lists the command, run ID, status, metadata/object/event evidence, and limitations for every U case without exposing secrets.

## 11. Rollback or recovery

If the Compose fix fails, revert only the scoped sandbox/test changes and keep the diagnostic logs. Use `npm run sandbox:down` to stop the project while retaining volumes. Inspect local `.env`, project name, and volume names before any reset. The pre-rebase branch remains available at `backup/Linh-before-rebase-2026-10-27`; do not reset to it automatically.

## 12. Completion checklist

- [x] All tasks done or explicitly deferred with approval
- [x] Acceptance criteria verified by `$test` with evidence
- [ ] `$review` decision recorded
- [x] README and test command reflect the runnable environment
- [x] Handoff updated
