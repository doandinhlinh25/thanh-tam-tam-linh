# Project skills workflow

Six Codex skills under [`.agents/skills/`](../../.agents/skills/README.md) split work into stages. Each stage has one job, writes its artifact to `docs/`, and stops for the user to choose the next step.

```text
 $scout ──► $brainstorm ──► $plan ──► $cook ──► $test ──► $review
 (read)     (decide)        (approve)  (edit)    (verify)  (decide)
    ▲            │  skip if agreed ▲      ▲         │ FAIL     │ REQUEST CHANGES
    └─ stale ────┘─────────────────┘      └─────────┴──────────┘
                                                               │ APPROVE
                                                               ▼
                                          accepted → commit/PR only if authorized
```

| Skill | Writes code? | Main artifact | Gate before the next stage |
| --- | --- | --- | --- |
| `$scout` | No | `docs/reports/YYYY-MM-DD/<task-id>-scout.md` | User chooses the next stage |
| `$brainstorm` | No | `docs/reports/YYYY-MM-DD/<task-id>-brainstorm.md` | User approves a direction |
| `$plan` | No | `docs/plans/YYYY-MM-DD/<short-task-name>.md` | Plan `Status: APPROVED` |
| `$cook` | Yes | Code plus a Cook section in the handoff | All tasks done or reported as outstanding |
| `$test` | Tests only, when authorized | `docs/reports/YYYY-MM-DD/<task-id>-test.md` | `PASS` or `PARTIAL` |
| `$review` | No | `docs/reports/YYYY-MM-DD/<task-id>-review.md` | `APPROVE` |

`task-id` is `YYYY-MM-DD-<short-slug>`, using the date the task starts. All stages share one living handoff at `docs/handoffs/<task-id>.md`. Directories are created on first use.

## Artifacts and templates

- [Handoff](templates/handoff.md): used by every stage once the work spans sessions, agents, or substantial stages. For a trivial task, an inline summary is enough.
- [Plan](templates/plan.md): has the 12 required sections and an approval status.
- [Coordination](templates/coordination.md): needed only when several agents or worktrees share a task.
- Durable architectural decisions go in `docs/decisions/NNNN-<slug>.md`, with context, decision, consequences, and date.

## Invoking in Codex

Type `$` in the composer, or use `/skills`, to pick a skill. Example invocations:

```text
$scout investigate how tenant membership is checked before adding course roles
$brainstorm using docs/reports/2026-10-23/2026-10-23-course-roles-scout.md
$plan for the approved option B in docs/handoffs/2026-10-23-course-roles.md
$cook docs/plans/2026-10-23/course-roles.md
$test docs/plans/2026-10-23/course-roles.md
$review the current branch against docs/plans/2026-10-23/course-roles.md
```

Manual mode: invoke each skill yourself. Guided mode: each skill ends by listing what it did, its artifacts, any blockers, a recommended next step, and the valid options. It never starts the next stage on its own.

## Choosing a path

| Work type | Path |
| --- | --- |
| **New feature** | Run the full workflow. Frontend features follow [`frontend-feature-workflow`](../../.agents/skills/frontend-feature-workflow/SKILL.md) for stage content and branching, then add `$review`. |
| **Bug fix** | `$scout` reproduces and locates the bug. Then run a short `$plan` with a regression test as an acceptance criterion, followed by `$cook`, `$test`, and `$review`. Skip `$brainstorm` unless the fix involves a real design choice. |
| **Refactor** | `$scout` records the current behavior and tests. In `$brainstorm`, only if the target structure is debatable, set the acceptance criterion "no behavior change". Then `$plan` with small steps, `$cook`, `$test` (the same tests pass before and after), and `$review` (look for scope creep). |
| **Technical investigation** | `$scout`, plus `$brainstorm` if options must be compared. Stop there and record any decision in `docs/decisions/`. |

## Multi-agent rules

- One owner per plan task. Exclusive file ownership is recorded in the coordination record.
- Use a separate Git worktree or branch per agent. A change in another worktree is not visible here until it is integrated.
- Integrate in the declared order with a fresh diff, then run `$test` and `$review` again on the combined result. Never auto-merge.

## Approval gates

The following always require explicit user authorization:

- Destructive file or data operations
- Migrations on real data
- Deploys or publishing
- Push, merge, or history rewrites
- Auth, security, or secrets changes beyond the approved scope
- New paid services or operationally significant dependencies
- Substantial scope expansion

Never put secrets in reports or handoffs.
