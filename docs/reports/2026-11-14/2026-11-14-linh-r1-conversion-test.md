# R1 test evidence — 2026-11-14

Branch: feat/linh-r1-conversion-20261114; base 27e11a8. Tested working diff: M01 + M02 + M03. Overall: PARTIAL (not a deployment approval).

## Commands actually executed

| Command / environment | Result | Evidence and limits |
| --- | --- | --- |
| npm ci, fresh worktree | PASS | 211 packages; no repository dependency upgrades |
| JDK21 Maven baseline before conversion | PASS with skip | 34 tests, 0 failures/errors, 1 Redis live test skipped |
| npm test | PASS | Build + 27 tests: root 11, common 4, HTTP 1, platform 11; not frontend tests |
| npm run typecheck | PASS | All Node workspaces |
| node --test test/sandbox-config.test.js | PASS | 7 cases; app credentials, bootstrap idempotence/fail-closed, PDF byte identity |
| node scripts/sandbox.mjs init | PASS | Fresh ignored sandbox .env; preserved generated values, appended own-DB app credentials |
| Docker Compose CLI config --quiet | PASS | Portable official CLI; this does not start containers |
| node infrastructure/sandbox/verify-mongo.mjs with loopback MongoDB 7.0.24, JDK21/Maven | PASS with one skip | Latest private evidence .test-data/r1-mongo-cqymJY/result.json and maven.log |
| Java suite through that isolated runner | 41 PASS / 1 SKIPPED / 0 failures/errors | 42 total: 7 real Mongo repository tests, PDFBox parser test, existing HTTP/business/security/storage tests; Redis integration skipped without P03_REDIS_PORT |
| Six cross-DB read denials and six cross-DB write denials | PASS | Real Mongo authorization error code 13 for each pair; three own-DB reads/writes succeeded |
| Auth normal login with own DB user | PASS, HTTP 200 | Actual compiled Auth process; audit/rate limit/account operations use scoped credential |
| Tenant create transaction with own DB user | PASS, HTTP 200 | Actual compiled Tenant process, HTTP Auth lookup, Mongo transaction |
| sandbox:up / smoke / upload-e2e on Docker | NOT RUN | Docker executable/Engine unavailable; no live MinIO/Redis/Postgres migration operated |

The verifier creates a new temporary data directory and replica set, bootstraps test users using the Mongo driver, then starts actual Auth/Tenant and runs Java tests. Its real ACL results validate Mongo permissions; the production mongosh bootstrap is separately covered by a unit VM test, not claimed as Docker bootstrap execution. Temporary test processes are stopped; no existing cluster/data/secret is reused.

Exact verification environment (paths only, not secrets):
- JAVA_HOME points to the portable JDK21 under D:/SoftwareEngeering/reference-repository/.tools/jdk21.
- MONGOMS_SYSTEM_BINARY points to the cached mongod-x64-win32-7.0.24.exe.
- R1_MAVEN_CACHE points to D:/SoftwareEngeering/reference-repository/.m2-cache.
- node infrastructure/sandbox/verify-mongo.mjs sets DOCUMENT_TEST_MONGODB_URI only in the Maven child environment.

## Acceptance mapping

| Prompt | Verified | Still unverified |
| --- | --- | --- |
| M01 | Three distinct own-DB credentials in config; real six-pair read/write denials; actual Auth login/Tenant transaction; unit bootstrap idempotence and rejection of broad roles/stale password; no existing volume/secret changed | Upgrade of an existing Docker volume using actual mongosh provisioning |
| M02 | Real unique indexes, same-key duplicate winner, concurrent inserts, concurrent markQueued with one job, rollback on job conflict, unrelated storage-key collision remains an error; HTTP/auth regression tests; parseable PDF; no JDBC/JPA runtime imports/dependencies | Live HTTP → S3 → Mongo → Redis and outage recovery in Docker |
| M03 | Mongo-only inspection with app user, original metadata fields retained in snapshots, valid PDF same as parser fixture, real second tenant/course creation and runtime existence preflight, preserved 401/403/409/503/idempotency checks, retained SQL volume declaration | Actual U1–U7 against full stack; do not mark these PASS |
| M04 | Scope and source audit performed; no changes to Auth/Tenant business source, Chat, frontend, contracts, gateway or frozen features | Independent reviewer and operational cutover authorization |

## Failures corrected during implementation
- Initial Java test compile failed because factory.destroy declares Exception; fixed the test lifecycle signature.
- Initial config test rejected an unintended blank template line; normalized the example to names-only lines, retaining all assertions.
- All final executed checks above have their stated outcome. No test was weakened to hide a runtime failure.

## Required follow-up
Run the full Compose stack in a Docker-capable isolated environment, regenerate fixtures, run permissions and U1–U7, and explicitly run the Redis integration test. Review migration/backup/rollback before any deployment with existing SQL data.
