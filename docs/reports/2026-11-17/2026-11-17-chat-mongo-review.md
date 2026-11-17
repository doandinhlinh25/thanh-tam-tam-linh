# Chat MongoDB Migration — Review Report

- Date: 2026-11-17
- Branch: `feat/chat-persistence`
- HEAD: `a8d548fa1d6b3bb603e151d2215f53daf7436d2f`
- Target/base: `main` at `8aaceec1c4d4958e69536c622ad78dc58825ad29`
- Plan: `docs/plans/2026-11-16/chat-persistence-mongodb.md`
- Verdict: **REQUEST CHANGES**
- Scope: independent review of the working-tree changes from `a8d548f` and the complete proposed branch diff against `main`. No application code was modified; no commit, push, merge, production database access, migration, or cutover was performed.

## Review summary

The broad migration structure matches the approved plan: Chat owns `tt_chat_db`, uses PyMongo Async, has no PostgreSQL/SQLAlchemy runtime dependency or SQLite fallback, scopes normal repository queries by tenant and owner, and has index/bootstrap and cursor-v2 support. The inspected changes do not alter route declarations, response models, RAG prompts, Evidence Gate rules, or Citation Validator decisions. The current code nevertheless has two confirmed persistence correctness defects and two additional risks that need resolution before approval.

## Findings

### High — User messages are timestamped after assistant messages

- Location: `services/chat-service/app/services/chat_service.py:153-189`; history sort in `services/chat-service/app/repositories/mongodb/message_repository.py`.
- `answer_question()` runs retrieval/LLM, timestamps the assistant response, then starts the transaction and timestamps the user message. History sorts ascending by `(createdAt, _id)`. The assistant is therefore normally earlier than the user in stored history; BSON millisecond precision can collapse times, in which case random string IDs can also put either role first. The baseline implementation timestamped/saved the user message before pipeline execution, so this is a behavior regression introduced by buffering persistence.
- Fix required: capture the user message timestamp before retrieval, keep the write transaction after retrieval, and timestamp the assistant after pipeline completion. Persist both buffered messages in that order. Add a regression assertion using stored history and equal BSON-millisecond timestamps.

### High — Concurrent feedback can recreate an orphan after conversation deletion

- Location: `services/chat-service/app/repositories/mongodb/feedback_repository.py:32-90`; cascade in `services/chat-service/app/services/conversation_service.py` and `services/chat-service/app/repositories/mongodb/conversation_repository.py`.
- `save()` verifies its assistant parent with a transactional read, then writes only to `feedback`. A concurrent hard-delete transaction writes/deletes the parent and cascades feedback/messages/conversation. MongoDB snapshot isolation does not create a write conflict from the feedback transaction's read-only parent check, because its write is to a different document/collection. I reproduced this on the disposable review replica set: after both transactions committed, counts were `conversation=0, message=0, feedback=1`; the isolated review database was dropped afterward. This violates cascade consistency and can retain feedback after a conversation has been deleted.
- Fix required: make feedback insertion and deletion serialize through a shared write-conflict/coordination document in the same transaction, or provide another proven atomic strategy. Add a replica-set race regression test that asserts no feedback remains after delete wins and no write succeeds against a deleted parent.

### Medium — Per-request Retrieval HTTP client is not closed

- Location: `services/chat-service/app/api/controllers/chat_controller.py:53-54`; `services/chat-service/app/services/chat_service.py:253-256`; `services/chat-service/app/ai/retrieval/client.py`; `services/chat-service/app/integrations/retrieval_service/http_client.py:32-35,108-109`.
- The FastAPI dependency constructs a new `ChatService` per request. Its default constructor creates a new pipeline and retrieval client; the first retrieval call creates an `httpx.AsyncClient`. Although `ChatService.close()` closes that pipeline resource, the dependency returns normally and never calls `close()`. The Mongo UoW dependency closes only the UoW. This can leak HTTP connection pools across requests; baseline used a module-level ChatService instance.
- Fix required: use a yield dependency with `finally` cleanup, or manage a shared pipeline/client in application lifespan. Add cleanup assertions for success and exception paths.

### Medium — Conversation repository owner scope is optional

- Location: `services/chat-service/app/repositories/mongodb/conversation_repository.py:23-27,61-67` and the matching repository interface.
- `get_by_id()` and `delete()` omit `ownerUserId` from the query when `user_id=None`. Current service call sites pass the authenticated owner, so I found no currently reachable endpoint bypass. The repository API itself remains fail-open for a future caller that supplies only the tenant, contrary to the approved requirement that owner-authorized operations always check both `tenantId` and `ownerUserId`.
- Fix required: make owner mandatory for owner-sensitive repository operations or fail closed when absent; add a test that omission cannot return or delete another owner's conversation.

## Architecture and security review

- Database-per-Service: Chat connections point to configured `tt_chat_db`; code does not select Tenant or Document Service databases. No production connection, source database deletion, or cutover was attempted.
- Isolation: message, citation, feedback, conversation-list and normal service operations carry tenant/owner scope. The optional conversation owner parameter is the finding above. Feedback's parent validation includes tenant, owner, and assistant role, but does not prevent the delete race.
- Mongo lifecycle: FastAPI lifespan initializes/pings and closes the async Mongo client. Request UoW is a yield dependency and closes its session. Session start/commit/rollback are wired to the UoW. Chat starts persistence transaction after RAG completion and rechecks existing conversation ownership before writes. No silent database-unavailable success fallback was found.
- Feedback: natural key and unique index are tenant/message/user scoped (plus owner in the filter), update fields use `$set`, insert-only fields use `$setOnInsert`, and duplicate-key/transient transaction retry paths preserve an existing ID. These do not resolve the delete race.
- Citation snapshots: stored with message scope in the same UoW transaction, hydrated with tenant/owner filters, and removed by cascade. The inspected path is consistent absent the concurrent feedback issue.
- Cursor: v2 uses `(createdAt, _id)` and message history uses the same ascending order; BSON datetimes are normalized to millisecond precision. Legacy timestamp-only cursor support remains inherently ambiguous for tied timestamps as documented. The chat message timestamp regression can still undermine expected role order.
- Index migration: six collection/index definitions use `create_index`; named index creation is idempotent. Deployment must run the documented migration script before serving traffic because lifespan does not itself create indexes.
- PostgreSQL: no SQLAlchemy, asyncpg, psycopg, PostgreSQL URL, or SQLite runtime fallback remains in Chat app/scripts/dependency configuration. PostgreSQL production data is unverified and untouched; production cutover/source deletion remains gated.

## API, RAG, and Ruff cleanup review

- API route decorators and response models are unchanged relative to `a8d548f`. FastAPI `Depends` objects were hoisted to module scope to address B008 while retaining dependency callables/defaults. Optional annotations use equivalent `T | None` forms. No route or DTO contract change was found in the inspected diff.
- RAG, Retrieval, Evidence Gate, Citation Validator, and evaluation edits are predominantly typing/import modernization and Ruff simplifications. The inspected boolean simplifications preserve the original predicates. No prompt, retrieval policy, evidence threshold, citation decision, authentication, or authorization behavior change was identified. Import ordering changes do not create an apparent cycle in inspected imports.
- Existing tests were not weakened in the inspected diff. The former PostgreSQL repository test was removed as part of the approved backend replacement and replaced by real Mongo repository tests. The report describes additions for concurrent feedback upsert, index idempotency, and cascade; it does not cover the feedback-versus-delete race found here.
- Diff classification:
  - **A — MongoDB migration:** Mongo lifecycle/config, UoW and DI, Mongo repositories/index script/test harness, SQLAlchemy/PostgreSQL/Alembic deletions and dependency/lock changes, database docs/container setup, persistence integration tests, cursor support.
  - **B — Approved Ruff cleanup:** typing/import changes across `app/ai`, `app/api`, `app/core`, `app/domain`, `app/evaluation`, `app/integrations`, `app/observability`, `app/providers`, `app/schemas`, `app/services`, and tests. Full Ruff currently reports zero findings; no Ruff suppression/config change was found.
  - **C — Out-of-scope/unexplained:** no additional intentional application feature change identified. `.env.example` differs from `main` by retaining Gemini provider settings that were already present in the working tree, while replacing the database settings. Those Gemini values were not edited during this review and must remain protected; confirm staging does not accidentally omit or overwrite the existing user configuration.

## Diff coverage and files reviewed

Compared `a8d548f → working tree` and `main → working tree`, including untracked migration files. The current worktree is still on `feat/chat-persistence`, HEAD is the stated baseline, and contains roughly 93 changed tracked paths plus the following 10 untracked Chat migration files:

- `services/chat-service/app/core/pagination.py`
- `services/chat-service/app/repositories/mongodb/__init__.py`
- `services/chat-service/app/repositories/mongodb/conversation_repository.py`
- `services/chat-service/app/repositories/mongodb/feedback_repository.py`
- `services/chat-service/app/repositories/mongodb/message_repository.py`
- `services/chat-service/scripts/mongodb_migrate.py`
- `services/chat-service/tests/integration/mongo-init.js`
- `services/chat-service/tests/integration/mongo-replica-set.compose.yaml`
- `services/chat-service/tests/integration/test_mongodb_repository.py`
- `services/chat-service/tests/unit/test_pagination.py`

Reviewed the changed files across `app/ai/**`, `app/api/**`, `app/core/**`, `app/domain/**`, `app/evaluation/**`, `app/integrations/**`, `app/observability/**`, `app/providers/**`, `app/repositories/**`, `app/schemas/**`, `app/services/**`, `scripts/**`, `tests/**`, plus `.env.example`, `Dockerfile`, `README.md`, `pyproject.toml`, `uv.lock`, and removed PostgreSQL/Alembic artifacts. Root-level unrelated untracked files were left untouched. `.env.example` still contains the Gemini API-compatible endpoint/model placeholders and Mongo settings; no credentials were added.

## Verification evidence

| Check | Review result |
|---|---|
| `uv run --extra dev ruff check app scripts tests` | **PASS** — independently rerun with a temporary `UV_CACHE_DIR`: all checks passed |
| `python -m compileall -q app scripts tests` | **PASS** — independently rerun |
| `git diff --check` | **PASS** — independently rerun |
| Full pytest | Prior Test report records **197 passed, 0 failures/errors/skips/xfails**; not rerun during this review |
| Mongo repository integration tests | Prior Test report records **9 passed** against real `rs0`; not rerun during this review |
| Current Docker replica-set availability | **BLOCKED** — `docker compose ... ps` returned permission denied for `npipe:////./pipe/dockerDesktopLinuxEngine`; no current topology verification was possible |

The Test Report at `docs/reports/2026-11-17/2026-11-17-chat-mongodb-test.md` still says full Ruff failed with 368 findings and marks Test PARTIAL. That conflicts with the newer user-supplied Cook/Test status and this independently rerun Ruff PASS. The Test Report itself was not edited as it is outside the requested review artifact scope; reconcile it in the next authorized workflow step.

## Risks and conditions before commit

1. Fix both High findings and add real-replica-set regression coverage for ordering and feedback/delete concurrency.
2. Resolve the HTTP client cleanup risk and make conversation owner scope fail closed.
3. Run the full suite and Mongo integration tests on a reachable `rs0` after fixes; this review session could not access Docker.
4. Reconcile the stale Test Report with the confirmed full Ruff PASS before using it as durable handoff evidence.
5. Keep production PostgreSQL data inventory/cutover as a separate explicit data-owner gate. No production data was reviewed or altered here.

## Handoff

Verdict is **REQUEST CHANGES**; do not commit or update PR #8 yet. Return to the authorized `$cook` stage for the four findings, then rerun `$test` on a real MongoDB replica set. Request `$review` again after the fixes and updated evidence. No implementation files, branch history, PR state, or unrelated user files were changed by this review.
