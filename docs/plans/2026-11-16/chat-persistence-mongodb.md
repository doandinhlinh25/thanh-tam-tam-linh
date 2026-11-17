# Plan: Chat persistence migration to MongoDB

- Task ID: `2026-11-16-chat-mongo-migration`
- Status: `APPROVED (by user, 2026-11-17)`
- Revision: `2026-11-17` — clarified transaction boundary, cursor compatibility, atomic feedback upsert, data cutover gate and Windows-host replica-set topology.
- Inputs: `docs/reports/2026-11-16/2026-11-16-chat-mongo-migration-scout.md`; `docs/handoffs/2026-11-16-chat-mongo-migration.md`; user-stated direction in this Plan request; `docs/architecture/document.pdf` V4.0, printed pp. 24–25 (PDF pages 27–28).
- Baseline: `feat/chat-persistence` at `a8d548fa1d6b3bb603e151d2215f53daf7436d2f`; merge base `8aaceec1c4d4958e69536c622ad78dc58825ad29`.

## 1. Objective and background

Replace only Chat Service persistence with MongoDB `tt_chat_db` through PyMongo Async. Keep FastAPI routes, request/response DTOs, domain behavior, authorization inputs, Chat/RAG workflow and response formats stable. Preserve existing string resource IDs. Add the six required collections, indexes and replica-set transaction support. The requested final commit message is `refactor(chat): migrate persistence from PostgreSQL to MongoDB`; commit/push/merge are outside this Plan stage.

Architecture V4.0 assigns Chat its own `tt_chat_db`, prohibits direct access to Tenant/Document databases, and describes conversations, messages, and citation snapshots. This task additionally requires feedback, model usage and outbox collections. Current branch persistence is SQLAlchemy/PostgreSQL; its repository integration suite actually uses in-memory SQLite.

## 2. Scope and non-goals

**In scope:** Chat DB lifecycle/configuration, Mongo repositories, persistence-only dependency and repository-interface plumbing needed for owner scope/cursors, indexes/migration script, Docker test replica set, Mongo integration/API regression coverage, dependency/lock/Dockerfile/README cleanup, and a pre-cutover data inventory gate.

**Out of scope:** API routes/contracts/DTO changes; changes to authentication or authorization policy; changes to Evidence Gate, Citation Validator, retrieval, prompts, LLM behavior, evaluation criteria, or service boundaries; new usage metering/outbox publishing behavior; direct access to another service DB; production data migration without a separately approved and evidenced migration procedure; commit, push, merge, deployment, or deleting real database data.

No endpoint or OpenAPI contract is to be invented. Public cursor remains an opaque string in the current schema. Persistence errors must propagate through the existing error handler/response envelope; no fallback to another database or success-without-persistence path.

## 3. Current-state findings

- **Verified:** Branch/HEAD and merge base match the Scout. Since the Scout, no app changes were found. `.env.example` is already modified by the user and must be edited surgically only in its database block; retain the Gemini and other user edits. Numerous untracked files, including `document.pdf`, must remain untouched.
- **Verified:** `app/core/config.py` currently defines `DATABASE_URL` and `DATABASE_SYNC_URL`; `session.py` silently falls back to SQLite both on engine setup and schema initialization failures.
- **Verified:** `ChatService` can continue without persistence if database initialization raises, then run the RAG pipeline and return an answer. This violates the requested no-silent-fallback behavior and needs a persistence failure propagation correction in the same service, with RAG behavior otherwise untouched.
- **Verified:** Conversation history stores citations in a message JSON column today. `ConversationService.get_conversation()` consumes `Message.citations`; separate snapshot documents must be reassembled into this same entity/API shape.
- **Verified:** `FeedbackService.submit_feedback()` has trusted `tenant_id`/`user_id`, but calls `IMessageRepository.get_by_id(message_id)` without either value. Conversation history verifies conversation ownership before listing messages; scope is not passed into message repository methods. Persistence query interfaces need tenant/owner arguments for authorization-sensitive operations.
- **Verified:** Current messages use existing string IDs, and cursor helpers accept base64-encoded ISO datetimes as well as raw ISO strings. Current integration assertions paginate using those legacy timestamps. Current `migrations/` contains only package initializers; no Alembic environment/revisions exist.
- **Verified:** `document.pdf` printed pp. 24–25 (PDF pages 27–28) describes all six Chat collections and their key fields/indexes: conversations, messages, citation_snapshots, feedback, model_usage and outbox_events. The active repository currently implements only conversations/messages/feedback; model_usage/outbox_events have no writer/business behavior in this code.
- **Verified:** `docker context show` reports `desktop-linux`; `docker info` cannot connect to the Docker Desktop Linux engine named pipe. No Mongo image list or replica-set runtime can be observed while the daemon is unavailable. `mongosh` is not installed on the host. Do not claim replica-set tests have run.
- **Verified locally:** No local listener was found on port 5432 and `services/chat-service/.env` does not exist. This does not establish whether a deployed or separately hosted PostgreSQL DB contains records; live retention status remains **Unknown**. Do not read unrelated secrets or connect to an unspecified production DB during Cook.

## 4. Proposed design

### 4.1 Driver, lifecycle, and failure behavior

- Add the official PyMongo Async driver (`pymongo>=4.11,<5`) and use one `AsyncMongoClient` per FastAPI process/event loop. Initialize/close it through FastAPI lifespan; `ping` the configured deployment and expose its `tt_chat_db` database handle.
- Set `MONGODB_URI` and `MONGODB_DATABASE=tt_chat_db`. Local example: `mongodb://localhost:27017/?replicaSet=rs0`. Production credentials and auth source remain supplied by environment/secrets; no credential is committed.
- Repository calls use the shared DB handle and the request UoW's `ClientSession` for multi-document writes. Any startup/request connection failure is raised; remove SQLite fallback and ChatService's run-without-persistence branch. Keep the existing unhandled-error envelope/status unless an existing persistence error mapping applies; do not introduce new public error codes in this migration.
- Official PyMongo documentation distinguishes awaited network methods, async cursor iteration, and `AsyncMongoClient`; transactions use sessions and require a transaction-capable deployment. Sources: [PyMongo Async API](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/reference/migration/), [PyMongo connection guide](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/connect/), [PyMongo transactions](https://www.mongodb.com/docs/languages/python/pymongo-driver/current/crud/transactions/).

#### Windows-host replica-set harness

The integration process runs on the Windows host, not in a sibling container. A single-member Mongo test container will run `mongod --replSet rs0 --bind_ip_all --port 27018`; Compose publishes only `127.0.0.1:27018:27018`. Initiate the member from `mongosh` inside that same container with `host: "localhost:27018"`. Python on Windows connects to `mongodb://localhost:27018/?replicaSet=rs0`; the returned member address is therefore also host-resolvable and reaches the published port. Do not advertise `mongo:27017`: that Docker DNS name is not guaranteed resolvable from the Windows host, and PyMongo follows the member address returned during replica-set discovery. Docker publishes container ports to the host, while MongoDB requires replica member hostnames to resolve for clients; official references: [Docker Desktop networking](https://docs.docker.com/desktop/features/networking/), [MongoDB replica configuration](https://www.mongodb.com/docs/manual/reference/replica-configuration/).

This setup is an intentional single-node test topology only. The current Docker daemon is unavailable, so the hostname/port arrangement is reasoned from the documented networking and topology rules but **not yet empirically verified** on this machine. T4 must verify the actual handshake before using the harness for tests.

### 4.2 Collection schema and index design

All persisted application IDs remain strings and map to Mongo `_id`; no ObjectId conversion reaches the API. Timestamps are stored UTC-aware. BSON field names use the architecture's camelCase (`tenantId`, `ownerUserId`, `conversationId`, `createdAt`); repository mappers preserve snake_case domain/API attributes. Every resource query that needs ownership filters tenant and owner, even when `_id` is globally unique.

| Collection | Persistence scope | Core document fields | Required indexes |
| --- | --- | --- | --- |
| `conversations` | Implement; active repository aggregate | `_id` string, `tenantId`, `ownerUserId`, `courseId`, `sourceScope`, `title`, `status` (`active`/`deleted` mapped to entity `is_deleted`), `createdAt`, `updatedAt`, `lastMessageAt` | Unique `_id` (Mongo built-in); `(tenantId,ownerUserId,status,createdAt DESC,_id DESC)`; filtered listing index `(tenantId,ownerUserId,status,courseId,sourceScope,createdAt DESC,_id DESC)`. |
| `messages` | Implement; history aggregate | `_id` string, `tenantId`, `ownerUserId`, `conversationId`, `role`, `content`, `resultState` mapped to entity `status`, `requestId` optional, `refused`, `refusalReason`, `createdAt` | Unique `_id`; `(tenantId,ownerUserId,conversationId,createdAt ASC,_id ASC)`. Do not add a requestId uniqueness constraint in this migration because current message writes do not implement request idempotency. |
| `citation_snapshots` | Implement as the persistence representation of existing `Message.citations` | `_id` deterministic string derived from message ID and citation ordinal/ID; architecture fields `tenantId`, `messageId`, `evidenceId`, `documentId`, `documentVersion`, `pageFrom`, `pageTo`, `snippet`, `sourceType`; add `ownerUserId`, `conversationId`, `citationId`, `documentName` for scoped reads/current entity mapping. | Architecture index `(tenantId,messageId)`; unique `(tenantId,messageId,citationId)` when citation IDs are present; `(tenantId,ownerUserId,messageId)` for scoped detail reads. Store only existing validated evidence snapshot fields; no document content/chunks or external service data. |
| `feedback` | Implement; existing API/service behavior | `_id` existing `fb-*` string, architecture fields `tenantId`, `messageId`, `userId`, `rating`, `comment`, `createdAt`; add `ownerUserId`, `conversationId`, `reason`, `updatedAt` for current entity and scoped deletion. | Unique `(tenantId,messageId,userId)` (architecture and atomic idempotent upsert); `(tenantId,ownerUserId,conversationId)` for scoped deletion. |
| `model_usage` | Create collection/index only; no writer/business behavior in this PR | Architecture fields `tenantId`, `requestId`, `model`, `inputTokens`, `outputTokens`, `costEstimate`, `createdAt`. Add `_id` string for future stable identity; additional owner/conversation/message fields require an approved contract. | Unique `(tenantId,requestId)` as specified by V4.0. No usage writer is introduced. |
| `outbox_events` | Create collection/index only; no event publishing/creation behavior in this PR | Architecture fields `eventId`, `type`, `tenantId`, `payload`, `publishedAt`; use `eventId` as `_id` or enforce a unique eventId index. | Unique `eventId` as specified by V4.0. No event publisher, retry lifecycle, or additional event fields are invented here. |

The idempotent index script creates all six collections and the indexes above. It must fail loudly on incompatible existing index definitions. `model_usage` and `outbox_events` receive the architecture-defined fields and unique indexes, but no new writer or business/retry flow; the optional messages requestId unique index is created only if existing context can populate it without changing idempotency behavior.

#### Feedback atomic upsert

`FeedbackRepository.save()` will upsert by the exact natural scope `{tenantId, messageId, userId, ownerUserId}` where `ownerUserId == userId`; never upsert with a tenant/owner field omitted. The unique index remains exactly `(tenantId: 1, messageId: 1, userId: 1)`. `$set` always includes `rating` and `updatedAt`; it includes `comment` and/or `reason` only when the incoming value is non-null, preserving the current “omitted means retain” behavior. `$setOnInsert` includes the existing service-generated string `_id` (`fb-*`), tenant/owner/message/user/conversation IDs and `createdAt`; it includes `comment: null` or `reason: null` only when those fields were omitted from `$set`. Never `$set` `_id`, `createdAt`, tenant, owner or message identity on an existing record, so an upsert keeps its existing feedback ID and original creation time.

The message must be re-read inside the same short transaction with `tenantId`, `ownerUserId`, `messageId` and assistant-role predicates before upsert; its parent conversation ID supplies `conversationId`. On a `DuplicateKeyError`, abort the failed transaction, start a fresh transaction and look up the natural key with the same tenant/owner filters. If that row exists, retry the same update with `upsert=False` (retaining its `_id`); if no scoped row exists, re-raise because the collision may be on `_id` or indicate corrupt scope. Retry transient transaction/write-conflict errors by retrying the whole short transaction, with a bounded maximum of three attempts. Exhaustion and all non-retryable storage errors propagate through current error handling; no duplicate feedback is silently created and no unscoped fallback lookup is allowed.

### 4.3 Tenant and owner isolation

Extend persistence repository interfaces and pass already-authenticated `tenant_id` and `user_id` from existing services; do not add request fields, headers, routes, or DTO attributes. Mongo messages/snapshots/feedback carry `tenantId` and `ownerUserId`. `MessageRepository.save()` obtains these scope values from the already-persisted parent conversation using `conversationId` and rejects an absent/deleted parent. `FeedbackService` passes its trusted tenant/user to `get_by_id` and feedback lookup/upsert. `ConversationService` passes the verified conversation tenant/owner into history and delete methods. All update/delete predicates include tenant/owner. A cross-tenant or wrong-owner resource remains invisible using current not-found behavior. No connection string, DB handle, or credentials for Tenant/Document are added.

This is persistence-boundary argument plumbing only; authentication source and public behavior stay unchanged. Preserve any optional interface calls used by unit mocks with explicit compatibility defaults only where scope is not an authorization requirement; production owner-sensitive calls must always supply both fields.

### 4.4 Stable cursor compatibility

Keep the public schema as an opaque string. Continue accepting legacy base64-ISO and raw-ISO cursor values. Emit a versioned base64 JSON token containing version, UTC `createdAt`, and string `_id`; decode either the new form or the legacy timestamp. Conversations sort `(createdAt DESC,_id DESC)` and use a strict tuple-before predicate; messages sort `(createdAt ASC,_id ASC)` and use a strict tuple-after predicate. This makes new pages deterministic for equal timestamps without breaking existing saved cursors. Invalid cursor inputs continue raising the current `ValidationException` and API error mapping. Tests must include legacy cursor and tied timestamp pages with no duplicates or gaps.

Put the shared cursor encoder/decoder in `app/core/pagination.py`. Mongo repository decoders accept both token versions; `ConversationService.list_conversations()` and `get_conversation()` call the encoder when assigning `next_cursor` (currently each constructs timestamp-only cursors inline). Legacy timestamps cannot identify the last `_id`, so when records share the cursor timestamp a legacy continuation may skip or repeat tied records; accept it for compatibility but promise deterministic no-gap/no-duplicate traversal only for newly emitted versioned cursors.

### 4.5 Unit of Work and transaction boundaries

Each persistence operation owns a short UoW transaction. ChatService may read and verify an existing conversation before Retrieval, but it must not open a Mongo transaction or persist intermediate records during Retrieval/LLM. Hold the new conversation (if any), incoming user message, assistant result, and citation snapshots as in-memory entities until the pipeline succeeds; then begin a transaction, re-verify the existing conversation with `tenantId` + `ownerUserId` (or verify the new ID is insertable), write/update the conversation and both messages/snapshots together, and commit. If Retrieval/LLM fails, no database write has occurred, preserving the current observable rollback result. If ownership/deletion changes during the network call, the in-transaction verification fails and nothing commits. The chat response is returned only after persistence commits.

Conversation deletion also begins a short transaction, rechecks conversation ownership in that transaction, then removes feedback, messages, citation snapshots and the conversation atomically. Feedback verifies the assistant message and upserts within one short transaction. UoW rollback aborts on exceptions/commit failure; dependency cleanup closes sessions and never auto-commits. Soft delete remains only the existing conversation status update; children remain as before. A Mongo replica set is mandatory for these multi-document transaction tests.

### 4.6 PostgreSQL data migration gate

The PR code migration and production data cutover are separate decisions. The branch may remove PostgreSQL repositories, ORM models, Alembic files and PostgreSQL dependencies after replacement tests are in place; this does not delete or modify the PostgreSQL database. Before any deployed cutover, the service/data owner must confirm whether PR #8 was deployed and whether source records exist, using approved read-only inventory evidence without placing secrets or record contents in Git. If no live records exist, record evidence and skip backfill. If records exist or status remains unknown, do not deploy/cut over or delete the source database; require a separately approved backfill plan with counts, mapping, verification and rollback. Never run a live migration or drop the source DB as part of this code change.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `services/chat-service/app/core/config.py` | Replace PostgreSQL URLs with Mongo URI/database settings. | T1 |
| `services/chat-service/app/integrations/database/session.py` | AsyncMongoClient lifecycle, ping, database access, no fallback, clean close. | T1 |
| `services/chat-service/app/integrations/database/unit_of_work.py` | Request ClientSession, commit/abort/cleanup; bind repositories. | T2 |
| `services/chat-service/app/dependencies.py` | Provide Mongo DB/UoW dependencies and lifecycle. | T1 |
| `services/chat-service/app/api/controllers/chat_controller.py` | Remove AsyncSession annotations; inject persistence UoW as needed, preserve route/signature payloads. | T1 |
| `services/chat-service/app/api/controllers/conversation_controller.py` | Same persistence DI change; retain endpoints/DTOs. | T1 |
| `services/chat-service/app/api/controllers/feedback_controller.py` | Same persistence DI change; retain endpoints/DTOs. | T1 |
| `services/chat-service/app/domain/repositories/conversation_repository.py` | Add scope/cursor args only where required by existing owner-scoped service calls. | T3 |
| `services/chat-service/app/domain/repositories/message_repository.py` | Add tenant/owner filters to `get_by_id`, history and deletion calls. | T3 |
| `services/chat-service/app/domain/repositories/feedback_repository.py` | Add scoped lookup/deletion contract while preserving feedback operations. | T3 |
| `services/chat-service/app/services/chat_service.py` | Replace SQL session factory wiring and remove success-without-persistence exception path; no RAG logic edits. | T1/T3 |
| `services/chat-service/app/services/conversation_service.py` | Pass verified tenant/owner into message/feedback persistence calls; preserve results and limits. | T3 |
| `services/chat-service/app/services/feedback_service.py` | Pass existing trusted tenant/user into message/feedback repo filters; preserve validation/upsert response. | T3 |
| `services/chat-service/app/core/pagination.py` | New versioned cursor encoder/dual legacy+v2 decoder used by service next-cursor generation and repositories. | T3 |
| `services/chat-service/app/repositories/mongodb/__init__.py` | New Mongo repository package exports. | T3 |
| `services/chat-service/app/repositories/mongodb/conversation_repository.py` | New conversation CRUD/filter/soft+hard delete/index mapper. | T3 |
| `services/chat-service/app/repositories/mongodb/message_repository.py` | New history, tenant/owner-scoped CRUD, snapshots and cursor behavior. | T3 |
| `services/chat-service/app/repositories/mongodb/feedback_repository.py` | New tenant/owner-scoped atomic upsert and delete. | T3 |
| `services/chat-service/app/repositories/postgres/__init__.py` | Delete obsolete SQL repository package. | T5 |
| `services/chat-service/app/repositories/postgres/conversation_repository.py` | Delete PostgreSQL repository. | T5 |
| `services/chat-service/app/repositories/postgres/message_repository.py` | Delete PostgreSQL repository. | T5 |
| `services/chat-service/app/repositories/postgres/feedback_repository.py` | Delete PostgreSQL repository. | T5 |
| `services/chat-service/app/repositories/models/__init__.py` | Delete SQLAlchemy model exports. | T5 |
| `services/chat-service/app/repositories/models/base.py` | Delete declarative base. | T5 |
| `services/chat-service/app/repositories/models/conversation_model.py` | Delete ORM model. | T5 |
| `services/chat-service/app/repositories/models/message_model.py` | Delete ORM model. | T5 |
| `services/chat-service/app/repositories/models/feedback_model.py` | Delete ORM model. | T5 |
| `services/chat-service/scripts/mongodb_migrate.py` | New idempotent collection/index setup command. | T2 |
| `services/chat-service/.env.example` | Replace only the existing DB block with Mongo settings; preserve all prior Gemini/user edits verbatim. | T1 |
| `services/chat-service/pyproject.toml` | Remove SQL dependencies; add bounded PyMongo dependency. | T5 |
| `services/chat-service/uv.lock` | Regenerate lock for the dependency change. | T5 |
| `services/chat-service/Dockerfile` | Remove Alembic copy; include migration/index script. | T5 |
| `services/chat-service/README.md` | Replace PostgreSQL/Alembic instructions with Mongo env/index setup and replica-set requirement. | T5 |
| `services/chat-service/alembic.ini` | Delete obsolete Alembic config. | T5 |
| `services/chat-service/migrations/__init__.py` | Delete obsolete package initializer after replacing migration structure. | T5 |
| `services/chat-service/migrations/versions/__init__.py` | Delete obsolete Alembic versions initializer. | T5 |
| `services/chat-service/tests/conftest.py` | Add isolated Mongo fixture and cleanup using separate test DB/prefix. | T4 |
| `services/chat-service/tests/integration/test_postgres_repository.py` | Delete SQLite-backed persistence tests after equivalent Mongo coverage exists. | T4/T5 |
| `services/chat-service/tests/integration/test_mongodb_repository.py` | New repository/transaction/outage integration matrix. | T4 |
| `services/chat-service/tests/integration/test_chat_api.py` | Replace SQL fixture setup with Mongo fixture; preserve existing API assertions and add persistence outage regression. | T4 |
| `services/chat-service/tests/integration/mongo-replica-set.compose.yaml` | New disposable, no-volume test replica set: mongod listens on container port 27018; bind only host `127.0.0.1:27018`; single member advertises `localhost:27018` for Windows-host Python. | T2/T4 |
| `services/chat-service/tests/integration/mongo-init.js` | New one-time `rs.initiate()` helper mounted read-only in the Mongo container and executed by its `mongosh`, not a separate init container. | T2/T4 |

No `.github` workflow or Chat-service Compose file was found in the live tree; do not create/modify CI or production Compose configuration in this PR. The test-only Compose file is sufficient to specify a reproducible local replica-set harness. Keep unit tests under `tests/unit/` and all RAG/evaluation code unchanged.

## 6. Ordered implementation tasks

All tasks have one owner (the current branch owner), run sequentially, and share the same branch. No parallel edits are planned.

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T0 | Reconfirm `feat/chat-persistence`, preserve dirty/untracked user work, and record production data status separately from branch coding. Do not inspect secrets or run data migration. | No source file; report/handoff only if evidence/decision is recorded. | `git status --short --branch`; obtain approved read-only source DB inventory before deployment cutover. | Correct branch; user work unchanged. Unknown/real data blocks production cutover/source DB deletion, but does not block removing PostgreSQL code/dependencies from this PR after equivalent Mongo tests pass. | None |
| T1 | Implement Mongo configuration/lifecycle and DI; remove PostgreSQL URL use and silent no-persistence ChatService path. Keep API route/DTO definitions unchanged. | Config, database session, dependencies, 3 controllers, narrow ChatService persistence bootstrap, `.env.example` DB block only. | `rg -n "sqlalchemy|asyncpg|psycopg|DATABASE_URL|AsyncSession" app` (remaining matches only in tests/removal tasks); `python -m compileall app`; inspect router/OpenAPI diff. | AsyncMongoClient is pinged and closed cleanly; connection errors propagate; no fallback; endpoint/schema diff is empty. | T0 |
| T2 | Add collection/index bootstrap and migration command, then verify idempotence against a disposable replica set when available. | `scripts/mongodb_migrate.py`; integration replica-set Compose/init files; README command draft. | `python -m scripts.mongodb_migrate` twice against test URI; compare collection/index listing; second run succeeds without index drift. | All six collections and defined indexes exist; incompatible existing index fails loudly. | T1 |
| T3 | Implement Mongo repositories, document mappers, tenant/owner query arguments, shared cursor encoder/decoder, atomic feedback upsert/retry and short UoW transactions. Stage Chat entities in memory during RAG, then verify ownership and persist them atomically after pipeline success. | UoW, 3 repository interfaces, 3 Mongo repos, 3 services, `app/core/pagination.py`, snapshot storage via message repo. | Focused tests from T4; static search for every repo call; inspect ChatService transaction begin occurs only after pipeline returns; API/schema diff. | No transaction spans Retrieval/LLM; pipeline failure leaves same persisted state as current rollback behavior; owner recheck precedes commit; scoped CRUD/history/snapshots/feedback and cursor compatibility work. | T1, T2 |
| T4 | Replace SQLite persistence/API fixture and add real replica-set integration plus API/RAG regression checks. | `tests/conftest.py`, replace `test_postgres_repository.py`, edit `test_chat_api.py`, add `test_mongodb_repository.py`, replica-set Compose/init files. Unit/RAG tests unchanged. | `docker compose -f tests/integration/mongo-replica-set.compose.yaml up -d --wait`; run `docker compose exec mongo mongosh --port 27018 --quiet --file /tmp/mongo-init.js`; confirm `rs.status()` has one `PRIMARY`; confirm `Test-NetConnection localhost -Port 27018`; set `$env:MONGODB_TEST_URI='mongodb://localhost:27018/?replicaSet=rs0'`; run `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py -k replica_set_handshake`, then repository/API tests and unit/contract/evaluation suites. | Host client hello reports `setName=rs0`, `isWritablePrimary=true`, and member `localhost:27018`; all Mongo tests pass on replica set. Fail and report NOT RUN/BLOCKED if Docker daemon/image is unavailable, the advertised host is unreachable, or no PRIMARY forms; never substitute SQLite. | T2, T3 |
| T5 | Remove SQL/Alembic artifacts/dependencies; update lock, Dockerfile, README; audit scope and run complete service checks. | SQL repo/model files, Alembic files, `pyproject.toml`, `uv.lock`, Dockerfile, README. | `rg -n "sqlalchemy|asyncpg|psycopg|alembic|postgresql|SQLite fallback" services/chat-service --glob '!uv.lock'`; `python -m compileall app scripts tests`; `uv run --extra dev python -m pytest`; `uv run --extra dev ruff check app scripts tests`; `git diff --check`; inspect changed paths. | No runtime PostgreSQL dependency/config/fallback; only migration-scoped files changed; report all available test results. | T4. Production cutover/source DB deletion remains independently gated by T0 data confirmation. |

## 7. Dependencies and prerequisites

- User approval of this Plan is required before Cook. Keep status `DRAFT` until explicit approval; then record approver/date in this plan and handoff.
- `pymongo` version must include supported `AsyncMongoClient` and fit Python `>=3.11`; pin a compatible minor range in `pyproject.toml`, then regenerate `uv.lock` with the repository's installed uv/package index. Network/package-index access is unverified.
- Docker daemon currently unavailable. MongoDB image availability is therefore unknown. Replica-set integration is a mandatory acceptance check, not an optional substitute: obtain a runnable Docker daemon and MongoDB test image before `$test`, or report it `NOT RUN` and mark the result `PARTIAL/BLOCKED` as appropriate.
- The Mongo test harness uses a disposable replica set on host port `27018`, no persistent volume, and an isolated test database. It must not use production credentials or DB names.
- Live PostgreSQL data status is unknown. Service/data owner must confirm no real records need preservation, or a separate backfill plan must be approved before cutover/PG retirement.
- No frontend or other service specialist skills apply. Cook should open the backend workflow `cook` and `test` skills when those stages are authorized, plus review the focused repository conventions as needed.
- Branch policy: work only on current `feat/chat-persistence`; do not switch to/edit `main`; preserve user changes; no commit/push/merge until all required stages complete and explicit commit authorization remains in force.

## 8. Testing and verification strategy

The following commands are from the service root. `uv`, `python`, and `pytest` are available on this host, but project dependencies were not verified or installed. Sync only after Cook approval using the service `pyproject.toml` dev dependencies. The integration URI is test-only. Do not run root Node checks as substitutes for Python checks.

| Acceptance criterion | Check | Level (unit/integration/e2e/manual) |
| --- | --- | --- |
| AC1. Conversation create/read/update/list, filters, soft delete and hard delete preserve string IDs/fields. | `python -m pytest tests/integration/test_mongodb_repository.py -k conversation` | Mongo replica-set integration |
| AC2. Messages persist and return in chronological `(createdAt,_id)` order. | `python -m pytest tests/integration/test_mongodb_repository.py -k message` including equal-timestamp fixtures | Mongo replica-set integration |
| AC3. Citations round-trip through `citation_snapshots` and rehydrate `Message.citations`/existing detail DTO exactly. | `python -m pytest tests/integration/test_mongodb_repository.py -k citation` and existing conversation detail API test | Mongo replica-set + API regression |
| AC4. Concurrent/repeated feedback submits have one row per `(tenantId,messageId,userId)`, preserve existing `_id`/createdAt and retain current omitted-comment/reason semantics. | `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py -k feedback`; force DuplicateKeyError and transient write-conflict paths; verify fresh-transaction retry and max-attempt failure | Mongo replica-set integration |
| AC5. Owner and tenant scopes reject cross-user/cross-tenant conversation, message, citation, feedback read/update/delete. | `python -m pytest tests/integration/test_mongodb_repository.py -k 'owner or tenant'` | Mongo replica-set integration |
| AC6. Cursor encoder emits `(createdAt,_id)` v2 tokens from both `next_cursor` sites; decoder accepts legacy base64-ISO and raw ISO. V2 tied-timestamp pages have no duplicates/gaps; legacy timestamp-only cursors are accepted but their ambiguity on ties is asserted/documented. | `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py tests/integration/test_chat_api.py -k "cursor or pagination"` | Mongo integration + API regression |
| AC7. Conversation hard deletion removes messages, citation snapshots and feedback atomically; soft delete retains children but hides conversation. | `python -m pytest tests/integration/test_mongodb_repository.py -k delete` | Replica-set integration |
| AC8. Injected exception after persistence mutations and failed commit leave no partial records; UoW rollback works and ChatService does not hold a transaction/session through the mocked Retrieval/LLM await. | `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py -k rollback`; then `uv run --extra dev python -m pytest tests/unit/test_chat_service.py` | Replica-set integration + unit |
| AC9. Unreachable Mongo fails startup or persistence dependency/request and no RAG success is returned without persistence. | `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py -k connection_failure` and targeted API outage regression using short server-selection timeout; do not change the existing health endpoint contract. | Integration/API regression |
| AC10. Existing routes, response schemas, business assertions, Evidence Gate/Citation Validator/RAG behavior are unchanged. | `python -m pytest tests/integration/test_chat_api.py tests/unit tests/contract tests/evaluation` (must run after dev dependency sync) | Unit + API/contract/evaluation regression |
| AC11. Six collections and architecture indexes are created repeatably; no writer for `model_usage`/`outbox_events` is introduced. | Run migration command twice on test RS; assert `list_collection_names()`/`index_information()` and inspect API/domain diff. | Replica-set integration + manual diff |
| AC12. Windows-host PyMongo resolves the same advertised replica-set member and reaches a writable primary through Docker Desktop port publishing. | Compose T4 harness; inside-container `rs.status()`; Windows `Test-NetConnection`; pytest handshake asserts `hello.setName`, `hello.isWritablePrimary`, and advertised host `localhost:27018`. | Docker integration |
| AC13. No PostgreSQL code/dependency/fallback remains in runtime. | `rg` audit in T5; inspect `pyproject.toml`/`uv.lock`, import graph and diff. | Static/manual |
| AC14. MongoDB outage does not leak connection details/secrets and uses current error envelope/status. | API regression asserts current error response and no successful persistence-less chat; inspect logs/output for URI. | API regression + manual |
| AC15. User changes and all out-of-scope business/RAG files are preserved. | `git status --short`; `git diff --name-status`; compare `.env.example` non-DB lines and existing untracked paths. | Manual |

The repository declares pytest/pytest-asyncio and Ruff in `services/chat-service/pyproject.toml`; `uv`, `python`, and `pytest` are available on this host, but current project dependencies were not verified and were not installed. CI workflow was not found. Exact end-to-end commands after dependencies are synced, from the service directory: `uv run --extra dev python -m pytest` and `uv run --extra dev ruff check app scripts tests`. For integration tests in PowerShell, set `$env:MONGODB_TEST_URI='mongodb://localhost:27018/?replicaSet=rs0'` before pytest. Report pass/fail/skipped/NOT RUN individually. No assertion may be weakened to accommodate Mongo behavior.

## 9. Risks and mitigations

- **Replica-set discovery across Windows/Docker Desktop:** a container-only name such as `mongo:27017` may be returned by MongoDB but cannot be resolved by host Python; MongoDB requires replica-set member names to resolve for every client. Mitigation: single-node test only, mongod listens at container port 27018, publish `127.0.0.1:27018:27018`, advertise `localhost:27018`, initialize/check from inside the Mongo container, and assert PyMongo handshake from Windows host. The Docker daemon is currently off, so this topology remains unverified until T4.
- **Unknown PostgreSQL live data:** converting branch code does not migrate or delete source data. Mitigation: PostgreSQL code/dependencies may be removed in the PR, while deployment cutover and source DB deletion remain prohibited until owner-provided inventory proves no data or a separately approved backfill plan completes.
- **Owner fields absent from Message entity:** query scope must be persisted from parent Conversation and passed from trusted existing context. Mitigation: repository-interface plumbing plus negative tenant/owner integration tests; no public API changes.
- **Cursor format/ties:** legacy timestamp-only cursors cannot identify a record among equal timestamps and can skip or repeat tied records. Mitigation: accept them for compatibility, emit v2 `(createdAt,_id)` tokens, and guarantee deterministic pagination only for v2 cursors; test encoder, both decoders, both `next_cursor` producers and tied records.
- **Snapshot consistency:** a write can persist a message without all citation snapshots if writes escape the shared transaction. Mitigation: force same session through all repositories and test rollback across message plus snapshots.
- **Chat persistence write timing:** current SQL writes are uncommitted until pipeline success. Mitigation: hold equivalent entities in memory through Retrieval/LLM and persist them together afterward; on pipeline error persist nothing, matching rollback-visible behavior. Recheck existing conversation ownership inside the transaction before commit.
- **Feedback concurrent upsert:** natural-key races can produce duplicate-key or transaction write-conflict errors. Mitigation: unique `(tenantId,messageId,userId)`, scoped natural-key reread after abort, update existing row with `upsert=False`, and at most three complete transaction attempts for transient conflicts; never change existing `_id` or broaden scope.
- **Unique index conflicts on existing data:** `feedback` tenant may currently be nullable; old or seeded duplicate records could block index creation. Mitigation: inventory/validate before index bootstrap; do not silently delete, merge, or rewrite records.
- **Package lock/network:** adding PyMongo Async requires lock regeneration; network/index access unknown. Mitigation: report lock generation blocker instead of hand-editing/faking `uv.lock`.
- **`.env.example` conflict:** user added Gemini config changes. Mitigation: replace only DB lines and verify remaining lines with a focused diff.

## 10. Acceptance criteria

- [ ] AC1–AC3: conversation/message/citation repository CRUD and history API remain compatible; IDs stay strings; citation snapshots rehydrate the current `Message`/DTO output.
- [ ] AC4: feedback upsert is atomic/idempotent under the tenant/message/user unique index.
- [ ] AC5: every owner-sensitive read/update/delete filters trusted `tenantId` and `ownerUserId`; cross-tenant/user tests reject access.
- [ ] AC6: cursor encoder/decoder and both `next_cursor` call sites use versioned `(createdAt,_id)` tokens; legacy base64/raw timestamp tokens remain accepted, with their equal-timestamp skip/repeat limitation explicitly tested and documented.
- [ ] AC7–AC8: hard delete and rollback are atomic on a Mongo replica set; Chat's transaction begins only after Retrieval/LLM completes; owner is reverified inside the transaction before commit; soft-delete semantics remain unchanged.
- [ ] AC9, AC14: database outage fails clearly through existing API error handling; no SQLite/PostgreSQL fallback or answer without persistence.
- [ ] AC10: API, DTO, authentication source, business rules, RAG and evaluation behavior are unchanged, proven by unchanged relevant source diff and regression tests.
- [ ] AC11: all six requested collections/indexes are provisioned idempotently; `model_usage` and `outbox_events` have no newly invented writers/business flow.
- [ ] AC12: Windows-host Python connects through Docker Desktop using the advertised `localhost:27018` replica-set member and a writable `rs0` primary; otherwise replica-set tests are not pass.
- [ ] AC13: PostgreSQL/SQLAlchemy/Alembic/asyncpg/psycopg dependencies, runtime imports/config and SQLite fallback are removed from Chat Service.
- [ ] AC15: only plan-whitelisted Chat persistence/config/test/docs files change; `.env.example` user edits and unrelated untracked work remain intact.
- [ ] `$test` records every required test outcome truthfully; replica-set tests are not reported PASS unless run against a real transaction-capable Mongo deployment.
- [ ] Live data disposition is recorded before any deployed cutover; existing PostgreSQL data is not discarded without approved backfill evidence.

## 11. Rollback or recovery

- **Before deployment/cutover:** revert the migration commit on `feat/chat-persistence` (after all workflow stages), restore the prior PostgreSQL dependency/DI files from Git, and retain the original PostgreSQL database. Do not revert or overwrite the pre-existing user `.env.example` Gemini edits; restore only the migration's database-block delta.
- **After a code-only deployment with confirmed empty Mongo database:** redeploy the prior PostgreSQL build/config. Retain Mongo test/deployment data until rollback is verified; do not drop either DB automatically.
- **If live PostgreSQL records exist:** the PR branch may still contain Mongo-only code and no PostgreSQL dependencies, but do not deploy/cut over or delete the source DB. Pause production transition and obtain separate approved backfill/cutover/verification/rollback plan. If partial Mongo writes occur during an attempted cutover, stop writes, preserve both DB snapshots, reconcile counts/IDs, and recover only under that approved data plan.
- **Index migration failure:** fail startup/rollout, leave source database intact, inspect incompatible index definitions and records; never auto-drop an index or delete duplicate data. Apply a revised/approved migration plan before retry.

## 12. Completion checklist

- [ ] All tasks done or explicitly deferred with approval
- [ ] Acceptance criteria verified by `$test` with evidence
- [ ] `$review` decision recorded
- [ ] Docs, config examples, Mongo index migration, and tests updated
- [ ] PostgreSQL artifact/data disposition documented
- [ ] Handoff updated
- [ ] Final scope audit confirms only `feat/chat-persistence` changed and user work preserved
- [ ] Commit `refactor(chat): migrate persistence from PostgreSQL to MongoDB` created only after authorized workflow completion; no push or merge

### Handoff for Cook

After this DRAFT is explicitly approved, Cook should implement T1–T5 sequentially on the existing `feat/chat-persistence` branch, following the exact file table and preserving all user work. Cook must not change public API/DTOs or RAG logic. Chat persistence must remain buffered until Retrieval/LLM succeeds; then ownership is rechecked within the short transaction before writes/commit. Keep the dual-format cursor and exact feedback filter/update/retry policy. PostgreSQL code/dependencies may be removed from this branch, but production cutover/source DB deletion remains blocked until data inventory is verified. T4 must prove the Docker Desktop hostname/port handshake from Windows-host Python; current daemon failure means it has not been verified yet. Required dependencies to inspect before implementation: `services/chat-service/pyproject.toml`, config/DI/repository/service call graph, existing API tests, and current repo status. Run no commit/push/merge during Cook.
