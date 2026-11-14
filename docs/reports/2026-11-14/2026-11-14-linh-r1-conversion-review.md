# M04 — R1 source and architecture review — 2026-11-14

Reviewer: same-agent source review; not an independent reviewer approval. Branch feat/linh-r1-conversion-20261114, base 27e11a8.
Decision for operational cutover/release: REQUEST CHANGES — mandatory full-stack evidence is missing. This does not prohibit publishing the implementation branch for review, as explicitly requested by the user.

## AS-IS and delivered scope

| Service / task | AS-IS | Diff | Evidence | Remaining | Status |
| --- | --- | --- | --- | --- | --- |
| Auth / M01 | Existing Mongo/JWT business logic | Sandbox URI now app-scoped; no service business code modified | Own-DB ACL and actual normal login 200 | Docker bootstrap upgrade | NOT EVALUATED for deployment |
| Tenant / M01 | Existing Mongo transactions and Auth API | Sandbox URI now app-scoped; no service business code modified | Own-DB ACL and actual tenant transaction 200 | Docker upgrade/live cross-service upload | NOT EVALUATED for deployment |
| Document / M02 | Existing JPA upload | MongoTemplate repository, unique indexes, local transaction, Mongo health, generic persistence 503; same DTO/business flow | 7 real Mongo tests plus existing regressions and PDFBox; 41 Java pass, 1 Redis skip | S3/Redis full-stack gates; independent review | NOT EVALUATED for cutover |
| Sandbox / M03 | SQL inspection and weak PDF/fake tenant fixture | Three app users, Mongo snapshots, full PDF, actual second tenant and course, six-pair permission command | Compose config and 7 config tests PASS | U1–U7 runtime NOT RUN | REQUEST CHANGES before acceptance |
| Chat/frontend/gateway/skeletons | Existing implementation/TO-BE gaps | No changes | git diff whitelist | Existing gaps remain frozen | NO-OP |

## Reviewed correctness and boundaries
- Root credentials remain only in Mongo server/bootstrap configuration. Runtime Auth/Tenant/Document URIs use different users and authSource, each granted exactly one readWrite role on its own database.
- Bootstrap creates missing users only; existing broad roles or changed passwords stop provisioning. It never silently updates credentials/roles on a live volume.
- Existing business fields, UUIDs, scoped idempotency tuple, storage key and jobs are preserved. Mongo job/status changes are atomic inside Document DB; no distributed transaction is claimed.
- Duplicate upload insertion checks the exact tuple before treating a duplicate index error as replay. Storage-key/document-ID collisions do not become successes.
- SQL migration remains tracked and postgres-data remains declared. No SQL data import/drop or existing-volume migration was executed.
- Public upload DTO, Redis event v1 and object-key construction are unchanged. Frozen worker/READY/vector/retrieval/chat/frontend/payment/OPA functionality was not added.
- Snapshot mapping retains the original SQL-observable metadata fields, including timestamps/size, so denied/replay snapshots do not weaken to counts only.
- PDFBox parses exactly the same bytes exported by the runtime PDF fixture helper. The second tenant is created through APIs and checked through a permitted reader before the cross-tenant test.

## Findings
### Medium — missing live M03 evidence (confirmed coverage gap)
Docker Engine/CLI is not installed on this machine. Source, component tests and Compose parsing cannot prove HTTP 202 → private S3 → Mongo → Redis or live dependency outage. Execute the existing M03 commands in a Docker-capable environment; attach evidence before declaring M03 accepted or cutting over real data.

### Medium — Redis publication/status window (inherited concern, documented)
Publication occurs before Mongo markQueued. A Mongo failure can leave UPLOADED with an existing deduplicated event. Same-key retry is supported, but no outbox/reconciler was authorized or added. Retain this limitation in the migration decision.

### Medium — failed S3 cleanup may leave an orphan (inherited concern)
The business service preserves the original exception and suppressed cleanup evidence. No new cleanup worker is introduced.

### Process limitation
M01 and M02 were implemented serially by one owner in one integration worktree instead of parallel agents/worktrees. Ownership boundaries were retained; scripts/sandbox-env.mjs and forbidden service/contracts/frontend paths were not modified. User repeated implementation and push authorization after scouting; no production cutover approval is inferred.

## Merge / acceptance order
Review M01 provisioning and M02 persistence independently; then run M03 live tests; then obtain independent M04 review. Publishing this branch is not merging it, approving production migration, or claiming full V4 implementation.
