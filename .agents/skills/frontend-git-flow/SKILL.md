---
name: frontend-git-flow
description: Safely start and integrate a frontend feature branch from verified current main while preserving user changes. Use for substantial feature or refactor Git preparation, commits, and PR handoff; commits and remote mutations require explicit authorization.
---

# Frontend Git Flow

## Purpose and activation

Use independently or from `frontend-feature-workflow` Scout for a new feature, fix, or substantial refactor. Establish a dedicated branch from the latest **verified** `main`, protect existing work, and make integration reviewable. A docs-only correction can remain on the current branch if the user has not requested a feature branch and the repository policy does not require one.

Inputs: user task and authorization, current Git state, remote availability, intended branch name, and any existing user changes. This repository's local `main` and cached `origin/main` matched at `82157f1` during the [discovery audit](../../../docs/engineering/frontend-skill-discovery.md), but that does **not** establish current remote freshness.

## Inspection and decision

1. Run `git status --short --branch`, `git status --porcelain=v1 -uall`, `git branch -vv`, `git remote -v`, and `git log -5 --oneline`. Distinguish tracked edits, staged edits, and untracked files in the **current worktree**, even if its branch is not `main`. A branch switch in a dirty worktree can carry those files into the new branch; do not switch there. Preserve the work in place, use a separately verified clean worktree if appropriate, or request a decision. Never discard, reset, clean, or silently stash user work.
2. For feature branching, fetch `origin main` when access is available. Verify `main` and `origin/main` ancestry and whether local `main` is clean and can advance by fast-forward only. Do not treat cached `origin/main` as proof of remote freshness. If the fetch fails, or main is dirty/diverged, stop branch creation and report exact commits/status and the next safe choice; independent feature analysis can continue.
3. If `main` is behind and clean, advance it only by a verified fast-forward. If it has local commits not on `origin/main`, diverged history, a conflicting untracked path, or uncertain baseline, request a decision before altering it. Do not branch from an arbitrary working branch when latest `main` is required.
4. Choose a scoped name such as `feat/rag-source-citations`, `feat/course-progress`, `fix/chat-stream-retry`, or `refactor/frontend-api-client`. Create from verified `main` and confirm the new branch's starting commit equals the verified baseline before Cook.

## Commit and integration execution

- When the user explicitly authorizes a commit, review `git diff`, `git diff --cached`, and the file list first. Stage only intended paths. Exclude secrets, `.env`, generated output, and unrelated files. Use focused Conventional Commits when compatible with repository history, for example `feat(frontend): add source citation panel`. Existing commits in this repository are not yet Conventional Commits; do not rewrite them.
- After the feature workflow's Test stage, summarize changed behavior, decisions, executed checks, failures/blocked checks, risks, and useful screenshots. When push and PR creation are authorized and supported, verify upstream/baseline, push the feature branch, then open or prepare a PR targeting `main`. Confirm the actual remote operation before claiming success.
- Inspect merge conflicts and dependency changes before integration. Do not force-push, rewrite shared history, or merge over unresolved conflicts. A PR draft can be prepared locally without remote mutation.

## Quality gates and recovery

Accept branch preparation only when the starting commit is recorded, remote freshness is verified, the current worktree used for branch creation is clean, all prior work is preserved, and the branch is based on intended `main`. If a command fails, record its output and current status before retrying. For an existing branch name, choose another scoped name or use the existing branch only after inspecting its baseline. For dirty main, a dirty current worktree, or untracked collisions, preserve files and request the necessary decision or establish a separate clean worktree without moving existing files; do not use reset/clean to make the workflow appear green. For unavailable remote access, label freshness unverified and defer branch creation under the latest-main policy.

Output: Git preflight facts, branch/baseline evidence or blocker, changed-file/commit summary when authorized, PR result when authorized, and recovery actions. Hand branch and baseline to `frontend-feature-workflow` Plan and Test; recommend the next safe Git action after verification.
