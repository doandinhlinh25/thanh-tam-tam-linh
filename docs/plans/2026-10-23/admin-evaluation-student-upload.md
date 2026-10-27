# Plan: Improve all role pages, add student uploads, and fix demo AI evaluation

- Task ID: `2026-10-23-admin-evaluation-student-upload`
- Status: `APPROVED (by user, 2026-10-23)` <!-- DRAFT → APPROVED (by <who>, <YYYY-MM-DD>) → SUPERSEDED by <path> -->
- Inputs: [scout](../../reports/2026-10-23/2026-10-23-admin-evaluation-student-upload-scout.md), [brainstorm](../../reports/2026-10-23/2026-10-23-admin-evaluation-student-upload-brainstorm.md), [handoff](../../handoffs/2026-10-23-admin-evaluation-student-upload.md), [prior approved student-upload plan](./student-ui-personal-upload.md), current source and manifests, `contracts/openapi/common.yaml`
- Baseline: `thanh/init-fe` at `1056c71` (user explicitly selected this existing branch; remote `main` freshness is unverified)

## 1. Objective and background

Improve the student, teacher, and organization-admin experiences across all pages for readability, responsive use, and clearer actions; add a private, simulated student document library/upload; and make the admin AI-evaluation demo repeatable and internally consistent.

The selected evaluation approach is **Option B**: deterministic, fixture-backed demo results. The current app has no evaluation runner or API, so neither UI nor documentation may imply a real model was evaluated. The student upload direction reuses the prior user-approved plan: metadata-only, private to the current demo session, and never represented as actual file processing.

## 2. Scope and non-goals

### In scope

- Improve common typography, spacing, page hierarchy, controls, focus indication and responsive behavior across login/signup, student, teacher and admin pages.
- Preserve each role's existing navigation and primary actions.
- Add a student personal document destination and simulated upload restricted to courses in the current user's `courseIds`.
- Keep student document metadata in ephemeral student-workspace state; exclude it from shared teacher/admin document state and other personas.
- Show personal demo-document context only to that student's mock assistant. Use fixture-backed synthetic answer/citation content only; never read the selected file bytes or claim the file was processed.
- Correct evaluation score units/display and use deterministic per-question fixture results. Derive the answer-quality aggregate from evaluated question scores. Keep other explicitly illustrative metrics fixture-backed and visibly demo-only.
- Preserve evaluation-set creation, question entry and export. Mark user-added questions without a matching mock result as unevaluated rather than assigning a fabricated score.
- Update demo documentation and handoff to describe actual behavior and limitations.

### Out of scope

- Real student file transfer, browser/server persistence, object storage, ingestion, scanning, quota, authorization or production upload APIs.
- A real AI/model evaluation runner, backend endpoints, model-provider integration, durable results or API/DB schema changes.
- Making student personal documents visible in teacher/admin shared material lists or the class corpus.
- Claiming the assistant read selected file contents, or fabricating citations for them.
- New LMS capabilities such as lesson progress or assignments; new frontend dependencies; automatic commit, push, merge or PR.

## 3. Current-state findings

- **Verified:** `apps/web` is React 19 + TypeScript + Vite with `dev`, `typecheck`, and `build` scripts in `apps/web/package.json`.
- **Verified:** `App.tsx` dispatches session roles to separate student, teacher and admin workspaces. Student pages are in `StudentWorkspace.tsx`; teacher pages use `TeacherWorkspace.tsx`; admin pages are selected in `App.tsx` and implemented under `pages/`.
- **Verified:** Student workspace currently has home, courses, assistant, history and account pages and no personal upload route/state (`StudentWorkspace.tsx`). Course/document fixtures are filtered using `user.courseIds`.
- **Verified:** Teacher/admin `DocumentsPage` supports PDF/DOCX metadata-only upload with simulated progress; its UI says file content is not uploaded (`DocumentsPage.tsx`).
- **Verified:** `EvaluationPage` presents a simulated progress interval and the admin handler randomly changes only answer quality (`EvaluationPage.tsx`, `App.tsx`). Seeded per-question score decimals are rendered with `%`; newly-added questions start at score zero (`mockData.ts`, `App.tsx`).
- **Verified:** `contracts/openapi/common.yaml` declares `paths: {}`; no frontend-facing evaluation, upload, chat or auth API is defined.
- **Verified:** The user chose current branch `thanh/init-fe`, currently at `1056c71`. Local `main`/cached `origin/main` is `82157f1`; remote `main` could not be queried because GitHub DNS failed. Worktree had only this task's untracked scout/brainstorm/handoff files at planning time; preserve these files.
- **Constraint:** Root `AGENTS.md` asks for staged work and frontend workflow. The user explicitly selected the existing branch, so this task follows that branch policy without creating/switching branches or modifying `main`.

## 4. Proposed design

1. Use the current CSS and shared primitives to establish a readable, consistent visual hierarchy and keyboard/focus behavior, then apply it across login and all student, teacher, and admin pages without replacing the product structure.
2. Add a student-only personal library view. Keep upload state local to the mounted student workspace and metadata-only. Use the enrolled-course list for course selection. Provide explicit simulated/private messaging, validation, progress/cancel, success and removal states.
3. Keep personal source metadata separate from `initialDocuments`. Pass the current student's personal documents to their assistant context only. Associate any supported response with fixed synthetic fixtures; retain insufficient-evidence behavior for unsupported questions. Do not make actual selected file content available to the assistant.
4. Standardize displayed question scores as percentage points (0–100), including converting current fixture fractions (for example, `0.94`) to `94`. Represent missing results as not evaluated. Use predefined results keyed to seeded questions; results are deterministic. Calculate answer-quality aggregate from the evaluated per-question scores. Keep recall/citation/refusal values explicitly labeled fixture metrics unless a matching deterministic fixture result is defined.
5. Ensure repeated evaluation runs with the same dataset return the same fixtures, update results/history coherently, and cannot overlap. Clean up the simulated progress timer on unmount. An empty set cannot run.
6. Retain all current admin/teacher/student primary flows, label demo state accurately, and do not add network/API behavior.

## 5. Files and components affected

| Path | Change | Task |
| --- | --- | --- |
| `apps/web/src/styles.css` | Shared readability, spacing, responsive behavior, focus and role/page refinements | T1, T2, T3, T4, T5 |
| `apps/web/src/components/Primitives.tsx` | Shared control improvements only where needed by all pages | T1 |
| `apps/web/src/components/AuthPage.tsx` | Apply shared hierarchy/readability to login and signup | T2 |
| `apps/web/src/components/RoleWorkspace.tsx` | Improve role navigation, identity, demo disclosure and responsive shell | T2 |
| `apps/web/src/pages/StudentWorkspace.tsx` | Personal-document state/navigation, assistant source context, student page polish | T3 |
| `apps/web/src/pages/StudentDocumentsPage.tsx` (new) | Student personal document list and metadata-only simulated upload | T3 |
| `apps/web/src/types.ts` | Personal demo document and unevaluated/evaluation result types as required | T3, T5 |
| `apps/web/src/data/demoData.ts` | Fixed synthetic assistant examples; no selected-file content | T3 |
| `apps/web/src/pages/TeacherWorkspace.tsx` | Apply shared visual language while retaining role flows | T4 |
| `apps/web/src/pages/OverviewPage.tsx` | Admin overview visual hierarchy/responsive refinements | T4 |
| `apps/web/src/pages/DocumentsPage.tsx` | Admin shared-doc page refinements; preserve student-data boundary | T4 |
| `apps/web/src/pages/CoursesPage.tsx` | Admin course-page hierarchy and responsive refinements | T4 |
| `apps/web/src/pages/FeedbackPage.tsx` | Admin feedback-page readability and responsive refinements | T4 |
| `apps/web/src/pages/SettingsPage.tsx` | Admin settings-page readability and responsive refinements | T4 |
| `apps/web/src/pages/EvaluationPage.tsx` | Score/result states, deterministic run UI, accessibility and page styling | T5 |
| `apps/web/src/App.tsx` | Wire student upload route and deterministic evaluation handlers/results | T3, T5 |
| `apps/web/src/data/mockData.ts` | Normalize evaluation fixtures and define deterministic result fixtures | T5 |
| `apps/web/README.md` | Explain private simulated student upload and deterministic simulated evaluation | T6 |
| `docs/handoffs/2026-10-23-admin-evaluation-student-upload.md` | Record Cook/Test/Review outcomes and limitations | T6 |

## 6. Ordered implementation tasks

Single implementation owner; tasks share CSS, workspace state and shared fixture types and should be performed sequentially.

| ID | Task | Files | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Establish shared readable typography/spacing/focus/target-size/responsive rules and refine reusable primitives only where justified. | `styles.css`, `components/Primitives.tsx` | `npm run typecheck --prefix apps/web`; source/render inspection at narrow, tablet and desktop widths | Shared foundation is readable and existing primitive behavior is preserved. | None |
| T2 | Apply shared UI foundations to login and role shells; refine page hierarchy/readability across student, teacher and admin page content while preserving actions. | `AuthPage.tsx`, `RoleWorkspace.tsx`, `StudentWorkspace.tsx`, `TeacherWorkspace.tsx`, `OverviewPage.tsx`, `DocumentsPage.tsx`, `CoursesPage.tsx`, `FeedbackPage.tsx`, `SettingsPage.tsx`, `styles.css` | Typecheck; keyboard walkthrough of login and role navigation; responsive source/render review of every page | All role pages use the agreed visual language, remain navigable and retain current primary actions. | T1 |
| T3 | Add student personal library and metadata-only simulated upload scoped to enrolled courses. Keep state isolated to student workspace; add validation/progress/cancel/success/removal states and clear private/demo messaging. Add only fixture-backed assistant examples and source labeling; preserve insufficient-evidence for unsupported content. | `StudentWorkspace.tsx`, new `StudentDocumentsPage.tsx`, `types.ts`, `demoData.ts`, `styles.css` | Typecheck; manual exercise for valid/invalid selection, no courses, cancel, success/remove, assistant fixture/refusal, logout and other-role isolation | Upload is accessible and only stores metadata in the current student workspace; no selected file bytes are read/sent/persisted; no cross-persona/shared view leakage. | T1, T2 |
| T4 | Finish teacher and admin page visual refinements, preserving existing role-scoped fixtures/actions and ensuring no student personal document appears in shared lists. | `TeacherWorkspace.tsx`, `OverviewPage.tsx`, `DocumentsPage.tsx`, `CoursesPage.tsx`, `FeedbackPage.tsx`, `SettingsPage.tsx`, `styles.css` | Typecheck/build; navigate each teacher/admin page and exercise its current main action; inspect shared-document list | All teacher/admin pages are legible and responsive; role boundaries and existing flows remain intact. | T1, T2, T3 |
| T5 | Implement deterministic evaluation result fixtures and consistent score/result UI. Normalize scores to 0–100; show unevaluated status; derive answer-quality aggregate from evaluated question scores; keep other named demo metrics explicitly fixture-backed. Prevent duplicate/empty runs and clean up timer. Preserve dataset editing and export. | `types.ts`, `data/mockData.ts`, `pages/EvaluationPage.tsx`, `App.tsx`, `styles.css` | Typecheck/build; repeat-run same fixture dataset and compare per-question/summary/export values; empty set, added question without fixture, duplicate click/unmount timer, CSV/JSON walkthrough | Same dataset gives identical visible demo output; answer-quality equals evaluated-question average; no random mutations or false claim of real model execution. | T1, T2 |
| T6 | Update README and handoff; inspect scoped diff; complete frontend checks and report unavailable manual/browser checks. | `apps/web/README.md`, task handoff | `git diff --check`; `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; manual responsive/keyboard/role isolation walkthrough | Docs match the UI; checks and limitations are recorded; no unrelated files changed. | T3, T4, T5 |

## 7. Dependencies and prerequisites

- **Approved product decisions:** Option B deterministic, fixture-backed demo evaluation; scope covers all pages/roles; work stays on existing `thanh/init-fe`; student upload remains the previously approved private, metadata-only demo flow.
- **Branch policy:** Work in place on `thanh/init-fe` as explicitly requested. Do not create/switch branches, advance `main`, fetch or mutate remote refs, or rewrite history as part of Cook. The remote `main` freshness limitation is recorded; the explicit user choice supersedes the previous new-branch prerequisite for this task.
- **API/backend:** No service/API changes are part of this plan. A future real upload or real evaluation requires versioned contracts and backend authorization/runner work before frontend integration.
- **Specialist skills for Cook:** Open and follow `frontend-ui-engineering`, `frontend-forms`, `frontend-security`, `frontend-architecture`, and `frontend-testing` as applicable. Use `frontend-api-integration` only to validate that no endpoint should be invented; do not integrate an API.
- **Dependencies/tooling:** Use existing `apps/web` scripts only. No dependency installation or new package is planned.
- **User work preservation:** Preserve all existing files. Current task scout/brainstorm reports and handoff are untracked local work and must not be removed or overwritten. No parallel implementation because files/state overlap heavily.

## 8. Testing and verification strategy

`apps/web/package.json` provides `typecheck` and `build`; it has no lint/test script or configured browser automation. Run checks in the later `$test` stage, not during planning. Root commands do not validate the frontend.

| Acceptance criterion | Check | Level (unit/integration/e2e/manual) |
| --- | --- | --- |
| AC1 all pages use readable, consistent and responsive hierarchy | Inspect login/signup, every student/teacher/admin page at narrow/tablet/desktop; inspect overflow, focus, control size and text hierarchy | manual visual/accessibility |
| AC2 student can find and use personal upload library | Keyboard/pointer walkthrough from student navigation/home/course | manual interaction |
| AC3 upload targets only enrolled courses and handles no-course state | Compare selector options with each demo account `courseIds`; exercise empty-course state | manual/source |
| AC4 selection/validation/progress/cancel/success/remove are accessible | Exercise empty, PDF/DOCX and invalid selections, progress, cancel, success, removal; inspect focus and announced errors/statuses | manual/accessibility |
| AC5 file bytes are never read, persisted or sent | Inspect upload path for FileReader/arrayBuffer/network/storage use; inspect metadata state path | source/security review |
| AC6 personal docs remain isolated from other users and shared material | Upload as student A, inspect assistant; logout/login as student B; inspect teacher/admin document page | manual isolation + source |
| AC7 assistant never claims to analyze selected file or fabricates a citation | Exercise supported fixture and unsupported content; inspect labels, citations and refusal | manual interaction |
| AC8 evaluation question scores use consistent percentage units and unevaluated state | Inspect initial fixtures and add a question before/after a run; compare visible values | manual/source |
| AC9 same evaluation set produces deterministic output; answer-quality matches evaluated scores | Run twice and compare question rows, metric and exports; calculate displayed mean against results | manual/data consistency |
| AC10 empty/duplicate/unmounted run cases are safe | Attempt run with empty set, double submit during progress, and leave page during run | manual interaction |
| AC11 existing page actions and role flows remain available | Walk through course/document/feedback/settings/student chat/admin evaluation primary actions | manual regression |
| AC12 typecheck and build pass; docs disclose demo boundaries | `npm run typecheck --prefix apps/web`; `npm run build --prefix apps/web`; review README and `git diff --check` | build + docs |

## 9. Risks and mitigations

- **Demo mistaken for real evaluation:** Keep persistent explicit copy near metrics and run progress; use deterministic fixed fixtures only; do not add provider/API requests.
- **Personal student content leaks:** Keep personal state/page separate from `initialDocuments` and teacher/admin callbacks; test role switching and logout.
- **AI claims selected file content:** Never parse or read file bytes. Only fixed synthetic source fixtures can be cited, with a nearby disclosure.
- **All-page CSS changes regress layouts/actions:** Establish shared rules first, keep page changes scoped, and walk every role/page after applying styles.
- **Question and summary metrics drift:** Define a single 0–100 unit, mark missing scores unevaluated, and calculate answer-quality from evaluated question values; verify exports use the same representation.
- **No automated UI tests:** Typecheck/build are the only current automated frontend checks. Report browser, keyboard and assistive-technology coverage honestly in Test.
- **Remote freshness unknown:** Continue only on the user-selected current branch; do not claim it is current with upstream `main`.

## 10. Acceptance criteria

- [ ] AC1: Login/signup and all student, teacher and admin pages have readable, consistent hierarchy and usable narrow/tablet/desktop layouts.
- [ ] AC2: Student can navigate to a personal document library and simulate upload for one of their enrolled courses.
- [ ] AC3: The upload flow has accessible empty, selection, validation, progress/cancel, success and remove states; no-course users get a helpful empty state.
- [ ] AC4: Student uploads are private session-local metadata only; file bytes are not read, persisted or transmitted and do not appear in teacher/admin shared documents or another student's session.
- [ ] AC5: Student assistant can show only fixed synthetic personal-document examples; it never claims to have processed the selected file and unsupported questions get no invented citation.
- [ ] AC6: Evaluation scores use 0–100 consistently; unevaluated questions are visibly distinct from scored questions.
- [ ] AC7: Same evaluation data produces the same fixture-backed per-question output on every run; answer-quality equals the mean of evaluated questions; other summary metrics are labeled illustrative fixtures.
- [ ] AC8: Empty sets cannot run; duplicate runs are prevented; progress/timer state recovers on page unmount; existing set/question/export actions remain usable.
- [ ] AC9: Existing role-specific primary flows continue to work and frontend typecheck/build pass.
- [ ] AC10: README/handoff accurately state demo behavior; final scope contains no unrelated changes.

## 11. Rollback or recovery

- Keep all changes within the listed frontend and task documentation paths. Do not use `git reset`, `git clean`, broad checkout, branch switching, or history rewrite on the user-selected branch.
- If the personal assistant integration risks crossing data boundaries, disable the personal synthetic source adapter while retaining a separate upload list, then revise acceptance criteria before proceeding.
- If a shared CSS change breaks a page, revert only the offending scoped hunk and recheck all roles; preserve all prior work.
- If deterministic evaluation results cannot remain coherent with the summary, retain truthful static fixture results and remove the misleading run mutation; do not add a fake live AI request.
- If implementation reveals a need for real APIs, storage, or evaluation, stop that scope and create a separate backend/contract plan before integration.

## 12. Completion checklist

- [ ] All tasks done or explicitly deferred with approval
- [ ] Acceptance criteria verified by `$test` with evidence
- [ ] `$review` decision recorded
- [ ] Docs accurately describe mock behavior and limitations
- [ ] Handoff updated with implementation, checks, risks and next action
