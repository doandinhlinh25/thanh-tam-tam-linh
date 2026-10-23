# Student UI and document upload — Brainstorm

## Problem statement

The current student workspace supports enrolled-course browsing and demo Q&A, but has no place for learners to add or manage their own materials. Its small type and dense card layout also make the learning workspace harder to scan and read. The upload UI available to teachers only records filename/format/size in local state and simulates progress; there is no API or server permission enforcement.

User request: “hãy khảo sát lại giao diện ui và cải thiện cho phù hợp với người dùng và 1 tính năng cần thêm là học sinh cũng có quyền up load tài liệu”.

The live app is a mock frontend (`apps/web/README.md`), and `contracts/openapi/common.yaml` has no paths. This brainstorm therefore separates a usable demo interaction from a real upload permission and storage feature.

## Goals and non-goals

### Goals

- Make the learner workspace easier to read, navigate, and use across common screen sizes.
- Give a student a clear entry point to add a document to a course they are enrolled in.
- Show clear file-selection, validation, pending, success, empty, and failure states.
- Make the audience and scope of learner-uploaded documents understandable.
- Keep the interface honest about whether file bytes are actually transferred or processed.

### Non-goals for the initial frontend change

- Invent an API, storage service, or backend authorization behavior absent from the repository.
- Treat a student-uploaded file as authoritative shared course material without a moderation decision.
- Add lessons, progress tracking, or other LMS features unrelated to this request.
- Redesign the admin management console unless the user chooses a broader UI refresh.

## Functional and non-functional requirements

### Confirmed

- **Confirmed by user:** Review and improve the UI for usability, and add student document upload capability (the request quoted above).
- **Confirmed by current project docs:** The app is presently a demo that uses in-memory state and does not connect to an API or persist file contents (`apps/web/README.md`).
- **Confirmed by current contract:** There is no checked-in OpenAPI operation (`contracts/openapi/common.yaml`, `paths: {}`).
- **Confirmed by current implementation:** Student courses are scoped to the current demo user's `courseIds`; there is currently no student upload route or state (`apps/web/src/pages/StudentWorkspace.tsx`).

### Proposed

- Limit the initial UI improvement to the student workspace and its shared role shell: improve readable typography, hierarchy, spacing, responsive behavior, and clear primary actions. Keep admin console and teacher screens outside this pass unless the user wants an all-role refresh.
- Add a “Tài liệu của tôi” area linked from student navigation and/or course cards, with an upload action scoped to one of that student's enrolled courses.
- Keep learner uploads in a separate, clearly labeled “cá nhân / demo” collection so they do not silently appear as teacher-approved or class-wide course materials.
- In the current mock-only app, simulate progress and record document metadata only; state visibly that no file bytes leave the browser and that content is not available to real AI retrieval.
- Initially reuse the existing PDF/DOCX UI choices only for the demo interaction. Do not present these as accepted production formats until the document owner confirms the contract.
- Use plain language for file rules and status, keyboard-operable controls, visible focus, linked validation messages, and viewport/readability review.

### Assumptions

- Students may upload only to courses listed in their own `courseIds`; real server membership must eventually enforce this.
- “Upload” may mean adding a personal study document, not publishing course material. This interpretation needs user approval because visibility and retrieval behavior change the product and permission model.
- The UI redesign request is primarily about the learner experience. The report found no equivalent readability review for the admin workspace.

## Options and trade-offs

| Option | Behavior | Complexity / maintenance | Compatibility and security | Performance / cost / risk |
|---|---|---|---|---|
| **A. Student personal library, mock-only first** | Student chooses an enrolled course, selects a PDF/DOCX, sees simulated progress, and sees the item in a personal demo list. It is isolated from teacher/admin course materials and does not affect real AI answers. | Low; extends current SPA and local demo state. Reuses the existing upload interaction. | Fits current demo architecture. UI scope is explicit, but does not grant real server permission or transfer/store file bytes. | Low implementation cost and risk; useful for UX review. Main risk is users mistaking a demo action for a working upload unless labels remain clear. |
| **B. Student private course library, real upload** | Authenticated student uploads a supplemental file tied to an enrolled course. Only that student can access it; any use by the assistant is separately defined and filtered by owner/course. | Medium to high; requires a Document API, storage, ownership metadata, ingestion and lifecycle support, plus frontend integration. | Strongest initial real-product boundary: private supplemental materials do not contaminate shared course content. Backend must enforce membership, ownership, limits, and retrieval ACL. | Higher cost and dependency on Identity/Tenant/Document owners; appropriate if the request means real upload, not a mock UI action. |
| **C. Student contribution to shared course library with teacher review** | Student submits a file to the course; teacher approves or rejects it before it becomes shared/usable by course Q&A. | High; adds submission/review states, teacher queue, notifications or visible review workflow, and moderation ownership. | Safest path for class-wide use, but requires new cross-role and backend workflows. | Highest cost and risk; best only if shared class materials are the product goal. |

## Recommendation

The user clarified the direction after this report was drafted: refresh the UI for **student, teacher, and admin**, keep upload **simulated**, and keep student files **private to the student and in that student's personal assistant context**. Use Option A's isolated mock data model, expanded to all role interfaces. Any assistant answer/citation associated with an uploaded item must remain fixture-backed and visibly synthetic; the selected file bytes are not read or analyzed.

If the feature later changes to actual file transfer and storage, choose **Option B** and make API/authorization contracts an explicit dependency before frontend integration. Choose Option C only if the desired outcome changes to publication into shared course materials and teacher moderation is required.

## Edge cases

- Student has no enrolled courses; upload action must be unavailable with a helpful explanation.
- Student attempts to choose a course outside their assigned IDs; UI must not offer it, while server authorization must reject it in any real implementation.
- Empty library, large list, long/non-Latin filenames, and duplicate filenames.
- Unsupported or renamed extensions, zero-byte/oversize files, interrupted selection, and cancellation. Production checks must use agreed MIME/content/size limits rather than extension alone.
- Repeated submit or changing course while an upload is pending.
- Simulated or real transfer failure; keep the selected file/context when retry is possible and distinguish transfer from later processing.
- A private upload must not enter shared teacher/admin views, class documents, citations, or retrieval results without an explicit permission/review decision.
- Logout or switching persona/course must not leak a prior student's local files into another session. A real app also needs session/tenant cache isolation.
- Keyboard-only file selection, clear accessible name and error linkage, focus behavior for modal/dialog, touch-sized controls, and narrow/mobile layouts.

## Acceptance criteria

These are proposed and become binding only after the user approves a direction.

1. Student workspace text and hierarchy are readable at desktop, tablet, and narrow/mobile widths, with no horizontal page overflow at the tested widths.
2. Student navigation and course cards expose a clear route to the student's document library/upload.
3. A student can select only a course in their own course list; no unassigned course is offered in the UI.
4. Empty, selected-file, invalid-file, pending/progress, successful, and recoverable failure states are visible and understandable without relying on color alone.
5. In mock mode, success adds only safe metadata to that student's in-memory personal list; the UI states that the file bytes were not uploaded and do not feed real AI answers.
6. Student-created items remain isolated from teacher/admin shared course document lists and fixture citations.
7. Keyboard users can reach and operate the upload flow; labels and validation errors are programmatically associated, focus remains understandable, and focus indicators are visible.
8. `npm run typecheck --prefix apps/web` and `npm run build --prefix apps/web` pass. Critical upload and role-isolation interactions receive meaningful checks supported by the chosen test setup.
9. If the user selects real upload instead of demo-only, acceptance additionally requires a checked-in API contract, backend membership/ownership enforcement, server-approved format/size rules, and tests for denied course access and data isolation before calling the feature production-ready.

## Decisions recorded after review

1. **Scope of UI refresh:** resolved by user — include student, teacher, and admin.
2. **Meaning of upload:** resolved by user — simulated upload in the current demo.
3. **Visibility and AI use:** resolved by user — documents are private to the student and used in that student's personal assistant.

The remaining implementation detail is constrained by the mock-only architecture: the personal assistant can use synthetic fixture responses only; it cannot inspect actual selected file content. This limitation is recorded in the plan for approval.

## Workflow mapping

- **BA:** problem, actors, proposed journey, permission boundaries, states, and testable criteria are captured here.
- **Analyze:** Options A–C are compared and Option A is recommended for the current mock-only repository.
- The user approved the product direction above; no production API or backend authorization decision is implied.
