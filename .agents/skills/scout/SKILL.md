---
name: scout
description: Workflow stage 1 of 6 (scout, brainstorm, plan, cook, test, review). Read-only investigation of this repository before proposing or changing anything - stack, structure, conventions, Git state, relevant files, risks, and unknowns. Use when starting a new task, bug, refactor, or technical investigation, or when existing findings are stale.
---

# Scout

## Purpose and activation

Establish verified project context so later stages do not repeat the investigation. Use at the start of a feature, bug fix, refactor, or investigation, or when the repository changed since the last scout report. Skip or shorten when a current scout report or handoff already covers the task. Check the base commit and `git log` since then.

This skill is **read-only**. Do not edit source or configuration, install dependencies, create branches, or run commands that mutate state. Allowed writes are the scout report and handoff described below.

## Inputs

- The user's request (quote it in the report).
- Root `AGENTS.md` and any nested `AGENTS.md` on the path to relevant code.
- Existing artifacts for this task: `docs/handoffs/<task-id>.md` and `docs/reports/*/<task-id>-*.md`.

## Procedure

1. **Git state.** Run `git status --short --branch`, `git branch -vv`, `git log -10 --oneline`, and `git worktree list`. Record the branch, HEAD, and any tracked, staged, or untracked changes; those changes are someone's work. Note if `origin` is unreachable. Do not treat cached `origin/main` as current.
2. **Orientation.** Read `README.md`, the root manifests (for example `package.json` and workspaces), and the docs index under `docs/`. In this repository also check `docs/architecture/`, `docs/development/coding-conventions.md`, `contracts/`, and `.agents/skills/README.md`.
3. **Narrow to the task.** Locate entry points, modules, routes, schemas, contracts, tests, and configuration that the task touches. Use `rg` or `git ls-files`. Read the relevant files fully, but do not read the whole repository.
4. **Conventions and tooling.** Record actual build, typecheck, lint, and test commands from the manifests. Record existing patterns to reuse and existing skills or workflows that apply, for example `frontend-feature-workflow` for frontend features. Optionally run a **read-only** baseline check when it is cheap and relevant, and record its exact result.
5. **Classify every claim.** Mark each as **Verified** (cite a path, line, or command output), **Assumption**, or **Unknown**. Plans in handbooks and assignment documents are proposals until code or a contract confirms them.
6. **Risks.** List architectural inconsistencies, missing contracts or docs, stale documentation, conflicting work in progress, and dependencies on other owners or teams.

## Output

Write the report to `docs/reports/YYYY-MM-DD/<task-id>-scout.md` when the findings are substantial, meaning more than a few facts or reused by another session or agent. Otherwise answer inline. Use today's actual date. `task-id` is `YYYY-MM-DD-<short-slug>`. Sections:

1. Request and scope as understood
2. Project overview, limited to what matters for this task
3. Git state, including the base commit
4. Relevant files and modules, with paths and the role of each
5. Existing implementation and conventions to follow
6. Commands available, plus any baseline results
7. Constraints, risks, assumptions, and open questions
8. Recommended next step

Create or append the handoff at `docs/handoffs/<task-id>.md` from [the handoff template](../../../docs/workflow/templates/handoff.md) when work will span sessions or agents.

## Completion criteria

- The next stage can start from this report without re-investigating.
- Every factual claim is cited or labeled as an assumption or unknown.
- Git state and the base commit are recorded.
- No source or configuration file was changed. Confirm with `git status`.

## Stage close (guided mode)

Report: what was completed, artifact paths, blockers or decisions needed, and your recommended next action. Offer only the options that apply:

- Continue to `$brainstorm`, when design choices or requirements are open.
- Skip to `$plan`, when the solution is already specified and agreed.
- Revise or extend scouting.
- Ask questions about the findings.
- Stop here.

Do not start the next stage until the user chooses it.
