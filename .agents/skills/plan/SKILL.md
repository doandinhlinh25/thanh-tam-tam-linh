---
name: plan
description: Workflow stage 3 of 6 (scout, brainstorm, plan, cook, test, review) for this repository. Convert an approved direction into an ordered, verifiable implementation plan saved under docs/plans/YYYY-MM-DD/, with files, tasks, checks, risks, rollback, and acceptance criteria. Use after brainstorm approval or for an already-agreed change. Does not implement.
---

# Plan

## Purpose and activation

Produce a plan that `$cook` can execute and `$test` and `$review` can check against. Use when the direction is approved, either in the brainstorm handoff or stated explicitly by the user. Keep the plan proportionate: a small fix needs a short plan, while a cross-service feature needs the full template.

Do **not** implement, create branches, or change source or configuration. Allowed writes are the plan, the handoff, and, if needed, a coordination record.

## Inputs

- The handoff `docs/handoffs/<task-id>.md`, the scout report, and the brainstorm record, including its **Approved decisions** section.
- Re-check the current repository state against the scout's base commit with `git status` and `git log <base>..HEAD --oneline`. If the relevant files changed, re-verify the affected findings before planning on them.
- Applicable conventions: `docs/development/coding-conventions.md` for Node services, `.agents/skills/README.md` for specialist skills, and `contracts/` for APIs.

If no direction has been approved and design choices remain open, stop and recommend `$brainstorm`.

## Procedure

1. Copy [the plan template](../../../docs/workflow/templates/plan.md) to `docs/plans/YYYY-MM-DD/<short-task-name>.md`, using today's date. If the name is already taken, use a more specific one. Set `Status: DRAFT`.
2. Fill in current-state findings with citations. Keep assumptions labeled as assumptions.
3. Name the exact files, modules, interfaces, schemas, APIs, and dependencies to change. Do not plan against endpoints or contracts that do not exist. In this repository, `contracts/openapi/common.yaml` defines no paths yet. Make a missing contract a prerequisite with a named owner.
4. Break the work into ordered tasks that can each be verified independently. Give every task the files it touches, a verification command or check, the expected result, and its dependencies. Use only commands that exist. Root `npm run build`, `npm run typecheck`, and `npm test` cover only the Node workspaces. Read `apps/web/package.json` for frontend scripts.
5. Cover security, compatibility, migrations, error handling, observability, and performance where they apply. Mark optional improvements separately from required work.
6. Map every acceptance criterion to a check in section 8.
7. **Parallelism.** Mark which tasks can run in parallel and which files they share. If more than one agent will work on the task, create `docs/handoffs/<task-id>-coordination.md` from [the coordination template](../../../docs/workflow/templates/coordination.md), giving each agent exclusive ownership of its files.
8. Name the specialist skills that `$cook` must open, for example `frontend-ui-engineering` or `frontend-api-integration`, and the branch policy. For frontend work, the policy is `frontend-git-flow`.
9. Give the rollback or recovery steps.

## Approval gate

Present the plan and ask for approval. Only after the user explicitly approves, set `Status: APPROVED (by <who>, <date>)` and record the approval in the handoff. If the user requests changes, revise the plan and ask again.

## Completion criteria

- The plan is consistent with the repository and contains all 12 sections. Short plans may mark a section "n/a" with a reason.
- Every task has a check, and every acceptance criterion maps to a test.
- Status is `APPROVED` before `$cook` begins.

## Stage close (guided mode)

Report: the plan path, the key tasks and risks, the decisions needed, and your recommended next action. Options:

- Approve and continue to `$cook`.
- Revise the plan.
- Return to `$brainstorm` if the approach itself is in question.
- Stop here.
