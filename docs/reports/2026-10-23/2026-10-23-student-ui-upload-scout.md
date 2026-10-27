# Student UI review and document upload — Scout

## 1. Request and scope as understood

User request: “syn lại main” was a prior turn; current request is “[$scout] … hãy khảo sát lại giao diện ui và cải thiện cho phù hợp với người dùng và 1 tính năng cần thêm là học sinh cũng có quyền up load tài liệu”. This scout covers the current student-facing UI, concrete usability/readability findings, and the proposed student document-upload capability. It does not implement changes.

## 2. Project overview, limited to this task

- **Verified:** `apps/web` is now a React 19 + TypeScript + Vite demo app with a login screen and separate student, teacher, and admin workspaces. `apps/web/package.json` contains `dev`, `build`, and `typecheck` scripts.
- **Verified:** The UI uses local CSS in `apps/web/src/styles.css`; no CSS framework or component library is declared in the web manifest.
- **Verified:** The frontend README states that data is synthetic and in-memory, there is no API connection, and selected file contents are not uploaded or persisted (`apps/web/README.md`).
- **Verified:** OpenAPI has `paths: {}` (`contracts/openapi/common.yaml`). Current Node service documentation says business endpoints are not implemented (`README.md`; `docs/architecture/service-boundaries.md`).
- **Stale documentation:** `docs/engineering/frontend-skill-discovery.md` describes `apps/web` as empty and records the earlier 2026-10-17 baseline. The live tree supersedes those frontend inventory claims. The existing role-based feature record documents the later app implementation (`docs/engineering/role-based-demo-feature-record.md`).

## 3. Git state, including base commit

- **Verified:** Current branch is `main`, HEAD `82157f1` (`Migrate SaaS platform to Node.js and align AI-01 handbook`), cached tracking ref is `origin/main` at the same commit. `git log -10 --oneline` returns only three commits; worktree list contains the current checkout.
- **Verified:** Existing changes are preserved: modified `.gitignore` and root `package.json`; untracked `.agents/`, `AGENTS.md`, `apps/`, `docs/engineering/`, and `docs/workflow/`. These are pre-existing work and include the frontend implementation. No source/configuration edits were made by this scout.
- **Verified:** `git ls-remote origin refs/heads/main` failed with `Could not resolve hostname github.com`; remote freshness is unknown. A prior fetch attempt in the preceding turn could not write `.git/FETCH_HEAD` under the sandbox. Do not use cached `origin/main` as proof it is current.

## 4. Relevant files and modules

- `apps/web/src/App.tsx`: app session dispatches student to `StudentWorkspace`, teacher to `TeacherWorkspace`, and admin to `AdminWorkspace`.
- `apps/web/src/pages/StudentWorkspace.tsx`: student navigation is currently Home, My Courses, AI Assistant, Q&A History, Account (lines 9–25); the workspace filters static fixtures by `user.courseIds` (lines 74–88) and routes to home/courses/assistant/history/account only (lines 132–138). There is no student document state or upload route.
- `apps/web/src/pages/StudentWorkspace.tsx`: student home shows course cards, ready-document counts, recent Q&A, and assistant entry points (roughly lines 145–177). Course cards do not expose document upload.
- `apps/web/src/pages/TeacherWorkspace.tsx`: teacher owns local document state and passes assigned documents/courses and upload/delete/reprocess callbacks to `DocumentsPage` (lines 29–62).
- `apps/web/src/pages/DocumentsPage.tsx`: shared PDF/DOCX demo upload with course selection, extension-only validation, simulated progress, and a callback that records filename/format/size/course ID; bytes are not sent. It also includes document search, status filters, detail, retry, and delete UI.
- `apps/web/src/data/mockData.ts`: five fixed course fixtures and eight fixed documents; document statuses are pending/processing/completed/failed.
- `apps/web/src/types.ts`: `LearningDocument` has course ID, PDF/DOCX, size, status, and extraction metadata, but no uploader, visibility, ownership, or submission-review metadata.
- `apps/web/src/components/RoleWorkspace.tsx`: shared role shell, role-specific navigation, visible demo disclosure, identity, and logout.
- `apps/web/src/styles.css`: student/teacher responsive styles and text sizing. Lines 1006–1057 apply a post-hoc readability override, but many student labels and supporting text remain 8–11px; some base/component declarations are 6–9px earlier in the file.
- `apps/web/README.md`: explicitly documents demo limitations and role quick-entry credentials.
- `contracts/openapi/common.yaml`: no paths; no upload/auth/course API contract.
- `docs/architecture/tenant-membership-ownership.md`, `docs/architecture/service-boundaries.md`, and `docs/architecture/kong-opa-authorization.md`: future service ownership and authorization boundaries; not evidence of existing upload permission enforcement.
- `docs/engineering/role-based-demo-feature-record.md`: previous acceptance assumptions and validation; records that browser review was unavailable at that time.

## 5. Existing implementation and conventions to follow

- **Verified:** Student and teacher personas are demo-only. Role-scoped navigation/data are presentational; the README says they do not enforce authorization.
- **Verified:** Teacher document management reuses the existing `DocumentsPage`. Current demo upload validates only filename extension and fakes progress; it stores file name/format/size in local state without reading or sending file bytes (`apps/web/src/pages/DocumentsPage.tsx`).
- **Verified:** Student course/document fixtures are derived from static initial data each render; uploaded docs from the teacher workspace are separate local state and therefore are not shared with the student fixture.
- **Verified:** `frontend-feature-workflow` is the repository workflow for a substantial frontend feature. `frontend-ui-engineering` applies to the UI review; `frontend-forms` to upload interaction and validation; `frontend-security` and `frontend-api-integration` apply if the flow handles actual files, API calls, sessions, or permissions.
- **Verified:** Skills require contract/handler evidence before production API integration. An explicitly requested prototype may use isolated mock adapters with a visible limitation. Do not treat role UI as authorization or invent accepted file types, limits, quotas, or course upload rights.
- **Assumption:** A student-upload action should be scoped to courses assigned to the current student, since those are the only courses shown by this demo. This does not answer whether uploaded material is private to that student, visible to the teacher, or shared with the class/AI retrieval index.

## 6. Commands available, plus baseline results

- **Verified from `apps/web/package.json`:** `npm run typecheck --prefix apps/web`, `npm run build --prefix apps/web`; `npm run dev --prefix apps/web`. Root scripts cover workspaces `packages/*` and `services/*`, not `apps/web`.
- No build, typecheck, or test was run in this read-only scout. The existing feature record reports historical typecheck/build success, but that is not a current baseline. The project has no frontend test script or browser test dependency in the web manifest.

## 7. Constraints, risks, assumptions, and open questions

1. **Student upload semantics are unresolved:** Is this a personal study file, a class-shared contribution, or a teacher-reviewed submission? Who can view it, delete it, and use it as a retrieval source? Does it become immediately queryable?
2. **Authorization contract is absent:** no auth/session/membership/upload endpoints or resource DTOs are in OpenAPI; backend services are skeletons. A live upload capability cannot be safely presented as real without those contracts and backend enforcement.
3. **File rules are unresolved:** demo currently allows PDF and DOCX based on extension; the RAG handbook/document assignment proposes text PDF processing. MIME, size, quota, duplicate handling, malware scanning, scan-PDF behavior, consent, and retention rules are not established for student submissions.
4. **Potential scope leak:** adding students to the shared teacher/admin document list could expose student contributions broadly or imply that they are already part of authoritative course learning material. Ownership and visibility must be decided before a shared list is used.
5. **Readability:** several end-user labels/body/supporting text remain below comfortable UI sizes (many 8–11px CSS declarations); responsive styles further reduce some text to 8–9px. This merits a hierarchy and zoom/viewport review rather than isolated enlargement alone.
6. **Validation gap:** the prior feature record reports that interactive browser review was unavailable. Current viewport, keyboard, screen-reader, and contrast evidence is not established by this scout.
7. **Git/remote:** worktree contains substantial user-created untracked frontend and guidance files. Preserve them. GitHub is currently unreachable from this environment, so main freshness remains unknown.

Open product decisions for BA/brainstorm:

- Upload destination: private to the student, visible to assigned teacher, or shared to the course?
- Allowed roles/targets: any enrolled student, only certain course states, or teacher approval before ingestion/use?
- Student actions: upload only, or view status/remove/retry/replace as well?
- Should the UI be mock-only for now, or wait for a real document API and permission contract?
- What audience devices and readability/accessibility target should define the UI refresh?

## 8. Recommended next step

Continue with `$brainstorm` / frontend BA and Analyze to settle the upload visibility and review model, UI-refresh scope, and mock-versus-live boundary. Then create and approve a plan before any implementation. For eventual UI work, apply `frontend-ui-engineering` and `frontend-forms`; apply `frontend-api-integration` and `frontend-security` if connected upload/session/permission behavior is in scope. Do not start implementation from this scout alone.

## Final state check

- Scout artifacts are the only new writes: this report and `docs/handoffs/2026-10-23-student-ui-upload.md`.
- No source or configuration file was changed. Existing worktree changes listed in section 3 were preserved.
