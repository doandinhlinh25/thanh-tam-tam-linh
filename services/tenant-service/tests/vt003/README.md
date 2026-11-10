# BT3 VT-003 - Reviewer approval concurrency probe (Nguyen Thanh Tam, 23001929)

> Evidence scope: **executable isolated Node.js HTTP harness** beside the real tenant-service, NOT a live MongoDB/API integration. In-memory Map CAS is single-process only. This cannot prove production p95, AuthN/AuthZ, or multi-instance atomicity.

## Reproduce (Node.js 22+, no database, install or secrets)

```bash
cd services/tenant-service/tests/vt003
node --test reviewer.test.cjs
node --experimental-test-coverage --test reviewer.test.cjs
node load-100.cjs
```

16 tests cover reviewer read/approve, denial of source modifications, anonymous/inactive/student/cross-tenant restrictions, missing/stale versions, dependency failure, two concurrent requests, and 100 simultaneous approval attempts on ONE document/version. Expect one HTTP 200 and 99 HTTP 409. A localhost ephemeral port and independent fixture per test avoid shared state; no clock sleeps, random data or external network.

## Red-green-mutate
RED: reviewer approval received 403 instead of expected 200; 7/16 tests passed. GREEN: add reviewer to approval policy only; 16/16 pass. MUTATION (LOCAL-ONLY temporary branch, never submitted): remove mandatory If-Match validation by defaulting to version 1; VT08 fails. See evidence summaries.

## Not integrated into production
Needed next: add reviewer in Mongoose enum + Joi validation + invitation + course ACL; create approval ledger separate from immutable document; atomic Mongo conditional update using tenantId + resourceId + status pending + expected version; authenticate via real Auth and current membership; add audit trail, real MongoDB replica set integration tests and multi-instance deployed load benchmark (100 concurrent, p95 <=3.0s). Do not deploy harness or claim its fake tokens are secure.

Draft PR for team review; DO NOT MERGE without approval.
