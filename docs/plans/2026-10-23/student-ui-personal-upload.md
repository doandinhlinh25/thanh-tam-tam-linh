# Plan: Improve all role UIs and add student personal document upload

- Task ID: `2026-10-23-student-ui-upload`
- Status: `APPROVED (by user, 2026-10-23)` <!-- DRAFT → APPROVED (by <who>, <YYYY-MM-DD>) → SUPERSEDED by <path> -->
- Inputs: [scout](../../reports/2026-10-23/2026-10-23-student-ui-upload-scout.md), [brainstorm](../../reports/2026-10-23/2026-10-23-student-ui-upload-brainstorm.md), [handoff](../../handoffs/2026-10-23-student-ui-upload.md), `apps/web` current source, OpenAPI and frontend workflow skills
- Baseline: `main` at `82157f1` (local; remote freshness unverified)

## 1. Objective and background

Improve the existing learner, teacher, and organization-admin demo UI for readability, responsive use, and clearer actions. Add a simulated student upload experience for personal documents, and expose those personal documents to that student's own mock assistant context.

The app has no document, chat, or auth API contract. Student files and assistant use must remain simulated, session-local, and isolated from other demo roles. The assistant must not claim to have read file bytes: demo answers and citations may be fixtures only, clearly labeled as mock content.

## 2. Scope and non-goals

### In scope

- Improve common visual foundations, typography, spacing, page hierarchy, control readability, focus and responsive behavior across login, student, teacher, and admin workspaces.
- Preserve role-specific navigation and the current tasks for each persona while improving consistency and usability.
- Add student personal document library/upload controls, scoped to the student's enrolled course list.
- Model upload progress and outcomes in memory only; retain safe metadata (file name, format, size, course, demo status) and avoid retaining or transmitting file bytes.
- Add student personal documents to that same student's mock assistant context. Any answer or source linked to an uploaded item must use explicit synthetic fixture content and disclose that the selected file itself was not analyzed.
- Keep personal student documents separate from teacher/admin shared course materials, other student personas, and shared fixture citations.

### Out of scope

- Real file transfer, persistence, storage, ingestion, scanning, quotas, server-side authorization, or a production document upload API.
- Publishing student files to classmates, teachers, or the shared course corpus; approval/review workflows.
- Claiming that the mock AI processed uploaded bytes, inventing real citations, or showing private student documents in teacher/admin views.
- New LMS functions such as lesson progress or assignments.
- Backend service or OpenAPI changes.

## 3. Current-state findings

- `apps/web` is a React 19, TypeScript, Vite application with `dev`, `typecheck`, and `build` scripts in `apps/web/package.json`.
- `App.tsx` dispatches login sessions to distinct student, teacher, and admin workspaces; admin page state is held in `AdminWorkspace`.
- Student navigation/home/chat are in `pages/StudentWorkspace.tsx`; student courses are filtered by `user.courseIds`. No student document state or upload route exists.
- Teacher upload and shared document management are implemented through `pages/TeacherWorkspace.tsx` and `pages/DocumentsPage.tsx`; upload is simulated and currently stores metadata only.
- `RoleWorkspace.tsx` is the role-based shell. `Primitives.tsx` provides shared buttons, forms, modal, table helpers, badges, and empty states.
- `styles.css` contains all CSS. Several admin, teacher, and student secondary text declarations use 6–11px, including small mobile overrides; no formal design token package or CSS framework exists.
- `data/mockData.ts` contains the shared fixture courses/documents; `data/demoData.ts` contains demo accounts and fixed chat answers. `types.ts` has no personal document ownership/context model.
- `apps/web/README.md` discloses that the app is a mock and does not send uploaded bytes. `contracts/openapi/common.yaml` has `paths: {}`; service docs describe document/chat APIs as future work.
- Git state is dirty with existing user work, including modified root `.gitignore` and `package.json` and untracked `.agents/`, `AGENTS.md`, `apps/`, and docs. Do not overwrite or clean it.
- `git ls-files apps/web` returns no tracked paths: the entire current web app is untracked worktree content and is absent from commit `82157f1`. Preserve this app when establishing any future feature branch; simply checking out or creating a branch at the current baseline will not include it.
- GitHub was unreachable during scout (`git ls-remote` DNS failure); `main`/`origin/main` matching `82157f1` is cached state only.

## 4. Proposed design

1. Keep current role boundaries and mock architecture. Improve the shared visual system in the existing CSS/primitives and apply it to the login, student, teacher, and admin screens without introducing a UI framework.
2. Extend the student workspace with a dedicated “Tài liệu cá nhân” destination. Students can add a metadata-only mock file to one of their enrolled courses, inspect its simulated status, and remove it from their current in-memory session. Use clear labels that it is private to this student and only exists in the demo session.
3. Keep personal docs in a student-workspace state/store keyed by the current `user.id`; do not write them into `initialDocuments` or pass them to teacher/admin document views. Workspace unmount/logout clears this ephemeral state.
4. Pass the current student's personal document metadata into that student's assistant. The context UI distinguishes course fixture sources from personal demo sources. Fixed demo responses may use an explicitly marked synthetic answer/source associated with a personal document fixture; they never parse the selected file. If there is no corresponding fixture, return the existing insufficient-evidence demo state rather than fabricate an answer or citation.
5. Reuse existing upload form concepts but keep student controls focused: course selection restricted to enrolled courses, known demo format selection, validation errors, progress/cancel, success and empty states. As current limits are not contracted, any demo-only size/type rule must be clearly identified as a prototype convention and not as a backend guarantee.
6. Keep all file names and assistant content rendered as inert text. No file bytes, account credentials, or personal document state enter browser storage, network calls, or logs.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `apps/web/src/styles.css` | Readability scale, spacing, responsive and interaction refinements across all roles | T1, T4, T5 |
| `apps/web/src/components/Primitives.tsx` | Refine shared components only where shared control behavior/visual needs justify it | T1, T2 |
| `apps/web/src/components/RoleWorkspace.tsx` | Improve teacher/student shell hierarchy, navigation and mobile behavior | T2 |
| `apps/web/src/components/AuthPage.tsx` | Align login/sign-up visual hierarchy and form readability to shared system | T2 |
| `apps/web/src/App.tsx` | Preserve separate admin data and session boundaries; only change for shared presentation if needed | T2, T5 |
| `apps/web/src/pages/StudentWorkspace.tsx` | Add personal library navigation, session-local owner-scoped upload state and assistant source context | T3, T4 |
| `apps/web/src/pages/StudentDocumentsPage.tsx` (new) | Student personal document list, upload interaction and empty/pending/success/failure states | T3 |
| `apps/web/src/types.ts` | Add a personal mock-document/context type with explicit ownership/scope metadata as needed | T3, T4 |
| `apps/web/src/data/demoData.ts` | Add fixed synthetic assistant examples for explicitly marked personal-document scenarios | T4 |
| `apps/web/src/pages/TeacherWorkspace.tsx` | Apply refreshed hierarchy and clearer assigned-course/document actions | T5 |
| `apps/web/src/pages/OverviewPage.tsx` | Improve admin overview readability and visual hierarchy | T5 |
| `apps/web/src/pages/DocumentsPage.tsx` | Improve admin shared-doc table/filter/upload readability without exposing student personal docs | T5 |
| `apps/web/src/pages/CoursesPage.tsx` | Improve admin course list/form hierarchy and responsive behavior | T5 |
| `apps/web/src/pages/EvaluationPage.tsx` | Improve admin evaluation screen readability | T5 |
| `apps/web/src/pages/FeedbackPage.tsx` | Improve admin feedback list/detail readability | T5 |
| `apps/web/src/pages/SettingsPage.tsx` | Improve admin settings form readability and responsive behavior | T5 |
| `apps/web/README.md` | Explain simulated student upload, private session scope, and assistant's synthetic-only use | T6 |
| `docs/handoffs/2026-10-23-student-ui-upload.md` | Record approved direction, implementation and test evidence | T6 |

## 6. Ordered implementation tasks

Single implementation owner; do not split tasks concurrently because shared CSS, shells, and page primitives overlap. Each task depends on the prior task unless noted.

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Establish a readable shared CSS scale and refine common primitives. Set minimum readable type sizes for body/supporting text, consistent headings/spacing, visible keyboard focus, adequate target sizing, reduced-motion handling where animation is present, and responsive overflow behavior. Avoid an unrelated wholesale redesign. | `apps/web/src/styles.css`, `apps/web/src/components/Primitives.tsx` | Inspect actual computed/source styles at narrow, tablet, and desktop breakpoints; `npm run typecheck --prefix apps/web` | Existing primitives retain behavior; common typography and controls are consistently readable; no type errors. | None |
| T2 | Apply the shared visual language to auth and reusable role shells; improve navigation readability, active states, identity, demo disclosure, and mobile navigation while retaining role boundaries. | `apps/web/src/components/AuthPage.tsx`, `apps/web/src/components/RoleWorkspace.tsx`, `apps/web/src/styles.css`, `apps/web/src/components/Primitives.tsx` | `npm run typecheck --prefix apps/web`; keyboard walkthrough of login and role navigation | Login, student, and teacher shared shell controls are legible and keyboard operable at target widths. | T1 |
| T3 | Implement the student personal document library and simulated upload. Scope course choices to `user.courseIds`; hold only metadata in owner-scoped workspace state; add empty, selected, invalid, progress/cancel, success, and removal states; disclose private/demo-only behavior. | `apps/web/src/pages/StudentWorkspace.tsx`, new `apps/web/src/pages/StudentDocumentsPage.tsx`, `apps/web/src/types.ts`, `apps/web/src/styles.css` | `npm run typecheck --prefix apps/web`; manually exercise empty course list, valid/invalid selection, cancel, success, and delete | Personal documents are created only in current student's in-memory scope; no file bytes or shared document fixture are mutated. | T1, T2 |
| T4 | Connect personal demo document context to the same student's assistant. Distinguish course fixtures and personal mock sources; allow only fixed synthetic examples to answer/cite personal documents; retain insufficient-evidence behavior for unsupported content; ensure logout/unmount clears all personal state. | `apps/web/src/pages/StudentWorkspace.tsx`, `apps/web/src/data/demoData.ts`, `apps/web/src/types.ts`, `apps/web/src/styles.css` | `npm run typecheck --prefix apps/web`; manually check assistant with/without personal docs, synthetic citation label, no-citation refusal, and login as a different persona | Assistant context includes only current student's personal document metadata and fixed demo content; no claim that bytes were analyzed; no cross-persona/shared-list leakage. | T3 |
| T5 | Apply the common design system to teacher and all admin pages while preserving their existing actions, role scope, and fixture data. Refactor only repeated style patterns needed for consistency. | `apps/web/src/pages/TeacherWorkspace.tsx`, `OverviewPage.tsx`, `DocumentsPage.tsx`, `CoursesPage.tsx`, `EvaluationPage.tsx`, `FeedbackPage.tsx`, `SettingsPage.tsx`, `apps/web/src/App.tsx` (only if required), `apps/web/src/styles.css` | `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; walkthrough of all teacher/admin navigation and primary actions | All three roles use the improved visual language; teacher/admin existing task flows still operate; personal student files remain absent from shared admin/teacher documents. | T1, T2 |
| T6 | Update docs and complete scoped verification/handoff. Inspect diff and ensure no unrelated existing work was changed. | `apps/web/README.md`, `docs/handoffs/2026-10-23-student-ui-upload.md` | `git diff --check`; `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; manual responsive/keyboard walk as available | Demo limitations and student-private assistant behavior are documented accurately; checks and unavailable browser/accessibility coverage are reported honestly. | T3, T4, T5 |

## 7. Dependencies and prerequisites

- **Product direction approved by user:** refresh student, teacher, and admin experiences; upload is simulated; student files are private and intended for that student's personal assistant.
- **Demo behavior constraint:** because the user selected simulated upload and no Document/Chat API exists, the assistant can only use fixed synthetic examples. The actual selected file content is unavailable. Do not call this real private storage or real document-grounded AI.
- **Backend dependency deferred:** a later real-upload version requires versioned Document API routes/DTOs, Identity/Tenant course membership and ownership decisions, upload validation/limits, storage and ingestion semantics, chat source authorization, and backend authorization tests. No backend work is part of this plan.
- **Git prerequisite before Cook:** this is substantial frontend work. Per `frontend-git-flow`, a feature branch must start from verified latest `main`, and the branch-creation worktree must be clean. The current checkout has substantial pre-existing changes; all of `apps/web` is untracked and absent from base commit `82157f1`; remote freshness is unverified because GitHub DNS failed. Before Cook, preserve and deliberately carry the current app into an approved clean feature worktree after the remote/baseline is verified, or obtain an explicit user decision to use another safe branch policy. Do not reset, clean, stash, or overwrite the current worktree.
- **No parallel implementation:** files are highly shared (`styles.css`, role shell, student state); use one owner. No coordination artifact needed.

## 8. Testing and verification strategy

`apps/web/package.json` has only `typecheck` and `build`; it has no lint or test script, and no browser/component test framework is configured. Do not use root checks as frontend checks. During the later `$test` stage, run the existing frontend typecheck/build and perform a focused manual interaction/viewport/keyboard walkthrough if a browser is available. Report any unavailable browser, screen-reader, or contrast automation honestly. No result is claimed by this plan.

| Acceptance criterion | Check | Level (unit/integration/e2e/manual) |
| --- | --- | --- |
| AC1 readable refreshed UI across all three roles | Inspect rendered login/student/teacher/admin views at narrow, tablet, desktop and zoom; review computed text sizes/contrast and page overflow | manual visual/accessibility |
| AC2 student can navigate to personal library/upload | Keyboard and pointer walkthrough from student home, course and navigation | manual interaction |
| AC3 only enrolled courses can be selected | Review rendered choices against current user's `courseIds`; try each demo persona including no-course fixture if supported | manual/source |
| AC4 upload state and validation coverage | Exercise no selection, invalid extension, chosen file, cancel, simulated progress/success and remove; screen-reader status semantics source/manual check | manual interaction/accessibility |
| AC5 demo disclosure and metadata-only operation | Inspect UI text and code path; verify no file bytes are read, persisted, or sent | source/security review |
| AC6 private document isolation and assistant scope | Upload as student A, inspect teacher/admin shared list, logout/login as student B, inspect assistant sources/citations | manual integration within demo |
| AC7 personal assistant only gives fixed synthetic answers/citations for supported fixtures | Exercise supported mock fixture and unsupported question; inspect source label and refusal/citation state | manual interaction |
| AC8 all roles retain core tasks and app compiles | `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; navigate teacher/admin existing flows | build + manual regression |
| AC9 documentation reflects actual demo behavior | Review README against UI, then `git diff --check` | docs + diff check |

## 9. Risks and mitigations

- **Mock assistant may be mistaken for file analysis:** keep persistent demo disclosure near upload and assistant source context; only use fixture-backed synthetic answers and label sources synthetic.
- **Personal material leaks into shared course material:** keep separate student-only type/state/page; do not write to `initialDocuments` or share callbacks. Verify with role switching and logout.
- **Broad CSS changes regress existing pages:** establish common type/spacing tokens first, change in ordered slices, inspect each role, and preserve all current actions.
- **No automated frontend test framework:** use existing typecheck/build and manual checks in `$test`; do not report manual checks as automated coverage.
- **No branch from verified main currently:** gate Cook on safe Git preflight; preserve all dirty/untracked work.
- **No actual upload authorization:** this plan is demo-only. Any future production version must revisit the API/backend contract and server-side permission model.

## 10. Acceptance criteria

- [ ] AC1: Student, teacher, and admin workspaces use a coherent, readable visual hierarchy with usable typography, spacing, controls, and responsive layouts at narrow, tablet, and desktop widths.
- [ ] AC2: A student can find and open a personal document library from the learner workspace and start a simulated upload.
- [ ] AC3: Upload course options are limited to the current student's enrolled courses.
- [ ] AC4: The upload interaction has clear empty, file-selected, validation-error, pending/progress, canceled, success, and remove states; keyboard and assistive technology users can identify controls/status/errors.
- [ ] AC5: The UI clearly states that upload is simulated, file bytes are not sent or retained, and real AI does not inspect the selected file.
- [ ] AC6: Personal document metadata is private to that student's current demo session and is excluded from teacher/admin shared document views and other student sessions.
- [ ] AC7: The student's mock assistant context can reference only that student's personal-document fixture sources alongside the intended selected-course context; supported answers/citations are fixed and visibly synthetic; unsupported content does not receive invented citations.
- [ ] AC8: Existing teacher/admin primary flows continue to work, and frontend typecheck/build pass.
- [ ] AC9: README and handoff accurately describe demo limitations and verification results; final diff contains no unrelated edits.

## 11. Rollback or recovery

- Keep all changes limited to the files listed in section 5; never use `git reset`, `git clean`, or broad checkout commands in this dirty worktree.
- If the student assistant integration risks mixing personal and shared documents, remove the personal source adapter/assistant hook-up while retaining the isolated personal demo list, then revise AC7 and get approval before proceeding.
- If shared CSS changes regress a role, revert only the corresponding scoped CSS/component hunk, preserve prior user edits, and re-check all three roles.
- If branch preflight cannot be satisfied, do not begin Cook under the latest-main requirement. Preserve this plan and ask for an approved branch/worktree policy or wait for remote availability.
- No migrations or backend changes are planned, so no data rollback is required.

## 12. Completion checklist

- [ ] All tasks done or explicitly deferred with approval
- [ ] Acceptance criteria verified by `$test` with evidence
- [ ] `$review` decision recorded
- [ ] Docs updated with actual simulation limitations
- [ ] Handoff updated with implementation, check results, risks, and next action
