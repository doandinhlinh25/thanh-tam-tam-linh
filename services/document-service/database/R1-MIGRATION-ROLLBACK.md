# R1 — mapping, migration and rollback (plan only)

No production migration, SQL deletion, volume removal or write cutover is performed by this branch.

## Ownership and runtime
Document uses only document_sandbox in the sandbox, or tt_document_db in an approved deployment. Its account has readWrite on that database only. Auth/Tenant ownership is unchanged. S3 holds the PDF; Redis Streams transports the unchanged v1 ingestion event.

## Field mapping
| PostgreSQL | Mongo documents | Preservation |
| --- | --- | --- |
| document_id | _id (String UUID) | Preserve exact string; never regenerate |
| tenant_id/course_id/uploader_user_id | tenantId/courseId/uploaderUserId | Logical references only; no other service DB lookup |
| idempotency_key | idempotencyKey | Unique together with the three scope fields |
| file_name/byte_size/checksum_sha256 | fileName/byteSize/checksumSha256 | SHA-256 and byte size must match the existing private object |
| storage_key/access_scope | storageKey/accessScope | Preserve key tenant/course/document/1.pdf and COURSE |
| status/document_version/page_count/failure_code | status/documentVersion/pageCount/failureCode | Only existing UPLOADED/QUEUED behavior; preserve nulls |
| created_at/updated_at | createdAt/updatedAt (BSON datetime) | UTC timestamps, millisecond precision; public ISO output |
| ingestion_jobs.job_id | ingestion_jobs._id | Existing stable ingest job ID |
| document_id/tenant_id/document_version/status/created_at | documentId/tenantId/documentVersion/status/createdAt | Same fields and unique (documentId,documentVersion) |

Indexes are initialized by DocumentsRepository: unique upload tuple, unique storageKey, tenant/course lookup, unique job document/version, plus Mongo _id uniqueness.

## Invariants and failure recovery
- A unique-key race on the upload tuple has one insert winner. Losers remove only their own UUID-named S3 object, load the winner and compare hash.
- Same key/hash reuses the ID; different hash returns 409. Unrelated unique failures do not become successful replays.
- Redis publication remains before markQueued. Mongo job upsert and document status transition are a local transaction; transient transaction errors have a bounded retry.
- Redis uses the existing dedup key/script, so retry after a Mongo status-update failure does not intentionally publish twice.
- This is NOT an atomic S3–Mongo–Redis transaction. A failure after Redis publication may leave UPLOADED with a published event. Cleanup failure may leave an orphan S3 object. Neither an outbox nor a background reconciliation worker is added.
- Restore unavailable dependencies and retry the same key and original bytes. Retain failed object/job IDs for a separately approved reconciliation.

## Proposed data cutover (requires approval and live integration)
1. Inventory all SQL documents/jobs and versions; take a verified SQL backup and S3 object manifest/checksums. Record source counts, statuses and duplicate/orphan findings.
2. Stop writes for this deployment and retain the SQL connection/configuration privately. Do not alter Auth/Tenant data.
3. Create only the Document app user/database and unique indexes in an isolated target. Resolve any incompatible duplicates before import; do not silently drop rows.
4. Import mapped fields while retaining document/job IDs, scope, object keys, hashes and timestamps. No file re-upload or event replay by the importer.
5. Compare per-tenant and per-course counts, every metadata/job association, checksum/size and a sample of actual object bytes. Compare Redis dedup IDs; do not enqueue all historical jobs again.
6. Run M03 real authorized/denied, idempotent, conflict, dependency outage and six cross-DB denial checks. Owner reviews M04 and explicitly approves write cutover.
7. Change only this deployment's Document URI and resume writes under observation.

## Rollback
Before new writes, restore the previous JPA build/config from base 27e11a8 and the preserved SQL database/volume. The SQL migration remains in database/migrations.
After Mongo-only writes, freeze writes and reconcile all delta document/job IDs, keys and checksums before choosing a target; simply flipping a URI would lose visibility of new documents. No automatic rollback/import/export script is supplied or run. Preserve both stores and private object data until ownership approves the reconciliation.
