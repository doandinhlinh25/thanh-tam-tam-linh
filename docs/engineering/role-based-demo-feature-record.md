# Role based frontend demo feature record

Status: **Implemented; typecheck/build and role-scoping render smoke passed; interactive browser review unavailable**  
Date: 2026-10-17

## Scout

- Request: make the existing `apps/web` demo feel like a complete product with login, sign up, and clearly separated student, teacher, and admin experiences.
- Git: current branch is `main` at `82157f1`; current worktree contains user-created untracked frontend and skill-system work plus a root `package.json` edit. Remote freshness was previously unverified because DNS failed. The user explicitly authorized continuing on the current `main`; do not branch, commit, or push.
- Frontend: standalone React 19, Vite 8, TypeScript 5 app in `apps/web`, with an existing admin shell and Overview, Documents, Evaluation, Feedback, Courses, Settings pages. No router, auth client, or UI test framework is installed. `npm run typecheck` passed before this feature.
- Contract: `contracts/openapi/common.yaml` has `paths: {}`. Identity/Tenant and course/chat handlers are not implemented. Handbook roles: `student` is limited to enrolled courses; `lecturer` to assigned courses; `tenant_admin` to their organization. Platform admin is a separate role. No session/CSRF, course membership, chat, or feedback API is available.
- Existing demo data has five courses, document states, and feedback. Existing admin pages use browser-session state and demo labels. Existing `DocumentsPage` supports scoped course options and local upload/retry/delete callbacks; `FeedbackPage` supports a filtered fixture list.
- Git baseline: preserved all pre-existing user work; no destructive cleanup, branch change, or commit.

## BA

### Goal and actors

Let a reviewer enter the same polished demo as three recognizable roles, understand which tasks belong to each role, and complete representative mock workflows without mistaking them for live authentication or backend authorization.

| Demo role | Product scope shown | Explicitly outside this demo role |
|---|---|---|
| Student | Home, mock enrolled courses, per-course materials, AI Q&A with fixed sample responses/citations, feedback rating, conversation history, profile | Global admin pages, other students' content, live model/API claims, progress or lesson completion |
| Teacher (lecturer) | Home, mock assigned courses, assigned-course materials and document workflow, feedback for those courses | Global course administration, tenant/system settings, AI evaluation runner, courses outside the assignment |
| Admin | Existing management console: overview, documents, AI evaluation, feedback, courses, settings | Platform-wide tenant/content access; this persona represents an organization admin in the demo |

### Main journeys and states

1. A visitor lands on Login, enters one of the documented demo account credentials, or uses a role-specific quick-entry button. Invalid credentials show a generic inline error; values remain available to correct.
2. A visitor opens Sign up, enters name/email/password/confirmation and chooses Student or Teacher. Valid submission creates a temporary in-memory demo session only. Admin cannot be self-selected during public sign up.
3. Student enters the learner workspace, sees only fixture courses in their demo enrollment, opens a course assistant, asks a question, reads a fixed answered sample with source metadata or an insufficient-evidence result without citations, rates a response, and can inspect history. A distinct technical-error state can be previewed. Course changes keep each mock conversation isolated.
4. Teacher enters the teacher workspace, sees assigned courses only, reviews course documents and feedback, and can use the existing mock upload/retry/delete controls only with assigned-course options.
5. Admin enters the existing admin console with the persona name and a working logout action. Every role can log out to Login; unmounting the workspace clears that demo session and its temporary state.
6. Forms expose associated labels, native validation, inline errors, pending/disabled submit state, and duplicate-submit prevention. Views have responsive layouts, visible focus, textual state labels, and empty states.

### Acceptance criteria

1. Login, sign up, and logout are reachable; demo entry is available for all three roles, while sign up cannot grant admin.
2. Student, teacher, and organization-admin shells have role-specific labels, navigation, identity, and visible demo-only disclosure.
3. Student course list/chat/history are scoped to the user's mock course IDs; changing a selected course does not leak messages.
4. Only fixed mock answers have citations; insufficient evidence has none; technical error is visually and semantically distinct. User content renders as plain text.
5. Teacher course/material/feedback data is filtered to assigned IDs; document changes remain local and cannot target unassigned courses.
6. Existing admin screens and behaviors continue to render, with account details and logout reflecting the current mock session.
7. Forms, navigation, chat controls, and status feedback are keyboard-operable and named; layouts adapt to narrow/mobile, tablet, and desktop widths.
8. `npm run typecheck` and `npm run build` pass from `apps/web`; a server render smoke checks auth and all role shells/pages. Browser visual/interaction checks are reported separately if unavailable.

### Assumptions

- All role switching, accounts, passwords, course membership/assignment, documents, chats, and feedback are synthetic and in memory. Nothing is sent or persisted. No security or authorization guarantee is implied.
- Demo quick-entry buttons are the primary way to review personas; sample credentials are intentionally public demo values.
- `Teacher` maps to the handbook's course-assigned `lecturer`; `Admin` maps to a tenant/organization administrator, not platform administrator.
- Sign up is a visual flow that opens a temporary mock session. Real account creation, email verification, password policy, invitation, tenant selection, persistence, and password storage require an approved Identity/Tenant contract and are not simulated as successful backend work.
- Student UI is limited to the current course-material RAG product. No invented lesson, enrollment, or learning-progress workflow is added.

## Analyze

- **Selected:** keep the existing no-router SPA and branch once at an in-memory session boundary. Add focused auth and student/teacher workspace modules; retain the current admin pages and reuse its document and feedback components for the assigned-course teacher view. Seed role/course scope and chat examples in typed mock fixtures.
- **Alternative rejected:** add an auth library, route guards, persistence, router, or API client. No contract or running service supports those behaviors, and these dependencies would make the mock look more authoritative than it is.
- **Trade-offs:** the app reloads to Login; logout discards temporary account/chat/document changes; all “role permissions” are presentational UI scope only. The answer/citation examples are fixed fixtures, not model output.
- **Handoff:** Identity/Tenant owners must publish Auth/session/CSRF and membership/role/course-assignment contracts; Chat must publish status/citation/feedback DTOs. Backend authorization remains authoritative for every eventual request.

## Plan

1. Extend `src/types.ts` with a small demo user/role and chat view-model contract.
2. Add typed demo personas and course-scoped chat fixture metadata to `src/data/`.
3. Add `src/components/AuthPage.tsx` for Login/Sign up, accessible field validation, generic rejection, and role quick-entry.
4. Add `src/components/RoleWorkspace.tsx` for reusable role shell; add `src/pages/StudentWorkspace.tsx` for home/courses/chat/history/profile and `src/pages/TeacherWorkspace.tsx` for assigned course dashboard/materials/feedback.
5. Wrap the current admin app with a role session boundary in `src/App.tsx`; use actual persona identity and logout in the admin shell. Keep admin page logic intact.
6. Add auth/role/chat responsive styles to `src/styles.css`; keep existing design tokens and avoid new runtime dependencies.
7. Run typecheck/build, render smoke for Login/Sign up and student/teacher/admin shells, review role scoping and text-only citations, inspect the diff and worktree. No commit/push.

## Cook / Test report

- Added Login/Sign up with a public demo persona chooser. Login accepts the three seeded sample accounts; Sign up opens a temporary student or teacher session only. Admin cannot be chosen from public sign up. Password inputs are not stored, sent, or written to browser storage.
- Added the student home, assigned-course list, course-scoped mock assistant, citations, local answer feedback, history, and profile. Fixed answers carry fixed fixture citations; unknown topics return insufficient evidence without citations; a visible demo action previews a distinct technical error. Messages render as text.
- Added the teacher workspace with assigned-course overview, course list, document handling through the existing `DocumentsPage`, and feedback filtered to assigned course names. Document actions reject course IDs outside the teacher fixture scope. Reused components reduce duplicate table/modal/upload implementations.
- Preserved the existing admin pages, connected its account details and logout to the active demo identity, clarified the persona as an organization admin, and updated app metadata/README for all three roles.
- No router, auth framework, API call, local/session storage, or new dependency was added. No live authentication or authorization claim is made.
- `cd apps/web && npm run typecheck`: **passed**.
- `cd apps/web && npm run build`: **passed** (Vite 8.3.0; 30 modules).
- Inline Vite SSR render smoke: **passed** for login persona cards, student and teacher course scoping, existing admin shell, escaped hostile user text, answered citation rendering, insufficient-evidence without citations, and a distinct technical-error state.
- `git diff --check`: **passed** for tracked changes. New files are untracked as expected in this worktree; reviewed the inventory and confirmed no accidental nested lockfile. Existing root `package.json` `dev` change and all pre-existing `.agents/`, `AGENTS.md`, docs, and `yeu_cau.md` work are preserved.
- Browser: Vite dev server listen was blocked by sandbox `EPERM`; CUA reported no connected apps/browsers. Desktop/tablet/mobile visual walkthrough, actual keyboard interaction, screen reader, and automated contrast checks were therefore **not run**. Responsive breakpoints, native control semantics, focus indicators, error announcements, reduced-motion handling, and role-scope rendering were inspected in source/render output.

### Acceptance status

1. **Partial:** Login and Sign up states, role quick-entry, and admin signup restriction are implemented. Static render passed; button/form interaction was not exercised in a browser.
2. **Pass by render/source check:** each role shows distinct navigation, label, identity, and demo disclosure.
3. **Pass by render/source check:** student courses filter by `courseIds`; chat state is keyed per course; teacher and student fixtures do not render unassigned course IDs.
4. **Pass by render/source check:** only fixed answered fixtures carry citations; insufficient evidence has no citations; technical error is a separate status; HTML-like user text was rendered escaped.
5. **Pass by render/source check:** teacher UI receives only assigned courses, documents, and course feedback; mock write callbacks verify assigned course IDs.
6. **Pass by render/source check:** admin overview and navigation continue to render; persona name and logout are connected. Other legacy admin interactions were not rerun in a browser.
7. **Partial:** responsive CSS, labels, button states, native inputs, visible focus, and text status are present and source-inspected. Actual viewport, keyboard, and screen-reader runs were unavailable.
8. **Pass:** frontend typecheck, production build, and scoped SSR smoke pass. No dedicated frontend test framework exists, so no persistent interaction test suite was added.

### Remaining dependency

Before connecting this UX to real accounts or data, Identity/Tenant owners must publish a checked-in Auth/session/CSRF contract and authoritative membership/role/course-assignment contracts; Chat must publish chat status, citation, and feedback contracts. Backend authorization must enforce every permission independently of this role-specific UI.
