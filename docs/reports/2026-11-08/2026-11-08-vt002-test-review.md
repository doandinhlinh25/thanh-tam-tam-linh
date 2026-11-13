# VT-002 test and self-review

## Scout / decision
Fresh fetched baseline `8aaceec1c4d4958e69536c622ad78dc58825ad29`.
Chat controller creates IDs on each call; PostgresMessageRepository does not
implement its abstract persistence methods. The bounded scope is a harness,
not deployment. See the plan for source locations and rejected Node/tracing plans.

## Test evidence
- RED d51ebc0: 20 methods; failures=27, errors=2; proper behavioral replay
  failures (different message IDs) are visible, not dependency/import failures.
- GREEN code 1f4fc75: 20/20; final suite after T21: 21/21.
- Mutation branch local commit 5aec9fc, parent 1f4fc75: `>` -> `>=` on question
  length. 20-method suite has six assertion/subtest failures across T03,T04,
  T07,T08,T13. Shipping source remains `>`.
- Final coverage: 57/57 lines, 18/18 branch exits for the coordinator only.
  Initially line 69 was missing; T21 was added because pending key conflict is
  a real risk, not merely to inflate the percentage.
- Five independent shuffled orders, seeds 0..4: final 21 tests pass each time.
- Load: 200 unique, peak callers 200/backend 200, 200 writes, p95 4.6169 ms;
  200 same-key, peak callers 200/backend 1, one write, p95 1.8964 ms.
  Fake RAG and in-memory repository; no production-SLO conclusion.
- No runtime dependency added. coverage.py 7.13.1 was isolated test tooling.

## Acceptance mapping
AC1 T01-T08/T17/T19 pass in harness; AC2 T09/T10/T21 pass;
AC3 T11 pass; AC4 T12-T14 pass; AC5 T15/T16 pass.
Flaky risks: wall time eliminated from business rule, event barriers replace
real sleeps; fresh fixtures isolate state, shuffled subprocess runs pass;
external network absent. Cancellation T18 and snapshot T20 pass.

## Review of actual patch
Reviewed source diff and fixtures: the lock only guards pending registration,
not backend execution. Full semantic payload gets a canonical hash; strict
scope keeps tenant/user/course independent; shield preserves shared work on
waiter cancellation. insert_once is the required atomic persistence boundary.
Copies prevent result aliasing. Completed tasks are removed, avoiding an
unbounded completed-response cache.

No existing production file was edited other than adding the new coordinator.
Existing endpoints/auth/Node packages were not changed. Generated pycache
accidentally entered the RED commit; removed from the next commit and ignored
in the final tree. This housekeeping does not change runtime behavior.

## Conditions / residual risks
- Concern, High if used as production: no real transactional repository and
  no authenticated endpoint integration. Mitigation: not wired into runtime;
  harness-only scope clearly documented, group review required.
- Concern, Medium: cross-process duplicate compute and remote billing remain
  possible despite unique stored result (T17 deliberately demonstrates this).
- Concern, Medium: all callers abandoning a failing shared operation needs
  production observability/draining policy; this is not a durable worker.
- No claim of independent human or second-agent review. This is Codex self-review.

## Decision
APPROVE WITH CONDITIONS for the bounded executable-harness assignment artifact;
PARTIAL for end-to-end production CR. Do not merge or deploy until the group
reviews real DB transactions/auth integration and executes the missing tests.
Root npm test and browser E2E were not run: no Node/UI changes and not evidence
for this pure-Python slice. No Lecture 06/07 slides were supplied; no invented
slide references are included.

## Pre-submission PDF review, 2026-11-13
Rechecked the named PDF, all 8 main pages and 2 appendix pages, the 310-word
reflection, embedded links and recorded test evidence. GitHub's branch API and
ls-remote confirmed the published branch. No new functional test result is claimed.
Two document-only clarifications: label the shortened code excerpt as pseudocode,
and specify planned E2E scenario E01 with prerequisites and explicit NOT RUN
status, outside the 21 executed tests. Execution measurements remain dated
2026-11-08. No implementation, test input, oracle or production integration changed.
