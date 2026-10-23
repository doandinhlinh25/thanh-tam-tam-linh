# Scout: Build the frontend structure described in the assignment

## 1. Request and scope as understood

User request: “giúp mình tạo ra thư mục đầy đủ cho web như trong file 01-frontend-Thanh.md yêu cầu”.

Interpretation for this read-only Scout stage: compare the live `apps/web/` implementation and repository contracts against `docs/documents/assignments/01-frontend-Thanh.md`, identify which parts of the requested frontend foundation are missing, and prepare a safe next-stage decision. The assignment describes both a project structure and workflows that depend on other owners' API contracts; it is not itself proof those APIs exist.

## 2. Project overview relevant to this task

- **Verified:** `apps/web/` is an implemented standalone React 19, TypeScript 5, Vite 8 package, with `dev`, `typecheck`, and `build` scripts in `apps/web/package.json`.
- **Verified:** Existing source is organized as `components/`, `pages/`, `data/`, and top-level `App.tsx`, `main.tsx`, `styles.css`, `types.ts`. The current `App.tsx` selects role workspaces and uses local component state; no router is imported.
- **Verified:** The app currently presents synthetic in-memory personas and mock course/document/chat/evaluation/feedback/settings flows. README says it does not connect to an API or persist edits.
- **Verified:** `contracts/openapi/common.yaml` declares shared response schemas and `paths: {}`. No frontend-facing Auth, Tenant/Course, Document, Chat, or Feedback endpoint is contracted here.
- **Verified:** `apps/web/package.json` has no query-cache, router, browser-test, or accessibility-test dependency/script. It only has React/React DOM and Vite/TypeScript tooling.
- **Verified:** Current backend services in `services/` contain health routes and skeleton modules; repository README says nghiệp vụ/database are not implemented. The assignment names Auth/Tenant, document processing, and Chat owners as dependencies.
- **Verified:** The latest `$test` report for the in-progress student-upload/evaluation work is `PARTIAL`: typecheck/build pass, but this environment had no browser available. That report's scope is separate from this broader request.

## 3. Git state and baseline

- Branch/worktree: `thanh/init-fe`, `/home/thanh/Documents/1.Projects/thanh-tam-tam-linh`.
- HEAD/base: `1056c71 feat(frontend): initialize learning UI`.
- Local `main` and cached `origin/main` point to `82157f1`; remote freshness was not checked. Do not treat cached refs as current.
- Tracked, uncommitted changes from the preceding student upload/evaluation task: `apps/web/README.md`, `apps/web/src/App.tsx`, `apps/web/src/data/demoData.ts`, `apps/web/src/data/mockData.ts`, `apps/web/src/pages/EvaluationPage.tsx`, `apps/web/src/pages/StudentWorkspace.tsx`, `apps/web/src/styles.css`, and `apps/web/src/types.ts`.
- Existing untracked task artifacts include the preceding plan, reports and handoff, plus new `apps/web/src/pages/StudentDocumentsPage.tsx`.
- An untracked top-level `.aws` path is present. It was not opened or modified; its contents and relation to this task are unknown. Preserve it.
- No branch switch, fetch, commit, reset, stash, source/config edit, or dependency change was made in this Scout stage. The only new files are this Scout report and task handoff.

## 4. Assignment requirements and live file map

Assignment source: [01-frontend-Thanh.md](../../documents/assignments/01-frontend-Thanh.md).

| Assignment area | Live implementation/evidence | Status |
| --- | --- | --- |
| React + TypeScript + Vite package and run instructions | `apps/web/package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `apps/web/README.md` | Implemented for the demo. |
| Login/logout and role-shaped UI | `src/components/AuthPage.tsx`, `src/components/RoleWorkspace.tsx`, `src/App.tsx`, `src/data/demoData.ts` | Mock persona flow exists. No session cookie, CSRF, tenant switcher, server membership, or authorization contract. |
| Tenant/course selection and role dashboards | `src/pages/StudentWorkspace.tsx`, `src/pages/TeacherWorkspace.tsx`, admin pages under `src/pages/`, fixtures under `src/data/` | Demo-scoped only; no tenant membership or course API. No tenant switcher. |
| Course materials, upload status and PDF upload | `src/pages/DocumentsPage.tsx`, `src/pages/StudentDocumentsPage.tsx`, `src/types.ts`, mock data | Simulated metadata-only PDF/DOCX UI; no transfer, ingestion, polling, scan/quota enforcement, or document API. Student upload behavior is intentionally demo-only. |
| Chat answer/refusal/error, citations and feedback | Student assistant in `src/pages/StudentWorkspace.tsx`, `src/data/demoData.ts` | Fixed local fixtures and UI states exist. No chat/citation/feedback API; citations are demo fixtures rather than backend-verified metadata. |
| Routing | `src/App.tsx` dispatches session role and switches views with local state | No URL router, route table, or deep-link behavior. |
| API client and query cache | Search of `src/`, package dependencies, and manifest | No network API client, request lifecycle abstraction, or server-state cache. |
| Frontend UI and E2E tests | `apps/web/package.json` and `apps/web/` file inventory | No component test runner, Playwright setup, or test script. `$test` reports no browser available in its environment. |
| API mapping, wireframe, screenshots/handoff | Assignment asks these deliverables | Existing role/admin feature records document demo decisions, but no current contract-backed screen-to-API mapping or current screenshots were verified. |

## 5. Existing implementation patterns and conventions

- **Verified:** React components live in `src/components/` and role/page compositions in `src/pages/`; fixtures and formatting helpers live under `src/data/`; shared types live in `src/types.ts`.
- **Verified:** UI behavior is mostly passed via callback props and React local state. Data is not fetched from services. Demo disclosures are already used for role workspaces, student assistant, upload, and admin evaluation.
- **Verified:** `apps/web` has no frontend `AGENTS.md`; root guidance says not to invent API endpoints and says React/Vite details must be checked in the live tree.
- **Verified:** User-provided root instructions require one workflow stage per request and require an approved plan before Cook. The frontend workflow likewise requires Scout → BA/Analyze → Plan → Cook → Test.
- **Assumption:** “Thư mục đầy đủ” may refer to architecture/folder scaffolding and may or may not mean replacing the current demo with live API-backed behavior. The request does not clarify that distinction.

## 6. Commands and baseline checks

Discovered scripts from manifests:

- `npm run dev --prefix apps/web`
- `npm run typecheck --prefix apps/web`
- `npm run build --prefix apps/web`
- No frontend lint or test script is defined.
- Root `build`, `typecheck`, and `test` are documented as Node workspace checks, not frontend checks.

No baseline build/typecheck was rerun in this read-only Scout stage. Prior task report records these frontend checks passing against its implementation diff; it is not an independent baseline for this broader task.

## 7. Constraints, risks, assumptions, and open questions

- **Contract blocker:** The assignment's real auth, tenant/course, upload/ingestion, chat/citation, and feedback flows need contracts from other owners. Current OpenAPI has no paths. Do not add guessed URLs, DTOs, cookie/CSRF rules, query keys, or polling behavior.
- **Scope ambiguity:** A full mock/demo architecture can be scaffolded without backend contracts, while a live integration requires those contracts. Those are materially different outcomes.
- **Existing work:** The branch contains uncommitted code from the previous authorized task. Preserve every tracked/untracked file. Do not switch branches or clean/stash this tree.
- **Git Flow:** A substantial implementation normally needs the frontend Git-flow preflight. The requested current branch has local changes and no clean feature worktree; the previous explicit user preference for `thanh/init-fe` is recorded in the adjacent task handoff, but whether to keep this task on that branch should be confirmed before a branch-changing action. Remote main freshness is unknown.
- **Test gap:** The assignment targets at least ten valuable UI tests and a Playwright cross-role flow. There is currently no frontend test harness. Adding one would be new project tooling and must be included in an approved plan.
- **Possible omission:** Assignment says “upload PDF”, while current demo accepts PDF/DOCX. That is acceptable as current demo behavior only; a production format/size contract is not available.
- **No implementation was performed** in this stage.

## 8. Recommended next step

Proceed to `$brainstorm` to agree whether the deliverable is (A) a complete, clearly mock-backed frontend structure around current demos, with isolated future API boundaries and no service calls, or (B) a production-oriented integration scaffold that waits on Auth/Tenant/Document/Chat contracts before adding live flows. Then prepare a bounded plan. Retain the current branch preference only if the user confirms it remains the intended policy for this broader task; do not disturb the dirty worktree.
