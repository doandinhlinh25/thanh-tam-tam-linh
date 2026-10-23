# Coordination: <task-id>

<!-- Only for work split across several agents/worktrees. Save beside the handoff as docs/handoffs/<task-id>-coordination.md. Every agent updates only its own row, and re-reads this file before editing shared paths. -->

- Integration owner: <agent/person>
- Integration branch: <branch>
- Base commit: <commit>

| Plan task | Owner | Branch / worktree | Files owned (exclusive) | Status | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | | | | `todo` | |

## Shared files

<!-- Paths more than one task must touch, and the order or owner that resolves them. -->

## Integration steps

1. Each owner reports a fresh diff and its `$test` evidence on its own branch.
2. Integration owner merges in the declared order (no auto-merge; conflicts resolved by the file owner).
3. Re-run `$test` on the integrated result, then `$review` against the full diff.
