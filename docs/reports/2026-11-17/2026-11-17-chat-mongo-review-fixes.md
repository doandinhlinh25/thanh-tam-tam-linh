# Chat MongoDB Migration Re-review

- Date: 2026-11-17
- Branch: `feat/chat-persistence`
- HEAD: `a8d548fa1d6b3bb603e151d2215f53daf7436d2f`; merge base with `main`: `8aaceec1c4d4958e69536c622ad78dc58825ad29`
- Plan: `docs/plans/2026-11-16/chat-persistence-mongodb.md`
- Previous Review: `docs/reports/2026-11-17/2026-11-17-chat-mongo-review.md`
- Test evidence: `docs/reports/2026-11-17/2026-11-17-chat-mongodb-test.md`
- Verdict: **APPROVE**
- Scope: independent re-review of `a8d548f → working tree` and `main → working tree`, including tracked changes and migration-related untracked files. No application code was changed in Review; no commit, push, merge, production connection, or production data operation was performed.

## Summary

The four findings from the prior Review are resolved in source and backed by regression tests. Feedback upsert and hard-delete both write the same scoped conversation document inside their respective transactions, producing the serialization point needed to prevent an orphan. Transaction retries start a fresh transaction after rollback. The current tests inspect final collection state as well as conflict/retry evidence.

The MongoDB migration follows the approved database-per-service boundary and keeps the existing string IDs, routes, DTOs and RAG flow. The broad Ruff cleanup consists of equivalent typing/import changes and the approved boolean simplification. I found no new Critical or High defect, API/RAG regression, weakened assertion, suppression, or unintended application change.

## Findings

### Resolved findings from the prior Review

| Prior finding | Status | Source and test evidence |
|---|---|---|
| High — message history could put assistant before user | **RESOLVED** | `services/chat-service/app/services/chat_service.py` captures the user timestamp before Retrieval/LLM, truncates to BSON millisecond precision, and assigns assistant time at least one millisecond later. `MongoMessageRepository` sorts by `(createdAt, _id)`. `test_fast_chat_persists_user_before_assistant_with_bson_cursor_pagination` reads records back from Mongo and checks role order, timestamp precision and page continuity; tied timestamp ordering and cursor compatibility are covered by repository and pagination tests. |
| High — concurrent feedback and hard-delete could leave orphan feedback | **RESOLVED** | `MongoFeedbackRepository.save` verifies the scoped assistant message and increments the active conversation's `feedbackFence` in the same transaction as the feedback upsert. Hard-delete removes feedback, citation snapshots and messages, then deletes that same scoped conversation in one transaction. `ConversationService.delete_conversation` and feedback save retry the whole operation after a transient transaction error, after rollback. Deterministic two-UoW tests cover both commit orderings, assert a new transaction starts after conflict, inspect `feedbackFence`, and assert final collection counts; injected cascade and commit failures assert all original documents remain. |
| Medium — ChatService request-owned HTTP resources leaked | **RESOLVED** | `get_chat_service` is a yield dependency with `finally` cleanup. `ChatService` closes a pipeline it created, only once; an injected shared pipeline remains caller-owned unless ownership is explicit. Lifecycle tests cover successful and exceptional dependency teardown and owned/shared pipeline behavior. |
| Medium — owner scope could be omitted | **RESOLVED** | `MongoConversationRepository.get_by_id` and `delete` require tenant and owner and reject empty values; filters include both. Service/API call sites pass authenticated tenant/user context. Integration tests cover omitted/empty values, wrong owner, and cross-tenant get/delete while checking the owner record remains. |

No new findings.

## Correctness, security and architecture

- **Transaction boundary:** `ChatService.answer_question` completes the pipeline before `uow.begin()`, then rechecks existing conversation ownership inside the write transaction before storing conversation, messages and snapshots.
- **Feedback/delete serialization:** the feedback transaction's conditional `$inc` to the active, tenant/owner-scoped parent is a write, not a read-only check. Hard-delete writes/deletes that same parent. The two transactions therefore conflict on the aggregate parent; tests verify both orderings and actual retry starts. Retry paths roll back and call `begin()` again rather than continuing an aborted transaction.
- **Cascade and rollback:** hard-delete performs feedback, citation snapshot, message and conversation deletion under one session/transaction. Both an injected cascade failure and a commit failure leave the aggregate's records intact. Final-state assertions cover zero conversation/message/feedback/citation rows after successful deletion.
- **Tenant and owner scope:** feedback verifies the assistant message using `_id`, `tenantId`, `ownerUserId`, and assistant role, then checks the active parent with tenant and owner before upsert. Message reads and snapshot hydration are tenant/owner scoped. Conversation service calls pass authenticated owner parameters. No repository filter silently drops `ownerUserId` when absent.
- **Cursor/order:** v2 cursor encodes normalized UTC `(createdAt, _id)` and the repository applies the matching lexicographic predicate and sort. BSON dates and user/assistant timestamps are normalized to milliseconds. Legacy timestamp-only input remains accepted with the documented tied-timestamp ambiguity; v2 pagination across equal timestamps is deterministic.
- **Persistence and failure handling:** process-scoped `AsyncMongoClient` is initialized/pinged in FastAPI lifespan and closed there; request sessions are ended by the UoW dependency. Connection failures propagate; no SQLite/PostgreSQL fallback or persistence-less successful response was found.
- **Collections/indexes:** idempotent bootstrap creates the six planned collections and named indexes. Feedback has a unique tenant/message/user natural-key index; message history and conversation page indexes include owner/tenant and cursor sort fields. `model_usage` and `outbox_events` are prepared without adding unrequested domain writers.
- **Service boundary:** runtime code targets only configured `tt_chat_db`; no Tenant or Document database access was found. Production PostgreSQL data and cutover were not accessed.
- **API/Auth/RAG:** route decorators and response models are unchanged from baseline. `Depends` values are hoisted to module constants for Ruff B008; dependency callables and caching semantics remain the same. `Optional`/`Union` and collection annotations are equivalent under the supported Python 3.11+ runtime. No prompt, retrieval policy, Evidence Gate threshold, Citation Validator decision, or authorization policy change was identified. Existing header-based identity behavior is unchanged.
- **Dependencies:** `pyproject.toml` and `uv.lock` remove SQLAlchemy/Alembic/asyncpg/psycopg runtime dependencies and include PyMongo. Search of Chat Service app/scripts/dependency files found no PostgreSQL runtime or SQLite fallback; the sole SQLite/PostgreSQL mention is explanatory documentation/commentary.

## Test evidence

The latest Test Report is for the current source/test tree and records the full suite against real MongoDB `rs0`: **212 passed, 0 failed, 0 errors, 0 skipped**. It records a Windows-host PyMongo handshake with `setName=rs0`, `isWritablePrimary=true`, and `localhost:27018` advertised, plus deterministic race, lifecycle, ordering, owner-scope and rollback results. Review inspection confirmed the tests and final-state assertions are present.

Review independently reran:

- `ruff check app scripts tests` — PASS, 0 findings.
- `python -m compileall -q app scripts tests` — PASS.
- `git diff --check` — PASS (Git emitted only existing LF→CRLF working-tree notices).

A focused pytest rerun was attempted with `MONGODB_TEST_URI=mongodb://localhost:27018/?replicaSet=rs0`. `uv` initially could not write its default interpreter cache in the sandbox; using a temporary cache allowed collection of 63 tests, but execution stalled on the first replica-set handshake because sandboxed localhost access was unavailable. This does not replace or contradict the completed Test-stage run; no current source changes occurred after that run. The independent Review therefore relies on the latest Test Report's completed real-rs0 execution for runtime integration evidence.

## Diff scope audit

Compared `a8d548f → working tree` and `main → working tree`. The worktree contains 92 tracked file changes (including PostgreSQL/Alembic removal and broad Ruff cleanup) and 11 new Chat Service source/test/harness files, as well as workflow documents. No unrelated user untracked files were modified.

- **A — MongoDB migration:** configuration/lifespan/UoW, repositories, cursor helpers, index script and replica-set harness; PostgreSQL repository/model/migration removal; PyMongo dependency/lock, Docker and README updates; Mongo/API integration coverage.
- **B — Review-finding fixes:** timestamp ordering, aggregate `feedbackFence` and bounded transaction retries, request pipeline cleanup/ownership, required conversation owner scope, and focused regression tests.
- **C — Approved Ruff cleanup:** typing syntax modernization, import ordering/export ordering, FastAPI `Depends` hoisting, and a boolean simplification equivalent to the original branches. Full Ruff reports zero findings; no Ruff rule/config change or suppression was found.
- **D — Unrelated/unexpected:** none identified in application changes. `.env.example` retains the pre-existing Gemini configuration recorded by the Plan/Handoff while replacing its database block. Other unrelated untracked artifacts were left untouched.

The PostgreSQL repository test was removed as part of replacing that persistence implementation; the MongoDB repository integration suite is present. No test was skipped/xfail-added, and no assertion was weakened to make a result pass.

## Acceptance criteria

- [x] User message precedes assistant message after Mongo persistence; BSON millisecond precision and stable cursor-v2 pagination are tested.
- [x] Legacy timestamp-only cursors remain accepted with their tied-timestamp limitation documented.
- [x] Feedback and hard-delete serialize through the parent, retry safely, preserve tenant/owner scope, and leave no child orphans in tested races.
- [x] Cascade and commit failures roll back without partial writes.
- [x] Request-owned resources close on success and exception; shared pipelines remain open.
- [x] Owner-sensitive repository reads/deletes fail closed for absent or mismatched scope.
- [x] MongoDB-only persistence, six collections/index bootstrap, and no-fallback behavior are present.
- [x] Test Report records 212 passed / 0 failed / 0 errors / 0 skipped on real `rs0`; Review independently confirmed relevant code and tests.
- [x] Ruff, compileall and diff check pass.
- [x] No production database action, commit, push, or merge occurred.

## Remaining risks and pre-commit conditions

- The Review sandbox could not independently re-run MongoDB tests because localhost socket access stalled at handshake; the latest completed Test-stage run provides the runtime evidence. No additional test rerun is a condition for this approval, but preserve the Test Report and replica-set environment details for PR review.
- Production PostgreSQL retention status remains unknown. This branch changes Chat runtime source/dependencies only; do not delete the source database or cut production over until the separate inventory, verification and rollback gate is completed.
- The required index/bootstrap script must run successfully in the target environment before serving MongoDB traffic.
- Before commit, stage only migration/approved Ruff files and intended workflow artifacts; review the staged diff so unrelated untracked files and the preserved Gemini configuration are not accidentally included or overwritten.

## Final decision

**APPROVE** — no unresolved Critical or High issue and the approved migration acceptance criteria are supported by source, regression tests and the completed Test-stage evidence. No implementation file was modified during Review. Remain on `feat/chat-persistence`; wait for explicit commit/push authorization. PR #8 has not been merged.

## Next step

Review is complete. Await explicit approval for any commit or remote update; do not commit, push, or merge based solely on this verdict.
