---
name: test
description: Workflow stage 5 of 6 (scout, brainstorm, plan, cook, test, review) for this repository. Verify an implementation against its plan's acceptance criteria by inspecting the actual diff and running the project's real checks; report PASS, FAIL, PARTIAL, or BLOCKED with evidence. Use after cook or to verify any change; never fakes or weakens results.
---

# Test

## Purpose and activation

Verify that the actual code meets the agreed acceptance criteria and causes no regressions. Use after `$cook`, or whenever a change needs verification. For frontend changes, also open and follow `.agents/skills/frontend-testing/SKILL.md`.

## Inputs

- The approved plan's acceptance criteria and test strategy (sections 8 and 10), and the handoff's Cook section.
- **The actual diff**: `git status`, `git diff`, `git diff --cached`, and any untracked files. Do not rely on the implementation report alone.

## Procedure

1. **Discover the checks.** Read the commands from the manifests; do not guess them. In this repository, root `npm run build`, `npm run typecheck`, and `npm test` cover only the Node workspaces (`packages/*`, `services/*`). Frontend checks come from `apps/web/package.json`. OPA policies have `infrastructure/gateway/opa/policies/*_test.rego`, which runs with `opa test` if `opa` is installed.
2. **Baseline.** When a check fails, determine whether the failure predates the change. Run the same check on the base commit in a separate worktree (`git worktree add <scratch-path> <base>`), or run `git stash` only if the user authorizes it. Never touch the working tree in a way that risks someone's changes.
3. **Run.** Run the relevant build, typecheck, lint, unit, integration, and end-to-end checks that exist. Record each exact command, its exit status, and the key output.
4. **Acceptance mapping.** Mark each acceptance criterion `pass`, `fail`, or `blocked`, with evidence (a command, a test name, or a manual observation).
5. **Coverage.** Check that normal cases, edge cases, validation failures, permission and tenant boundaries, and regression scenarios are covered. Add or update tests only when authorized and in scope. Never edit a test just to make it pass, and never weaken production safeguards to simplify testing.
6. **Failures.** For each failure, give reproduction steps, the likely cause, and whether the change introduced it or it already existed.

Do not deploy anywhere unless explicitly authorized.

## Output

For substantial work, write `docs/reports/YYYY-MM-DD/<task-id>-test.md` and append a Test section to the handoff. Include:

- Scope, environment, and the commit or diff tested
- Commands run, with pass, fail, or skip for each
- The acceptance criteria table
- Failure details and reproduction steps
- Regression analysis (introduced versus pre-existing)
- Coverage gaps and environment limitations, including checks that could not run and why
- Overall status:
  - `PASS`: all required checks succeeded.
  - `FAIL`: at least one required check failed.
  - `PARTIAL`: some checks succeeded, but coverage is incomplete.
  - `BLOCKED`: verification could not be completed.

Never report a check as passing unless it actually ran and succeeded.

## Completion criteria

- Every acceptance criterion has a status backed by evidence or a stated reason it could not be checked.
- The overall status is justified by the recorded commands.

## Stage close (guided mode)

Report: the overall status, the report path, failures and blockers, and your recommended next action. Options:

- If the status is `PASS` or `PARTIAL`, continue to `$review`.
- If the status is `FAIL`, return to `$cook` to fix the failures.
- Add the missing tests, if authorized.
- Stop here.
