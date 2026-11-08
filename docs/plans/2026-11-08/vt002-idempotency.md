# VT-002 implementation plan

- Task ID: 2026-11-08-vt002
- Status: AUTHORIZED SCOPE by the user's explicit end-to-end assignment request, 2026-11-08. Routine implementation choices reviewed by Codex; not a claim of separate human plan approval.
- Baseline: 8aaceec1c4d4958e69536c622ad78dc58825ad29 (fresh fetch)
- Branch: bt3/23001928-vt002-idempotency

## 1. Objective and background
Allow resending the same logical Chat request without duplicate stored results.
Execute Spec -> Test -> AI-assisted Change -> Verify -> Review and deliver LaTeX plus runnable evidence.

## 2. Scope and non-goals
Small dependency-free Python coordinator near the actual Chat service. An executable request/response harness supplies a fake RAG operation and atomic in-memory repository. Do NOT wire unauthenticated demo headers into a new production endpoint, modify auth, or claim database/production correctness. No paid API, schema migration, deployment or merge.

## 3. Current-state findings (Scout)
- Verified: `app/api/controllers/chat_controller.py` creates a fresh message UUID per call; X-Request-Id is tracing, not idempotency.
- Verified: `app/repositories/postgres/message_repository.py` has only a constructor, while the interface requires get/list/save.
- Verified: `app/schemas/chat/request.py` limits question length to 1..4000 inclusive and includes conversation_id/include_personal_docs.
- Verified: Tenant quota already deduplicates requestId in MongoDB; this is a different service/contract, not a complete Chat replay solution.
- Verified: Chat is Python/FastAPI; Node workspace tests do not exercise this slice.
- Unknown: real Chat DB transaction, unique index, authenticated integration, provider side-effect guarantees.
- Repository AGENTS has stale stack descriptions. Live source takes precedence. Full-cycle user request takes precedence over per-stage stopping defaults.

## 4. Proposed design (Brainstorm and plan review)
Initial candidate A: reuse Node QuotaService as the Chat guard. REJECTED: Mongo quota ownership cannot replay a Python Chat response; evidence above.
Initial candidate B: use X-Request-Id and random IDs for dedupe. REVISED: explicit key separate from tracing, scoped to tenant/user/course; payload hash includes ALL three request schema fields.
Choose coordinator + injected repository/operation. Single-process pending tasks coalesce; repository insert_once protects committed result. It does not prove one provider call across processes/crashes. No wall-clock expiry in this slice.

## 5. Files and components affected
- `services/chat-service/app/services/idempotency.py`: new pure-stdlib coordinator; red minimal implementation, then patch.
- `experiments/vt002/{test_idempotency.py,support.py,pairwise.py,run.py,load.py,README.md,ai-draft-tests.txt}`.
- `experiments/vt002/evidence/`: captured subprocess logs and JSON.
- Reports/handoff and final LaTeX report. No existing endpoint or database changes.

## 6. Ordered implementation tasks
T1: define spec, pairwise factors and AI draft review (this plan + README).
T2: write tests and naive executable baseline; capture RED caused by duplicate IDs/operations, not import errors; commit.
T3: patch coordinator; inspect diff; capture GREEN; commit.
T4: mutate `len(question) > MAX_QUESTION_LENGTH` to `>=` in a separate temporary branch/worktree, commit and prove test kill. Shipping source stays `>`.
T5: measure line/branch coverage if tool available; replay suite in five deterministic shuffled orders; 200 simultaneous callers in unique/replay workloads.
T6: review, traceability, reflection, LaTeX and README; commit and attempt to publish the authorized new branch only, no merge.
One agent owns all files; no parallel integration.

## 7. Dependencies and prerequisites
Python 3.11+ standard library for all functional tests and load. Optional coverage.py is isolated test tooling, not a runtime dependency. Network/credentials needed only for fetch/push and optional tool download.

## 8. Testing and verification strategy
AC1 -> T01-T08 pairwise replay; T17 cross-coordinator; T19 concurrency.
AC2 -> T09/T10 fingerprint conflicts.
AC3 -> T11 tenant/user/course isolation.
AC4 -> T12-T14 invalid input and exact length boundary.
AC5 -> T15 failure before commit; T16 lost response; T18 waiter cancellation; T20 output mutation isolation.
Each unit test owns fresh fixtures. Harness API facade is in-process, not actual FastAPI or browser E2E. Full browser E2E and real DB integration are deferred explicitly.

## 9. Risks and mitigations
Flaky time: no wall-clock business rule or sleeps; event barriers control schedules. Flaky network: no sockets/external providers in gating tests. Order/shared state: per-test store, isolated event loops, five shuffled orders. Concurrency: deterministic pending-work gate; load uses asyncio.sleep(0) solely to yield, not a timing assertion.
No guarantee of exactly-once remote billing, process-crash durability, or production SLO.

## 10. Acceptance criteria
AC1 same scope/key/payload -> identical result and one committed row, sequential/concurrent.
AC2 same scope/key but different semantic payload -> 409 without another committed row.
AC3 same key in a different tenant/user/course -> independent operation.
AC4 key valid nonempty safe ASCII <=64; question length 1..4000 inclusive; invalid input ->400, no work.
AC5 failure before commit leaves no row; later retry succeeds; lost response after commit replays saved result.
NFC1 200 synchronized callers; observed p95 <=5.0s is compared for the simulated workload only.
NFC2 deterministic, offline, order-independent tests; deep-copied snapshots prevent caller mutation.

## 11. Rollback or recovery
All changes additive in a dedicated branch. Do not merge. A reviewer can omit the coordinator and experiment directory without reverting existing service code. The mutation lives only in its own temporary branch.

## 12. Completion checklist
To be filled by final test/review report. Not a claim of human review or production readiness.
