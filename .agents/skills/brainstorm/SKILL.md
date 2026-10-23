---
name: brainstorm
description: Workflow stage 2 of 6 (scout, brainstorm, plan, cook, test, review) for this repository. Turn scout findings into requirements, compared solution options, a recommendation, and acceptance criteria for user approval. Use when requirements or design choices are unresolved; skip for well-specified changes. Writes no code.
---

# Brainstorm

## Purpose and activation

Explore and decide on a direction before detailed planning. Use when the request is ambiguous, has meaningful design alternatives, or touches business rules, security, data, or other teams. Skip when the solution is obvious and agreed. In that case, record the direction in one or two lines in the handoff and recommend `$plan`.

Do **not** write or modify code or configuration. Allowed writes are the brainstorm record, the handoff, and, if the user approves a durable architectural choice, a decision record.

## Inputs

- The scout report and handoff for this task. If neither exists, run a short, proportionate `$scout`-style check of the relevant code first, and say that you did.
- Any requirement sources: issues, `docs/documents/`, assignments, contracts under `contracts/`, and `docs/architecture/`.
- For frontend features, `frontend-feature-workflow` defines BA and Analyze content (UI states, accessibility, contracts). Apply it here so its BA and Analyze stages are not repeated.

## Procedure

1. **Frame the problem.** State the user or business problem, affected users or roles, goals, non-goals, and constraints. Quote the request.
2. **Requirements.** Separate **Confirmed** requirements (stated by the user or a source document, with a citation) from **Proposed** ones (your suggestions) and **Assumptions**. Never promote a proposal or assumption to confirmed without user approval.
3. **Edge cases and failures.** Cover invalid input, permission boundaries, tenant or data isolation, concurrency, partial failure, and empty or large data where relevant. Cover integration points with other services or owners.
4. **Options.** When alternatives are meaningful, describe 2 or 3 genuinely different approaches. Compare them on complexity, maintainability, compatibility with current architecture and contracts, security, performance, cost, and implementation risk. If one approach is clearly standard, say so rather than inventing alternatives.
5. **Recommend.** Pick the simplest option that meets the requirements, give the decisive reasons, and say when another option would win.
6. **Acceptance criteria.** Write observable, testable criteria. Each one should later map to a check in `$test`.
7. **Decisions for the user.** List only the questions whose answer changes the design, scope, or risk. For each, give your recommended answer.

## Output

For substantial work, write `docs/reports/YYYY-MM-DD/<task-id>-brainstorm.md` with these sections:

- Problem statement
- Goals and non-goals
- Functional and non-functional requirements, labeled Confirmed, Proposed, or Assumption
- Options and trade-offs
- Recommendation
- Edge cases
- Acceptance criteria
- Unresolved decisions

Append a Brainstorm section to `docs/handoffs/<task-id>.md` using [the handoff template](../../../docs/workflow/templates/handoff.md). After the user approves a direction, record it under **Approved decisions** in the handoff. If the decision affects future work beyond this task, also record it in `docs/decisions/NNNN-<slug>.md` (context, decision, consequences, date).

## Completion criteria

- The user has enough information to approve a direction or ask for changes.
- Requirements are labeled by certainty, and acceptance criteria are testable.
- No code changed.

## Stage close (guided mode)

Report: what was completed, artifact paths, the decisions needed (with your recommendation for each), and your recommended next action. Options:

- Approve the recommendation and continue to `$plan`.
- Choose a different option or revise the requirements.
- Return to `$scout` for missing facts.
- Stop here.

`$plan` requires an approved direction. Do not proceed on silence.
