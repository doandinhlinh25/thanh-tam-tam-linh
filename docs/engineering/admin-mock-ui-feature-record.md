# Admin mock UI feature record

Status: **Implementation complete; typecheck/build and six-view render smoke passed; visual browser review unavailable**  
Date: 2026-10-17

## Scout

- Request: build a simple admin management frontend in `apps/web/` from `yeu_cau.md` and the frontend assignment, using mock data.
- Git: current branch `main` at `82157f1`; cached `origin/main` also points to `82157f1`, but `git ls-remote origin refs/heads/main` fails with `Could not resolve hostname github.com`. Remote freshness is unknown. The tracked tree is clean, but pre-existing untracked work exists under `.agents/`, `docs/engineering/`, plus `yeu_cau.md`. No branch was created or switched.
- Frontend: `apps/web/` has no files. Root npm workspaces cover only `packages/*` and `services/*`; no React, Vite, router, CSS system, frontend scripts, or browser test setup is installed.
- Product input: `yeu_cau.md` lists overview, document management/detail, AI evaluation, feedback, course management, system configuration, shared UI components, and a navy/purple admin visual style. The frontend assignment plans React + Vite + TypeScript and explicitly identifies `apps/web/` as future work.
- Contract boundary: current OpenAPI has `paths: {}` and no functional document/chat/admin endpoints. Handbook APIs are examples. The admin request allows PDF/DOCX and labels states Pending/Processing/Completed/Failed; the MVP handbook instead specifies text PDFs and the document assignment proposes UPLOADED/QUEUED/PROCESSING/READY/FAILED. Since this is a mock-only interface, use the labels requested in `yeu_cau.md`, visibly mark all data and actions as demo, and make no API claim.
- Baseline checks: no frontend build, tests, routes, or behaviors exist to run or regress.

## BA

### Goal and users

Give an administrator a usable desktop/tablet overview for course materials, AI evaluation, learner feedback, courses, and system settings. Mock data and local UI state are for demonstrating the management experience; they do not persist or call services.

### Main journey

1. Open Overview and review document/course/chunk/question totals, processing distribution, feedback split, recent uploads, and latest evaluation.
2. Navigate among Documents, AI Evaluation, Feedback, Courses, and System Settings from a persistent admin shell.
3. Search/filter documents and feedback, inspect document details, and demo upload/retry/delete actions.
4. Review evaluation questions/results and run a simulated evaluation.
5. Add/edit/delete a mock course and update settings locally, with clear confirmation/toast feedback.

### Requirements and assumptions

- The interface has six views: Overview, Documents (including detail), AI Evaluation, Feedback, Courses, and System Settings. The request is broad, so keep each view focused and seeded with concise realistic examples.
- Use Vietnamese interface labels to match the requirement file and audience. Show a persistent “Dữ liệu mẫu / Demo” indicator.
- Mock upload records only file name/type/size and simulates progress; it does not send or retain file bytes. Use the admin request's PDF/DOCX selection and four display labels as mock presentation only.
- Local state supports interactions for the current page session only. No auth, backend, evaluation model, settings persistence, or actual document processing is claimed.
- Support desktop and tablet, keyboard navigation, labeled controls, focus-visible states, and loading/empty/error/success feedback where relevant.

### Acceptance criteria

1. `apps/web` starts locally and produces a production build using project-documented React/Vite/TypeScript.
2. The admin shell has responsive navigation, system title, user/avatar area, logout demo control, breadcrumb, and a main content area.
3. Overview presents the four requested metrics, document status chart, feedback chart, recent uploads, and latest evaluation from typed mock data.
4. Documents supports mock PDF/DOCX selection, simulated progress, search, course/status filters, status badges, details, retry, delete confirmation, and success/failure feedback. No network request or real file transfer occurs.
5. Evaluation displays a question set, reference/evidence fields, run progress, result metrics and rows, and demo export actions.
6. Feedback can be filtered and opened for detail. Courses support add/edit/delete in local mock state. Settings fields can be edited and saved locally with feedback.
7. Desktop and tablet layouts remain usable; interactive controls have labels, visible focus, keyboard operation, and accessible status/validation announcements.
8. The visible UI clearly identifies demo data. Every failed, empty, pending, or success state is distinguishable without color alone.

## Analyze

- **Selected:** React + Vite + TypeScript, matching the planned project stack. Use a small SPA with an active-view state instead of adding a router: the requested prototype has six views and no URL/deep-link requirement. Use typed mock fixtures and local React state. Use CSS variables and responsive CSS, without a CSS framework. Use CSS/SVG for the charts rather than adding a chart dependency.
- **Alternative rejected:** static one-page sections would make the admin nav and dense management screens harder to scan. A full router, server cache, form framework, chart package, and API client add dependencies without serving the mock-only scope.
- **Trade-offs:** data resets on refresh; upload/evaluation progress is simulated; the labels intentionally represent the user's requested mock, not the backend's planned ingestion state. All screens can be reviewed without service credentials.
- **Risk controls:** do not store file bytes, call guessed endpoints, or make controls imply persistence. Keep sample data realistic but synthetic. Add no auth bypass or real service configuration.

## Plan

1. After a valid baseline/branch decision, inspect the chosen worktree and confirm `apps/web` remains empty.
2. Add a standalone `apps/web` npm package with React, Vite, TypeScript, and dev/build/typecheck scripts. Keep dependencies limited to React, React DOM, Vite, TypeScript, and React type packages; add only a root convenience dev script.
3. Implement the app shell, design tokens, responsive navigation, reusable button/input/select/badge/table/modal/toast/skeleton/empty/error primitives, and mock data types.
4. Implement Overview and Documents, including detail and demo upload/progress/retry/delete interactions.
5. Implement Evaluation, Feedback, Courses, and Settings views with local mock interactions.
6. Review responsive layout, keyboard/focus, labels, contrast, and all acceptance states. Run the actual frontend typecheck/build; use a browser preview if available. Report unavailable checks honestly.

Files expected: `apps/web/package.json`, `apps/web/index.html`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/styles.css`, and focused `apps/web/src/components/`, `pages/`, and `data/mockData.ts`. Root `package.json` and `package-lock.json` may need workspace updates, depending on verified npm setup. No backend/service files are in scope.

## Cook / Test report

- Git: remained on `main`; no commit, branch switch, or remote mutation. The user explicitly authorized proceeding on this worktree. Pre-existing untracked `.agents/`, `AGENTS.md`, `docs/engineering/`, and `yeu_cau.md` were preserved.
- Implementation: created a standalone Vite/React/TypeScript demo in `apps/web`; the root convenience script starts it with `npm run dev`. No service or guessed API endpoint was added.
- `npm install --offline --no-audit --no-fund`: **blocked** because npm cache lacks the `@types/react` package metadata. Online install: **blocked** by `EAI_AGAIN` resolving `registry.npmjs.org`.
- `npm run typecheck --prefix apps/web`: **passed** using temporary links to the exact package versions already present in another local project. Links were removed afterward.
- `npm run build --prefix apps/web`: **passed** (Vite 8.3.0; 25 modules; 260.10 kB JS, 35.55 kB CSS) using those same temporary links.
- Vite dev server: **started successfully** on loopback with the cached dependencies, then stopped. The CUA browser inventory returned no connected browsers; headless Chromium launch was available only outside the restricted sandbox and was not used for UI interaction.
- Server-render smoke: **passed** for Overview, Documents, Evaluation, Feedback, Courses, Settings, and the six-item app navigation.
- Visual inspection at desktop/tablet/mobile widths, interactive browser walkthrough, and screen-reader check: **not run** because no browser surface is connected. Responsive breakpoints, focus handling, skip link, dialog semantics, labels, reduced motion, and textual status/error cues were inspected in source; this is not a substitute for an actual browser accessibility review.

### Acceptance status

1. **Partial:** app dev server and production build both started with cached dependencies; installing packages from this environment remains blocked by registry DNS/cache metadata.
2. **Pass by render/source check:** six-view admin shell, responsive drawer code, breadcrumb, account area, demo logout feedback, and main content are present.
3. **Pass by render smoke:** overview cards, status distribution, feedback split, recent documents, latest evaluation render from typed fixtures.
4. **Partial:** mock upload, filter, details, retry, and delete-confirmation flows are implemented; no browser interaction was available to exercise them. Upload handles metadata only.
5. **Partial:** question, evidence, simulated run, metrics, CSV/JSON actions are implemented and the view renders; interactive export/run flow not browser-tested.
6. **Partial:** feedback filters/detail, course CRUD, and local settings/save/reset are implemented and all views render; interactions not browser-tested.
7. **Partial:** responsive CSS and keyboard/focus behavior are implemented and source-inspected; actual viewport and keyboard walkthrough not run.
8. **Pass by source inspection:** demo markers, status text/shape, labels, validation and status regions are present; no automated contrast or screen-reader run.
