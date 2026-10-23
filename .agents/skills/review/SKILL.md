---
name: review
description: Workflow stage 6 of 6 (scout, brainstorm, plan, cook, test, review) for this repository. Independent, evidence-based review of the actual diff against the requirements and approved plan - correctness, security, architecture, tests, and scope - ending in APPROVE, APPROVE WITH CONDITIONS, or REQUEST CHANGES. Use after test, or to review any change. Read-only.
---

# Review

## Purpose and activation

Decide, with evidence, whether the work is ready to accept. Use after `$test`, or on request for any branch or diff. Ideally run it in a fresh session or as a different agent from the one that ran `$cook`, so the review is independent.

This skill is **read-only** for implementation code. Do not fix anything during a review-only run. Allowed writes are the review report and the handoff.

## Inputs

- The original request, the brainstorm requirements, and the approved plan: scope, tasks, and acceptance criteria.
- **The actual diff**, which you read yourself: `git diff <base>...HEAD` plus uncommitted and untracked changes. Take the base commit from the plan or handoff.
- The test report and its evidence. Re-run a cheap, critical check yourself when a claimed result looks doubtful.

## Procedure

1. **Scope.** Compare the changed files against the plan. Flag unplanned changes, dead code, debug leftovers, duplicated logic, and stray formatting churn.
2. **Correctness.** Check each acceptance criterion against the code, not against the reports.
3. **Risk areas.** Review these where they apply:
   - Authorization boundaries and tenant isolation (see `docs/architecture/`)
   - Input validation and error handling
   - Data integrity and migrations
   - Concurrency and resource cleanup
   - Performance on realistic data sizes
   - Backward compatibility of APIs and contracts
   - Secrets or personal data in code, logs, or docs
4. **Architecture and conventions.** Check that the change fits the existing boundaries and `docs/development/coding-conventions.md`, or the frontend skills for `apps/web`.
5. **Test evidence.** Check whether the tests would actually fail if the behavior regressed. Check that the claimed results have commands and output behind them. Identify important behavior that no test covers.
6. **Classify each finding** as a **Confirmed defect**, a **Concern** (plausible but unproven), or a **Suggestion**. Do not inflate suggestions into defects.

Write each finding with these fields:

- **Severity**: Critical, High, Medium, or Low
- **Location**: `path:line` or the component
- **Finding**: what is wrong
- **Impact**: why it matters
- **Evidence**: code or reproducible behavior
- **Recommendation**: the smallest appropriate fix

## Output

For substantial work, write `docs/reports/YYYY-MM-DD/<task-id>-review.md` and append a Review section to the handoff. Include:

- Summary
- Findings sorted by severity
- Coverage of requirements and acceptance criteria
- Assessment of the test evidence
- Remaining risks
- Final decision:
  - `APPROVE`: no unresolved Critical or High findings, and the acceptance criteria are verified.
  - `APPROVE WITH CONDITIONS`: acceptable once the listed Medium or Low items, or unverifiable checks, are addressed. List those conditions.
  - `REQUEST CHANGES`: any unresolved Critical finding, a High finding without an accepted mitigation, or unmet acceptance criteria.

Never approve while a Critical defect is unresolved. Do not claim security or production readiness on the strength of passing tests alone.

## Completion criteria

- The decision is traceable to specific findings and evidence.
- Every acceptance criterion has a status.
- No implementation files were modified. Confirm with `git status`.

## Stage close (guided mode)

Report: the decision, the report path, the top findings, and your recommended next action. Options:

- If the decision is `APPROVE`, accept the work. Commit or open a PR only if the user authorizes it. For frontend work, use `frontend-git-flow`.
- If changes are needed, return to `$cook` with the findings, or to `$plan` if the design must change.
- Discuss specific findings.
- Stop here.
