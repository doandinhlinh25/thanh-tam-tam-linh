# R1 implementation record — 2026-11-14
Base: 27e11a8; branch: feat/linh-r1-conversion-20261114. Source scope authorized by the repeated user request to implement the provided R1 package and push a separate branch. No production cutover is included.

| Task | Changes | Behavior preserved | Tests | Rollback |
| --- | --- | --- | --- | --- |
| M01 | sandbox bootstrap/runtime credential helper/Compose/config tests and wrapper | Existing DB names, data and transaction-capable replica set; app users readWrite own DB only | Real Mongo ACLs; actual scoped Auth/Tenant; VM bootstrap idempotency/rejection | Revert branch config without deleting volume; do not silently rotate users |
| M02 | Document Mongo entity/repository/transaction config/health/error handler, POM and tests | HTTP/public DTO, idempotency/hash conflict, S3 keys, event v1, UPLOADED/QUEUED | 7 real Mongo cases, existing HTTP/business tests, PDF parser | Preserved SQL migration and documented mapping/cutover/rollback |
| M03 | Mongo snapshot inspector, permissions command, full PDF helper, second-tenant fixture and E2E assertions | Original side-effect/error checks; full metadata snapshots; private S3 and Redis checks | Config/Compose PASS; full Docker E2E NOT RUN | Retain postgres-data and old branch; no destructive commands |
| M04 | Read-only source review/report | No business source changes during review | Evidence assessed explicitly by type | Independent review and live QA required |

New environment secret generation is delegated to a helper inside infrastructure/sandbox, keeping scripts/sandbox-env.mjs outside the diff as required by the whitelist. Helpers and verification tools remain in allowed sandbox scope. No other service code, root manifests, contracts, gateway, frontend or backlog functionality is changed.

One owner worked serially; no concurrent ownership or external messages were used. Reports distinguish unit, real component/API and unexecuted Docker E2E checks. No real database migration, SQL deletion, down -v, deployment, credential rotation or paid dependency operation was performed.
