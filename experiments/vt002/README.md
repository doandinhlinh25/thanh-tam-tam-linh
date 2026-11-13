# BT3 — 23001928 — VT-002

Nguyễn Duy Tâm, SE2026-T01, AI-01. This is an **offline executable harness**,
not a deployed Chat endpoint. No production service, auth policy or DB changed.

## Reproduce (Python 3.11+, standard library)

From the repository root, on branch `bt3/23001928-vt002-idempotency`:

```powershell
python experiments/vt002/run.py --phase green
python experiments/vt002/pairwise.py
python experiments/vt002/verify.py
python experiments/vt002/load.py
```

`verify.py` shuffles test order using seeds 0..4. If `coverage` is installed,
it also measures **only** `services/chat-service/app/services/idempotency.py`:

```powershell
python -m pip install coverage==7.13.1
python experiments/vt002/verify.py
```

For this recorded run coverage was installed outside the repo at
`D:\SE-BTTL\bt3-test-tools`, exposed through PYTHONPATH. No runtime dependency
was added. Python 3.13.7, Windows, one asyncio event loop. The Codex sandbox
stalled on a minimal asyncio example, so recorded asyncio runs were executed
outside that sandbox. No sockets, LLM calls or DB server are used.

## Spec and scope

- AC1: same (tenant, user, course, key) + normalized semantic payload returns
  the same detached response, with one committed row. In-process requests coalesce.
- AC2: same scoped key + different semantic payload -> 409, no extra committed row.
- AC3: tenant, user and course each isolate the same key.
- AC4: key is safe ASCII, 1..64; question is 1..4000 inclusive. Invalid input ->400.
- AC5: a pre-commit failure leaves no row and may be retried. A lost response
  after commit is replayed even through a new coordinator using the same store.
- NFC: offline/order-independent tests; test 200 synchronized callers against
  the 5.0s p95 target **for the simulated workload only**.

Invariants: one committed result per scoped key, stable fingerprint binding,
and no caller mutation of another result snapshot. Fields hashed are question,
conversation_id and include_personal_docs, with explicit defaults normalized.

## Commits and evidence

- Baseline: `8aaceec1c4d4958e69536c622ad78dc58825ad29`.
- RED: `d51ebc03bd747a35a428dc40cf6d491541fcdcbf`, naive new harness scaffold,
  **not** a claim that the baseline production test suite failed.
- GREEN code: `1f4fc75c153864d4bec4e544c65761133b4b306a`.
- Temporary mutation: `5aec9fc` on local `bt3/23001928-vt002-mutation`.
  This commit is not an ancestor of the submission branch. Patch is preserved
  as `evidence/mutation.diff`; captured output is `evidence/mutation.log`.
- Final suite adds T21 after coverage found pending-conflict behavior untested.

`evidence/red.log`: 20 methods, 27 assertion failures and 2 invalid-payload
errors (subtests explain why the failure count exceeds method count).
`green.log`: final 21 methods pass. `mutation.log`: the 20-method code-commit
suite fails with 6 assertion/subtest failures across 5 methods, including T13
length=4000. `coverage.json`: final 57/57 statements and 18/18 branch exits.
`order-*.log`: 5 independent shuffled suites; `load.json`: 200 per-request
latencies in each workload, nearest-rank p95 (sorted index 189).

## Reproduce RED/mutation without touching submission files

Use distinct scratch worktrees (run once with unused directory names):

```powershell
git worktree add ../vt002-red-repro d51ebc03bd747a35a428dc40cf6d491541fcdcbf
cd ../vt002-red-repro
python experiments/vt002/run.py --phase red
```

For mutation, create a scratch worktree at `1f4fc75`, then apply the shipped diff:

```powershell
git worktree add ../vt002-mutation-repro 1f4fc75c153864d4bec4e544c65761133b4b306a
```

In that scratch worktree run `git apply <absolute-path-to-submission>/experiments/vt002/evidence/mutation.diff`,
then `python experiments/vt002/run.py --phase mutation`. This wrapper returns
success only when a failing assertion was actually detected; the captured child
unittest exit code is 1. Never apply the mutation to the submission branch.

## Test design and limits

T01..T08 form a verified strength-2, 8-row design over tenant A/B, question
length 1/4000, sequential/concurrent and personal-docs false/true. All 24
factor/value pairs are covered; no exhaustive or 3/4-way claim is made.
T09..T21 add conflicts, scope boundaries, invalid input, transient failure,
lost response, cross-coordinator write protection, cancellation, 200 retries,
snapshot isolation and pending conflict. See test names and the LaTeX report.

Fixtures own fresh stores/event loops; Events control schedules, no wall-clock
sleep assertions. asyncio.sleep(0) is only a cooperative scheduling yield.
HarnessApi is an in-process API-shaped facade. Browser E2E, actual FastAPI
dependency/auth integration, PostgreSQL uniqueness/transaction, multi-process
crash recovery, load over HTTP and provider billing are NOT proven. Two
coordinators can compute twice while storing once; no exactly-once LLM billing
claim. The next valuable integration test is two processes against the real
transactional DB with a crash between message write and idempotency commit.

The group must review this branch before merge. AI generated the draft plan,
code and tests; weak status-only and duplicate happy-path tests were revised
as recorded in `ai-draft-tests.txt`.

## Report

`report/main.tex` is the editable LaTeX source; use XeLaTeX on Overleaf to match
the verified layout. `report/BT3_23001928_VT-002.pdf` was compiled locally:
8 main pages plus 2 appendix pages (AI Usage Log and execution excerpts).
All 10 pages were rendered and visually checked; no content overfull-box or
missing-character warnings remain. The reflection has 310 whitespace-separated
Vietnamese words. `evidence/report-validation.json` records file hashes and
scope; the report is an AI-assisted draft for the student's final review.
Pre-submission PDF review on 2026-11-13 clarified the pseudocode excerpt and
planned E2E case E01 (not run and not counted among the 21 executed tests).
Recorded functional and load measurements remain from 2026-11-08.
