# R1 implementation plan
Status: implementation scope authorized by the user's repeated instruction on 2026-11-14 to implement M01–M04 and push a new branch. This does not authorize production migration, operational cutover, deletion, or release.
## 1. Goal
Implement only the existing upload persistence conversion and sandbox DB isolation described in M01–M03; audit M04 and push to feat/linh-r1-conversion-20261114. Never write remote Linh.
## 2. Baseline
27e11a8, fresh clone of Linh; scout report in docs/reports/2026-11-14. Actual Document uses JPA, not the earlier JDBC adapter.
## 3. Scope
M01 sandbox bootstrap, own-DB users and config tests. M02 services/document-service only. M03 named sandbox scripts/config/tests. M04 report only. One operator works serially so shared sandbox files never have concurrent owners.
## 4. Contracts
Keep public DTO/HTTP 202/401/403/409/503, UUIDs, UPLOADED/QUEUED, PDF object key and event v1. No worker/outbox/retrieval/READY/new endpoints.
## 5. Data
Keep auth_sandbox/tenant_sandbox; use document_sandbox consistently. Preserve historical SQL migration and postgres-data volume. No existing data migrated. New Document metadata/jobs get unique indexes equivalent to SQL.
## 6. Tasks
1 Baseline Node/Java. 2 Per-DB bootstrap + credentials helper within infrastructure/sandbox, invoked by existing wrapper (avoid editing sandbox-env outside whitelist). 3 Mongo adapter, entity, health/error mapping and tests. 4 Mongo assertions, valid PDF, real second tenant and six cross-DB denials. 5 Test/audit/reports; commit and push named branch.
## 7. Security
Root only bootstrap; each app readWrite its own DB and authSource. Existing mismatched users fail closed; no silent credential rotation. Fresh .env generation appends only missing app secrets, preserves old values.
## 8. Acceptance
Node build/typecheck/tests; Java baseline and revised tests; real isolated Mongo adapter and ACL tests; Compose validation; live Docker U1–U7 only if runtime available. Missing runtime is NOT RUN, never mock PASS.
## 9. Risks
Redis publish precedes Mongo markQueued; dedup makes retry safe but is not distributed atomicity. S3 cleanup can fail and leave an orphan; preserve error evidence. Existing SQL volume remains rollback evidence.
## 10. Commands
npm ci/build/typecheck/test; Maven test with JDK21; opt-in Mongo tests with a fresh loopback database; sandbox check/fixtures/upload-e2e when Docker is available.
## 11. Recovery
Revert feature commits and restore JDBC environment to the preserved SQL deployment. Stop new writes before any real cutover; reconcile IDs/checksums/document/job counts. No down -v, drop database, or automated production migration.
## 12. Approval/evidence
User explicitly repeated implementation/push after scout. Scope is restricted to the supplied package. Operational cutover and independently reviewed E2E remain gated. Implementation cannot be declared deployable when Docker E2E is NOT RUN.
