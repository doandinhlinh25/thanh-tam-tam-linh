# Admin AI evaluation and student document upload — Brainstorm

## Problem statement

User request: “$scout sửa phần đánh giá AI trong pages quản trị viên, và thêm chức năng upload cho sinh viên, sinh viên phải tự upload được tài liệu”.

The student portal has no document library or upload action. A previous approved plan already defines a simulated, personal student upload experience. The admin evaluation page currently runs a timer and randomly changes one summary metric; it does not run an AI model or calculate evaluation results. Per-question fixture scores are stored as decimals such as `0.94` but displayed with a `%` suffix, which makes `0.94%` appear instead of `94%`.

This brainstorm focuses on the admin evaluation page and student upload. It reuses the previous approved student-upload direction. The phrase “sửa phần đánh giá AI” does not specify whether the desired change is presentation, metric behavior, or a real evaluation service.

## Goals and non-goals

### Goals

- Give students a discoverable way to add and manage personal learning documents in their workspace.
- Correct and make understandable the admin evaluation results and run behavior.
- Preserve truthful demo messaging and isolate personal student documents from teacher/admin shared documents.
- Keep the scope compatible with the existing frontend and contracts.

### Non-goals

- Implement real file transfer, persistence, ingestion, virus scanning, quota enforcement, or server authorization. The approved student-upload plan excludes these.
- Claim that the AI evaluated real model responses or read a selected student file.
- Add a live evaluation runner without a versioned API contract and backend owner.
- Broaden this request into a redesign of every role or unrelated admin page. This is a proposed scope boundary; the prior all-role UI plan can be continued separately if the user still wants it.

## Functional and non-functional requirements

### Confirmed

- **Confirmed by the current request:** Admin evaluation UI needs a correction/change; students need to be able to upload documents from the student experience.
- **Confirmed by prior user approval:** Student upload is simulated, metadata-only, private to the current student's demo session, and intended for that student's own mock assistant. It must remain separate from shared teacher/admin course documents; the assistant can use fixed synthetic examples only. See [prior handoff](../../handoffs/2026-10-23-student-ui-upload.md) and [approved plan](../../plans/2026-10-23/student-ui-personal-upload.md).
- **Confirmed by the repository:** No evaluation, document, chat, or authentication API paths are contracted (`contracts/openapi/common.yaml:5`). The existing UI must remain honest about this limitation unless backend contracts are added in a separately approved scope.

### Proposed

- Add a student “Tài liệu cá nhân” destination with a clear upload action available from the learner workspace.
- Limit the course selector to the current demo user's enrolled courses. If there are no courses, show a helpful empty state and disable upload.
- Provide accessible empty, selected-file, invalid-file, pending/progress, canceled, success, and remove states. Keep only filename, format, size, course and demo metadata in session-local React state; never read, persist, or transmit file bytes.
- Distinguish personal demo documents from shared course materials in the student workspace and assistant context. Unsupported content continues to receive the existing insufficient-evidence response; do not fabricate a citation for the selected file.
- For evaluation, keep the current evaluation visibly demo-only. Normalize per-question decimal scores for display as percentages, and replace random changes with a repeatable, fixture-backed mock result. Display the mock nature and show a coherent per-question result and summary after a run.
- Keep the evaluation page's current dataset creation, question addition, export, and navigation actions unless a specific defect requires a scoped change.
- Apply readable, keyboard-operable page states at narrow and desktop viewport sizes. Use existing primitives/CSS and avoid introducing dependencies.

### Assumptions

- The current request extends the already-approved simulated upload direction; it does not revoke it in favor of real file storage.
- “Sửa đánh giá AI” means making the current demo behavior and its displayed score data consistent, rather than implementing actual model evaluation. This needs user approval.
- For this request, changes should be confined to admin evaluation and the student upload journey. The prior plan's broader all-role visual refresh is not included unless the user confirms it remains part of this work.

## Options and trade-offs

| Option | Description | Complexity and maintainability | Fit, security, performance, cost and risk |
| --- | --- | --- | --- |
| **A. Correct presentation only** | Normalize decimal question scores to percentages, clarify demo labels, and make targeted usability fixes. Keep the timer and fixed/random summary behavior as-is. | Lowest effort and regression risk. Small, easy-to-maintain UI diff. | Fits current mock architecture; no API/security cost. Leaves the random metric mutation and mismatch between displayed rows and summary unresolved, so repeated runs remain confusing. |
| **B. Consistent deterministic demo evaluation (recommended)** | Fix score formatting, make a run return a predefined fixture-backed evaluation result with per-question and summary metrics that agree, and clearly label all results as simulated. Preserve the existing dataset/editor/export flow. | Moderate frontend-only work; adds a clear demo result mapping and predictable state transitions. No dependency or service needed. | Best fit for a reviewable demo: repeatable and testable, no misleading claim of live model evaluation, no network or security surface. It still does not measure a real model. |
| **C. Real AI evaluation** | Define an evaluation contract and backend runner that invokes the RAG/chat model, computes metrics from versioned datasets, and returns durable runs/results; then integrate the admin page. | Highest effort; requires backend/service/contract, data model, auth/authorization, observability, and integration tests. | Appropriate only if admins need actual quality measurements. Cannot be implemented honestly from the current frontend alone; adds provider cost and operational/security dependencies. |

## Recommendation

Choose **Option B** for the current frontend: the user's request can be addressed without inventing backend routes, and repeatable mock results are easier to inspect than random changes. Explicitly label the run and metrics as illustrative; never call this a real AI evaluation. Keep the student upload within the previously approved private, metadata-only demo scope.

Choose **Option C** instead if the requirement is that an administrator can measure a deployed model. That choice needs a backend contract and owner before detailed frontend planning.

## Edge cases

### Evaluation

- Empty evaluation set: disable run and explain why; do not change prior metrics.
- Newly added question has no result yet: display “Chưa chạy” or equivalent, not `0%` as if measured.
- Decimal score (`0.94`) versus percentage score (`94`): define one internal representation and format consistently.
- Repeated run: deterministic fixture values remain consistent; history grows according to defined behavior and stays within chart/export assumptions.
- Run already in progress or page unmount: prevent duplicate runs and clean up timers; do not leave progress stuck.
- Export before/after a run: label fixture values and distinguish unevaluated questions from scores.
- No API/runner: UI must not imply model execution, live data, or durable history.

### Student upload

- Student has no enrolled courses: no upload target; explain the requirement.
- Unsupported file extension or empty selection: announce a recoverable validation error.
- Cancel upload or remove a document: discard only that student's session-local metadata.
- Logout or switch persona: personal documents and assistant context clear; another student/admin/teacher cannot see them.
- Uploaded document has no fixed synthetic assistant fixture: the assistant must not claim to inspect it or cite it; use the existing insufficient-evidence state.
- Large file/unsupported content: any demo constraints must be identified as UI prototype rules, not backend guarantees; the selected bytes must not be read or uploaded.

## Acceptance criteria

These proposed criteria need approval before they become the implementation contract.

1. A student can reach a personal document library and start an upload from the student role.
2. The student upload flow includes selection, validation, progress/cancel, success, list, and removal states; it works by keyboard and exposes errors/statuses to assistive technology.
3. Course targets are limited to the current student's `courseIds`; no-course students receive a useful empty state.
4. Student uploads remain metadata-only and session-local; no selected bytes are read, stored in browser persistence, or sent over the network.
5. Student personal documents do not appear in teacher/admin shared document lists or another persona's state. The assistant uses only existing/fixed synthetic examples and does not claim to have read the file.
6. Evaluation question scores display correctly as percentages from their chosen internal representation; unevaluated questions are not presented as measured results.
7. Under Option B, running evaluation produces the same fixture-backed per-question and summary result for the same set, is clearly marked simulated, and does not randomly mutate metrics.
8. Empty-set and in-progress states prevent invalid or duplicate runs; cancel/unmount does not leave stale progress.
9. Existing question addition, set naming, CSV/JSON export, and navigation continue to work; the frontend typecheck/build pass.
10. If the user selects real evaluation (Option C), criteria 6–9 must be revisited against an approved API contract and backend specification before implementation.

## Unresolved decisions

1. **Evaluation direction:** Choose **A**, **B** (recommended), or **C**. This changes page state, data model, backend dependency, and acceptance criteria.
2. **Scope boundary:** Should this work cover only admin evaluation + student upload (recommended from the current request), or also continue the prior plan's UI refresh for student, teacher, and all admin pages?
3. **Prior upload decision:** Keep the previously approved simulated/private upload behavior (recommended and assumed here), or explicitly change to actual file transfer/persistence? Real upload requires a separate backend/API/security plan.
4. **Cook prerequisite:** If proceeding to implementation, how should the safe branch preflight be handled while the remote `main` branch cannot be verified? The previous student-upload handoff says Cook is blocked until verified-main isolation or an explicitly approved alternate branch policy.
