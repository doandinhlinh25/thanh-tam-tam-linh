# Handoff: 2026-10-23-student-ui-upload

## Task

- Task ID: `2026-10-23-student-ui-upload`
- Original request: “hãy khảo sát lại giao diện ui và cải thiện cho phù hợp với người dùng và 1 tính năng cần thêm là học sinh cũng có quyền up load tài liệu”
- Branch / worktree: `main` at `82157f1`, `/home/thanh/Documents/1.Projects/thanh-tam-tam-linh`
- Owner(s): Codex scout; next stage awaits user direction.

## Approved decisions

| Date | Decision | Approved by | Source |
| --- | --- | --- | --- |
| 2026-10-23 | Refresh the UI for student, teacher, and organization-admin workspaces. | User | User message invoking `$plan` |
| 2026-10-23 | Keep student upload simulated; student documents are private and intended for that student's personal assistant. | User | User message invoking `$plan` |
| 2026-10-23 | Approve implementation plan for all-role UI refresh and simulated personal student upload. | User | User message: “duyệt lưu ý và plan, hãy chuyển sang $cook” |

## Stage log

### Scout — 2026-10-23 — Codex

- Status: `DONE`
- Inputs read: `AGENTS.md`, `README.md`, `apps/web/package.json`, `apps/web/README.md`, `apps/web/src/App.tsx`, student/teacher workspace, `DocumentsPage.tsx`, styles, types and demo fixtures, OpenAPI, architecture docs, workflow and frontend specialist skills, existing role-based feature record, Git state.
- Completed work and evidence: Current UI and upload path inspected; missing student upload affordance/state, demo-only upload behavior, readability concerns, missing contract and product decisions recorded in [scout report](../reports/2026-10-23/2026-10-23-student-ui-upload-scout.md). `git ls-remote` failed because GitHub DNS is unavailable. No build/test run in this read-only stage.
- Files or modules affected: Added only this handoff and the scout report; no source/configuration changes.
- Assumptions (unverified): Student upload should at minimum be scoped to the student's course IDs; visibility and review semantics are unknown.
- Open questions / decisions needed: private vs teacher-visible vs class-shared file; immediate vs teacher-reviewed ingestion; allowed formats/limits and student actions; mock-only vs live API; accessibility/viewport target for UI refresh.
- Risks and blockers: No upload, auth/session, course membership, or document processing endpoint contract. `origin/main` freshness unknown. Existing user changes include untracked app/skills/docs.
- Remaining work: BA/Analyze options and acceptance criteria, approved implementation plan, implementation, verification and independent review as authorized by subsequent stages.
- Recommended next skill: `$brainstorm` — resolve UI scope and upload permissions before planning implementation.

### Brainstorm — 2026-10-23 — Codex

- Status: `DONE`
- Inputs read: Scout report and handoff; `.agents/skills/frontend-feature-workflow/SKILL.md`; frontend UI, forms, security, and API integration skills; frontend assignment; current OpenAPI and architecture ownership docs.
- Completed work and evidence: BA requirements and Analyze options A (mock personal library), B (real private student course library), and C (teacher-reviewed shared course materials) are compared in [brainstorm report](../reports/2026-10-23/2026-10-23-student-ui-upload-brainstorm.md). After the user clarified the direction, the recommendation was revised to include all-role UI refresh, simulated upload, and personal assistant context using only synthetic fixtures.
- Files or modules affected: Added brainstorm report and appended this handoff; no application source or configuration changed.
- Assumptions (unverified): Learner upload defaults to a personal supplemental document scoped to an enrolled course; no shared visibility or retrieval use without an explicit decision.
- Open questions / decisions needed: None for this demo scope. The user selected all-role UI refresh, simulated upload, and private student documents used in that student's assistant. The real selected file's contents remain unread in the simulation.
- Risks and blockers: No upload/auth/course API contract exists. Real upload requires backend ownership and authorization. GitHub remote/main freshness remains unverified from the prior scout.
- Remaining work: Plan drafted; await explicit plan approval before any implementation.
- Recommended next skill: `$plan` — user supplied the three product decisions and explicitly invoked it.

### Plan — 2026-10-23 — Codex

- Status: `DONE — DRAFT AWAITING APPROVAL`
- Inputs read: Scout and Brainstorm artifacts, frontend feature workflow, plan and coordination templates, frontend Git Flow, current app package/state/files, current OpenAPI and service boundaries.
- Completed work and evidence: Ordered six-task plan with file ownership, dependencies, checks, acceptance mapping, risks, and rollback saved at [plan](../plans/2026-10-23/student-ui-personal-upload.md). Rechecked that HEAD remains `82157f1`, there are no commits since the scout base, and pre-existing worktree changes remain. Remote freshness is still unverified.
- Files or modules affected: Added plan and updated this handoff only; no source or configuration changed.
- Assumptions (unverified): Assistant interaction for simulated uploads will use fixed synthetic examples only; actual selected file content is not analyzed.
- Open questions / decisions needed: User approval of the DRAFT plan. Before Cook, resolve the plan's verified-main clean feature-branch prerequisite or explicitly approve a different safe branch policy.
- Risks and blockers: Dirty main worktree contains pre-existing changes; all of `apps/web` is untracked and absent from base commit `82157f1`; GitHub DNS remains unavailable; no real upload/chat API contract.
- Remaining work: Plan approval, safe Git preflight, then Cook, Test, and Review as separate user-authorized stages.
- Recommended next skill: `$cook` after explicit plan approval and a successful Git preflight.

### Cook — 2026-10-23 — Codex

- Status: `BLOCKED`
- Inputs read: Approved plan, handoff, current Git status/worktree/log, tracked/untracked target files, `frontend-git-flow`, `frontend-ui-engineering`, `frontend-forms`, `frontend-security`, and `frontend-testing` skills.
- Completed work and evidence: Recorded plan approval. Preflight confirms HEAD `82157f1`; no commits since base; worktree has pre-existing modified `.gitignore` and `package.json` and substantial untracked work. `git ls-files apps/web` is empty, so the full current frontend is untracked and absent from the baseline commit. Latest retry: `getent hosts github.com` returned no address; `git fetch origin main` failed because `.git/FETCH_HEAD` is read-only. A prior authorized elevated fetch request did not execute because auto-review rejected it with an invalid model configuration (`codex-auto-review`); this is a review-service failure, not a safety rejection. Latest main cannot be verified and no worktree named `thanh` was created.
- Files or modules affected: Updated only plan status and this handoff. No source/configuration files changed; all existing user work preserved.
- Assumptions (unverified): None.
- Open questions / decisions needed: Choose a safe path: (1) wait for remote access, verify current main, then establish a separate clean feature worktree while deliberately preserving/carrying the untracked frontend; or (2) explicitly approve a different branch policy, such as continuing implementation in this existing dirty worktree/main while preserving all unrelated files.
- Risks and blockers: Do not create/switch branch or edit app until a safe baseline and ownership of untracked frontend files are resolved. No remote freshness proof; current app absent from commit history. Fetch remains blocked because auto-review service failed before execution; do not bypass it.
- Remaining work: Implement T1–T6 after branch/worktree policy is resolved; then `$test` and `$review` as separate stages.
- Recommended next skill: Resume `$cook` after user selects a safe branch/worktree policy or after remote is reachable and a clean feature worktree can be established.
