# Chat MongoDB Migration — Test Report

- Date: 2026-11-17
- Branch: `feat/chat-persistence`
- Base used for lint comparison: `a8d548f`
- Scope: stabilize the Chat Service persistence migration and verify its approved acceptance criteria. No commit, push, merge, production database access, or cutover was performed.
- Overall status: **PASS on the current review-fix diff** — full pytest 212 passed with 0 failed/errors/skipped; all checks below ran against a real `rs0` replica set. The earlier 197-test result was from the pre-review-fix diff.

## Environment and diagnosis

- Windows 11 host, Python 3.13.7, pytest 8.4.2, pytest-asyncio 0.26.0, Ruff 0.17.1, PyMongo 4.20.0.
- Pytest configuration: `asyncio_mode = "auto"`; `asyncio_default_fixture_loop_scope = None`; `asyncio_default_test_loop_scope = function`.
- The async-test hang was reproduced inside the restricted sandbox for both Proactor and Selector policies. Faulthandler showed the main thread blocked in `socket.accept()` from `socket._fallback_socketpair()` → `asyncio.proactor_events._make_self_pipe()` → `ProactorEventLoop.__init__` → `asyncio.new_event_loop()`, before pytest test code ran. This is the sandbox's loopback socket restriction, not an application event-loop leak. Tests then ran on the Windows host with loopback access; no policy monkeypatch or production workaround was added.
- Docker Desktop's existing Linux engine was reachable with elevated host access. The repository compose harness advertised `localhost:27018`; MongoDB `rs0` reported `localhost:27018` as `PRIMARY`. Host Python verified `setName=rs0`, `isWritablePrimary=true`, and the advertised hostname.

## Defects fixed

1. `AsyncClientSession.start_transaction()` is asynchronous in PyMongo Async. The Unit of Work called it without `await`, so writes ran outside a transaction and commit/rollback failed with “No transaction started”; Python also warned that the coroutine was never awaited. It now awaits transaction start.
2. ChatService unit tests constructed the service without its required UoW and did not verify that a failed RAG pipeline leaves the transaction unopened. Test setup now provides the UoW and asserts the short transaction boundary.
3. Two API tests used the application database dependency without the isolated Mongo test UoW override. They now use the replica-set fixture.
4. An API fixture gave two messages the same timestamp while expecting a particular role ordering. The fixture now expresses the intended chronology with distinct timestamps; deterministic `_id` tie-breaking remains covered by equal-timestamp repository pagination tests.
5. Added real-replica-set checks for concurrent feedback upsert and repeatable index creation. Cascade deletion now verifies citation snapshot removal as well as message and feedback cleanup.

## Results

| Command/check | Result |
|---|---|
| `uv run --extra dev python -m pytest -q -ra` with `MONGODB_TEST_URI=mongodb://localhost:27018/?replicaSet=rs0` | **PASS** — 197 passed, 0 failed, 0 errors, 0 skipped, 0 xfailed |
| `uv run --extra dev python -m pytest tests/integration/test_mongodb_repository.py -q -ra` against real `rs0` | **PASS** — 9 passed |
| Scoped Ruff on cursor, Mongo repositories, migration script, repository integration tests and cursor unit tests | **PASS** — All checks passed |
| `uv run --extra dev ruff check app scripts tests` | **PASS** — 0 findings after the authorized Ruff cleanup; independently rechecked during Review |
| Same Ruff 0.17.1 check against baseline `a8d548f`, with the Chat Service Ruff configuration | Baseline had 469 findings; current implementation diff passed with 0 findings |
| `python -m compileall -q app scripts tests` | **PASS** |
| `git diff --check` | **PASS** |
| Dependency/runtime search for SQLAlchemy, asyncpg, psycopg, SQLite fallback, old `DATABASE_URL` and Alembic | **PASS** — no runtime dependencies or fallback remain; one explanatory comment mentions SQLite |

The earlier 368-finding Ruff result in this report was superseded by the authorized Ruff cleanup and is not the current lint status. No Ruff rule was disabled. Full Ruff passed with zero findings on the pre-review implementation diff.

## Acceptance matrix

| Area | Status | Evidence |
|---|---|---|
| Conversation CRUD and owner/tenant scoping | PASS | Real Mongo conversation CRUD/isolation test; API regression suite |
| Message persistence, deterministic ordering and BSON datetime precision | PASS | Real Mongo history/citation/cursor test; BSON timestamps normalized to millisecond precision |
| Citation snapshot serialization, hydration and deletion | PASS | Real Mongo citation round-trip, rollback and cascade assertions |
| Feedback idempotence, stable ID, tenant/owner isolation and concurrent writes | PASS | Sequential and concurrent real Mongo upsert tests assert one row and preserved ID |
| Cursor v2, legacy timestamp cursor and equal-timestamp pagination | PASS | Cursor unit tests plus equal-time real Mongo ordering/pagination; API next-cursor regression |
| Transaction commit/rollback and short ChatService transaction boundary | PASS | Replica-set commit/rollback tests and ChatService pipeline-failure assertion that `begin()` was not awaited |
| Mongo connection failure/no fallback | PASS | Real PyMongo server-selection failure test; source/dependency audit |
| Index/migration idempotency | PASS | `ensure_indexes()` run twice and all six collection index definitions verified on real Mongo |
| Chat API, authentication fixtures, ChatService, RAG, Evidence Gate/Citation Validator, contract/evaluation | PASS | Full pytest suite: 197 passed |
| Full Ruff quality gate | PASS on pre-review implementation diff | Full check passed with zero findings; not a check of the newer Cook review-fix diff |
| Production PostgreSQL data disposition/cutover | NOT RUN | No production connection, inventory, backfill, source DB deletion, or cutover attempted; remains a separate data-owner gate |

## Regression and coverage notes

- Before the fixes, the Mongo-backed full suite had 192 passes and 3 API-test failures. The repository-focused run also reproduced transaction failures caused by the un-awaited `start_transaction()` coroutine. After fixes, the final complete suite passes with 197 tests.
- The six integration tests previously skipped without `MONGODB_TEST_URI` were run against the real replica set; all final replica-set tests passed.
- The sandbox event-loop hang happens before test execution. Elevated host execution avoids the sandbox loopback restriction and completed the suite without hangs or leaked-resource warnings.
- No tests, assertions, pytest markers, or Ruff rules were weakened or suppressed.

## Remaining blocker and handoff

The prior Test stage passed on its tested diff, including the full Ruff gate. The later Review found correctness issues, and subsequent Cook changes require fresh full-suite and real-replica-set verification before the migration can be accepted. No production data migration/cutover was attempted.

No commit or remote action was made. PR #8 remains unmerged.

## Review-fix Cook verification — 2026-11-17

This was the intermediate Cook check and is superseded by the completed Test-stage verification below. The intermediate full suite had 28 Mongo skips because Docker was unavailable in that execution context.

| Command/check against the current Cook diff | Result |
|---|---|
| `uv run --extra dev python -m pytest tests/unit/test_chat_lifecycle.py tests/unit/test_chat_service.py -q -ra` | **PASS** — 40 passed |
| `uv run --extra dev python -m pytest -q -ra` | **PARTIAL** — 183 passed, 28 skipped, 0 failed/errors. All Mongo-backed API/repository cases skipped because `MONGODB_TEST_URI` is unset. |
| `uv run --extra dev ruff check app scripts tests` | **PASS** — 0 findings |
| `python -m compileall -q app scripts tests` | **PASS** |
| `git diff --check` | **PASS** |
| `docker info` and Compose replica-set status | **BLOCKED** — Docker CLI reports that `npipe:////./pipe/dockerDesktopLinuxEngine` does not exist, including when queried outside the sandbox. `MONGODB_TEST_URI` is not configured. |

That intermediate run collected the new deterministic tests but skipped them because Docker was unavailable in that execution context. The following Test-stage run supersedes that result and executed the cases against real `rs0`.

## Test — Review-fix verification — 2026-11-17

- Branch: `feat/chat-persistence`; tested the current uncommitted worktree. No application source changes were made during this Test stage. The integration test was tightened to count only actual new transaction starts and verify the parent fence counter; those assertions were rerun against real `rs0`. This report and the handoff were updated.
- Environment: Windows host, Python 3.13.7, pytest 8.4.2, pytest-asyncio 0.26.0, Docker Desktop Linux engine 29.7.2, MongoDB 8.0 single-node `rs0`. The sandbox's Docker named pipe returned `permission denied`; read-only Docker checks outside the sandbox succeeded. The Compose harness was started as the repository's disposable test container (localhost-only port, no persistent data volume).
- Replica-set verification: `docker compose ... up -d --wait` — PASS, container healthy. `mongo-init.js` was run idempotently. `rs.status()` reported `localhost:27018` as `PRIMARY`. Windows-host PyMongo Async handshake reported `setName=rs0`, `isWritablePrimary=true`, and `hosts=['localhost:27018']`. All pytest invocations set `MONGODB_TEST_URI=mongodb://localhost:27018/?replicaSet=rs0`.

| Command/check | Result |
|---|---|
| Focused feedback/delete, rollback and owner integration selection (`pytest tests/integration/test_mongodb_repository.py -k 'feedback_wins_race or hard_delete_wins_race or feedback_upsert_is_idempotent or hard_delete_failure or conversation_repository_requires' -vv -ra`) | **PASS** — 9 passed, 10 deselected. Ran against the real `rs0`. |
| Commit/cascade failure selection (`pytest tests/integration/test_mongodb_repository.py -k 'hard_delete_commit_failure or hard_delete_failure' -vv -ra`) | **PASS** — 2 passed, 18 deselected. Forced commit failure triggered abort; all original aggregate records remained. |
| `uv run --extra dev python -m pytest -vv -ra` | **PASS** — 212 passed, 0 failed, 0 errors, 0 skipped. All tests ran with `MONGODB_TEST_URI` set. |
| `uv run --extra dev ruff check app scripts tests` | **PASS** — 0 findings |
| `python -m compileall -q app scripts tests` | **PASS** |
| `git diff --check` | **PASS** — exit 0; Git emitted only existing LF→CRLF working-tree notices |

### Review finding acceptance matrix

| Finding | Status | Evidence |
|---|---|---|
| 1. User-before-assistant ordering; BSON millisecond precision; cursor v2 pagination and tied timestamps | PASS | Real Mongo `test_fast_chat_persists_user_before_assistant_with_bson_cursor_pagination` persisted with a fast pipeline and fixed same-millisecond clock, then paged the stored user and assistant messages in order. `test_message_order_citations_and_cursor_pagination` also exercises tied timestamps and ID tie-break sorting. |
| 2. Feedback/hard-delete race, write-conflict retry, commit rollback, and child cleanup | PASS | Three deterministic feedback-first/delete-first repetitions with independent UoW sessions passed. Tests assert a new transaction begins after conflict, confirm `feedbackFence` increments on the parent, and check zero conversation/message/feedback/citation rows after deletion. Injected cascade and commit failures rolled back all writes. |
| 3. Request-owned resource cleanup; shared resource remains open | PASS | Unit tests verify dependency cleanup on success and exception, owned pipeline closes once, and explicitly shared pipeline is not closed. Full suite also passes Retrieval HTTP client lifecycle/pool tests. |
| 4. Fail-closed tenant/owner repository scope | PASS | Real Mongo integration rejects omitted/empty scope, wrong owner, and cross-tenant reads/deletes; original owner's record remains. |

The race tests exercise both commit orderings. Feedback-first permits feedback to commit, then the hard-delete transaction encounters a parent-document write conflict, retries, and removes all aggregate records. Delete-first holds the parent deletion in one transaction while a second ClientSession attempts the feedback fence; the feedback operation conflicts/retries and is rejected after observing the missing assistant message/active parent. The forced commit failure aborts the entire cascade. No `conversation=0, message=0, feedback=1` state or citation snapshot orphan was observed.

No production database was accessed. No SQLite/mongomock substitute, skip, xfail, assertion weakening, or suppression was used. No commit, push, or merge was performed. The disposable `rs0` Compose service remains available for the next review stage.
