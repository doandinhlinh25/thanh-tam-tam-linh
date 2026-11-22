# R1 conversion — SCOUT — 2026-11-14

## 1. Request and scope

User request: tải nhánh Linh, sửa theo package R1-chuyen-doi-phan-da-lam, push bằng nhánh mới và không thay đổi Linh. Latest steering: kiểm tra lại package đã có chưa.

Task ID: 2026-11-14-linh-r1-conversion. Owner: Codex, SCOUT only.
Worktree: D:/SoftwareEngeering/linh-r1-work.
Branch: feat/linh-r1-conversion-20261114.
Base: 27e11a8 (origin/Linh, docs: add multi AI prompt package).
No implementation, data migration, credential changes, deployment or push performed in this stage.

## 2. Verified package and Git state

Package root: docs/prompts/ai01/linh/Thanh-Tam-Bo-Prompt-Nhieu-AI-R0-R1-v1.1/thanh-tam-bo-prompt-multi-ai-v1.1.

Verified in origin/Linh after fetch:
- R1-chuyen-doi-phan-da-lam/M01-mongodb-quyen-db-auth-tenant-prompt-v1.1.md
- R1-chuyen-doi-phan-da-lam/M02-document-upload-mongo-prompt-v1.1.md
- R1-chuyen-doi-phan-da-lam/M03-sandbox-mongodb-document-e2e-prompt-v1.1.md
- R1-chuyen-doi-phan-da-lam/M04-review-doc-architecture-status-prompt-v1.1.md

The feature branch fast-forwarded to the new source commit before this read-only stage. Local Linh ref was not changed; no remote branch was written. The supplied 6663a36 baseline is a design baseline, not the implementation HEAD.

## 3. AS-IS versus V4

| AS-IS, verified evidence | V4 target | Possible R1 changes | Frozen backlog |
| --- | --- | --- | --- |
| compose.yaml:142,164 connect Auth/Tenant to auth_sandbox/tenant_sandbox with the same MONGO_USERNAME/MONGO_PASSWORD used for bootstrap root at line 27 | Logical database and least-privilege credential per service; V4 lines 19–25,187 | M01 provisioning of per-service readWrite users, correct authSource, deny cross-DB reads; keep DB names/data and replica set | No new business collections or auth features |
| Document pom.xml uses JPA/PostgreSQL; application.properties uses spring.datasource.*; database/migrations/001_document_upload.sql defines documents and ingestion_jobs | Document metadata and jobs in owned MongoDB database | M02 replace persistence only, preserve IDs/DTO/constraints and compensation, document migration and rollback | No worker, chunks, vector search, retrieval, READY or new public APIs |
| sandbox compose includes PostgreSQL; sandbox-smoke.mjs and sandbox-upload-e2e.mjs query psql | Sandbox upload backed by Document-owned MongoDB credential | M03 integrate only after M01/M02 reviewed; preserve historical volumes, verify metadata/jobs/checksum/events | No production cutover or volume deletion |
| upload-e2e.mjs:35 and smoke.mjs:52 use minimal PDF magic fixture; upload-e2e.mjs:198 uses all-zero forged tenant ID | Parseable PDF and two real tenants in M03 acceptance | Valid PDF fixture and real second tenant while retaining existing negative checks | No extraction implementation |
| Report 2026-11-02-p03-document-remediation-r1-review.md records earlier 34-test evidence and explicit E2E_NOT_RUN | Current evidence, not inherited claims | Re-establish baseline and separate unit/component/integration evidence | Do not declare full V4 complete |

## 4. File boundaries and proposed verification

| File / scope | Reason for later change | Behavior/API to preserve | Required verification | Rollback |
| --- | --- | --- | --- | --- |
| M01: infrastructure/sandbox/**, scripts/sandbox.mjs, test/sandbox-config.test.js | Provision app-scoped Auth/Tenant users | Auth login, Tenant transactions, existing data | Each user reads own DB and receives Unauthorized on the other DB; runtime does not use root | Restore configuration at 27e11a8 without deleting volume or recreating secret |
| M02: services/document-service/** | Replace JPA adapter with MongoDB storage | 202/QUEUED, 401/403 before file handling, same-key/hash replay, changed hash 409, one document/job/event, same S3 key and event v1 | Java baseline, Mongo component tests, race and dependency-error tests; M03 supplies live integration | Preserve SQL migration/history and plan a separately approved data cutover/rollback |
| M03: infrastructure/sandbox/**, named sandbox scripts and sandbox-config test | Configure third DB/user and update checks | Existing HTTP/S3/Redis/negative-path assertions | 202/401/403/409/503, idempotency, private object bytes, Mongo metadata/jobs, Redis dedup; six forbidden cross-DB pairs | Restore old isolated configuration; keep PostgreSQL volume/data |
| M04: read-only review | Audit combined diffs and evidence | Service boundaries and fail-closed behavior | APPROVE / REQUEST CHANGES / NOT EVALUATED by evidence; verify whitelist | No code mutations in review |

## 5. Concrete unknowns and blockers

- M01 mentions env generation in scripts/sandbox.mjs, but actual generation and validation live in scripts/sandbox-env.mjs (imported at sandbox.mjs:5 and called at line 39). That file is outside M01/M03's listed ownership. PLAN must either keep the change within the wrapper or obtain an explicit whitelist extension; do not silently edit it.
- No baseline suite has been rerun in this fresh checkout. The historical P03 review is evidence read, not evidence reexecuted. Whole R0 readiness is not established.
- Docker command not found in PATH during this stage. No local sandbox was assumed ready; no existing volumes or secrets were inspected or changed. Container E2E currently NOT RUN.
- node_modules and services/document-service/target are absent in the fresh worktree. Java/Node runtime tests are NOT RUN here; do not claim previous worktree results apply.
- App user provisioning for an existing volume needs an idempotent create/update strategy and an explicit credential rotation policy without root in app containers.
- No production data migration or operational cutover is authorized by this report.
- M03 depends on reviewed M01 and M02; M04 cannot approve implementations which do not exist.

## 6. Commands and observed results

- git ls-remote --heads ... refs/heads/Linh: remote moved from 3d9ace6 to 27e11a8; fetch succeeded.
- git ls-tree -r --name-only origin/Linh: all four exact R1 prompt paths verified.
- git status --short --branch before report: clean feature branch at 27e11a8.
- git branch -vv and git worktree list: independent checkout and feature branch; local Linh remains unchanged.
- node --check scripts/sandbox-upload-e2e.mjs: PASS (syntax only).
- node --check scripts/sandbox-smoke.mjs: PASS (syntax only).
- node --check infrastructure/sandbox/mongo-init.js: PASS (syntax only).
- npm build/typecheck/test, Maven, Mongo role checks, Docker/E2E: NOT RUN in this stage.
- Source/config diff: none; only this report and its handoff are written.

## 7. Recommended next step

PLAN for M01/M02 and the subsequent M03/M04 integration, including baseline gates, whitelist resolution and explicit data rollback. No approved implementation plan exists. The package defaults to SCOUT and requires a user-selected next stage and approved plan before COOK. User authorization to push to a new branch is already recorded; no additional push permission is inferred as missing. Do not push a scout-only branch as if the requested conversion were implemented.
