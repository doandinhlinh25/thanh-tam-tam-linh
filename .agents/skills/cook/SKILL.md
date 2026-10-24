---
name: cook
description: Workflow stage 4 of 6 (scout, brainstorm, plan, cook, test, review) for this repository. Implement an APPROVED plan from docs/plans/ within its scope, preserving others' work and mapping each change to a plan task. Use only when the user asks to implement an approved plan; no commits, pushes, or merges without authorization.
---

# Cook

## Purpose and activation

Implement exactly the approved scope. Use when a plan in `docs/plans/` has `Status: APPROVED`, or when the user explicitly approves a plan in the current conversation. For a small, fully specified change that the user asked you to implement directly, the request itself counts as the plan. Keep that change minimal and still report in the output format below.

If no approved plan exists for a substantial change, stop and recommend `$plan`.

## Inputs

- The approved plan and the handoff `docs/handoffs/<task-id>.md`, plus the coordination record if one exists.
- The requirement and decision sources that the plan cites.
- The specialist skills named in the plan. **Open and follow their `SKILL.md` files.** Naming them is not enough.

## Preflight (before the first edit)

1. Run `git status --short --branch`, `git worktree list`, and `git log -5 --oneline`. Compare HEAD with the plan's baseline.
2. Inspect existing tracked, staged, and untracked changes in the files you will edit (`git diff -- <path>`). Build on them. Never discard, reset, stash, overwrite, or revert them without explicit authorization.
3. Branch policy: follow the plan's policy. For frontend features, use `frontend-git-flow`. Never switch branches in a dirty worktree when that would carry or mix someone else's changes. If the required branch cannot be established safely, stop and ask.
4. Parallel work: edit only the files your coordination row owns. Re-read the coordination record before you touch a shared file. Never assume another worktree's changes are present here.

## Implementation

1. Work task by task in plan order. After each task, run its verification command and record the result.
2. Follow existing conventions and architecture, for example `docs/development/coding-conventions.md` for Node services. Make no unrelated refactors, formatting churn, or dependency upgrades.
3. Handle validation, errors, authorization boundaries, and the edge cases the plan lists. Never weaken existing safeguards.
4. Update tests, docs, configuration examples (`.env.example`, never real `.env` files), and migrations when the plan requires it. Never write secrets.
5. **Deviations.** Small, necessary deviations (a different file name, an extra helper) must be recorded in the output. Significant ones (new scope, a new dependency with operational impact, a change to auth or security policy, a migration that affects real data) require stopping and getting approval first.

## Approval-gated operations

Do not do any of the following without explicit authorization for this task: commit, push, merge, rewrite history, deploy, publish, run destructive data operations, or add a paid service or external dependency.

## Output

Append a Cook section to the handoff and report:

- Summary of the change
- Files changed, each with the plan task it implements and the reason
- Plan tasks completed and outstanding
- Deviations and the decisions taken
- Commands run, with their actual results; label failures as failures
- Known limitations and anything left for `$test` to verify

## Completion criteria

- Every approved task is done or explicitly reported as outstanding.
- The diff contains only planned changes, as confirmed by `git diff --stat` and `git status`.
- Others' pre-existing changes are intact.

## Stage close (guided mode)

Report: what was implemented, the changed files, any deviations or blockers, and your recommended next action. Options:

- Continue to `$test`, which is the default.
- Fix an issue found during implementation.
- Return to `$plan` if scope must change.
- Stop here.
