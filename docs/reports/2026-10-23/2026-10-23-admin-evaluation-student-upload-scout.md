# Admin AI evaluation and student document upload — Scout

## 1. Request and scope as understood

User request: “$scout sửa phần đánh giá AI trong pages quản trị viên, và thêm chức năng upload cho sinh viên, sinh viên phải tự upload được tài liệu”.

This scout inspects the admin AI-evaluation page and the student upload path, including existing approved work for student personal uploads. It is read-only except for this report and its task handoff. It does not define what “sửa” means or implement either feature.

## 2. Project overview, limited to this task

- **Verified:** `apps/web` is a React 19, TypeScript, Vite SPA with separate student, teacher, and admin workspaces. The current source tree is present under `apps/web/src/`; `apps/web/package.json` provides `dev`, `build`, and `typecheck` scripts.
- **Verified:** `apps/web/README.md` describes this as a synthetic, in-memory demo. The existing teacher/admin document upload stores metadata and simulates progress; it does not upload file contents.
- **Verified:** `contracts/openapi/common.yaml:5` declares `paths: {}`. No functional evaluation, document-upload, chat, or authentication endpoints are contracted. The service-boundaries document describes document and chat services as future MVP work (`docs/architecture/service-boundaries.md:29-31`).
- **Verified, stale inventory:** `docs/engineering/frontend-skill-discovery.md` says `apps/web/` is empty. Current branch commit `1056c71` added the app, so use the live source instead of that inventory statement.

## 3. Git state, including the base commit

- **Verified:** Branch is `thanh/init-fe`, HEAD `1056c71` (`feat(frontend): initialize learning UI`), tracking cached `origin/thanh/init-fe`. `git status --short --branch` showed a clean worktree; `git worktree list` showed this one worktree.
- **Verified:** `git merge-base HEAD main` is `82157f1dc697bc71c34ea074f78d6427de9b0798`. `git log -10 --oneline` contains `1056c71`, `82157f1`, `f65831c`, and `c6aef82`; the current branch is one commit ahead of the local `main` baseline.
- **Verified:** `git ls-remote origin refs/heads/main` failed with `Could not resolve hostname github.com`; remote freshness cannot be verified. Cached `origin/main` is not proof of current remote state.
- **Verified:** `git show --stat HEAD` shows that commit `1056c71` introduced the current frontend and the related skill/workflow documents, including the earlier student-upload plan and handoff. Those files are committed on this branch.

## 4. Relevant files and modules

- `apps/web/src/App.tsx`: `AdminWorkspace` owns demo evaluation state and injects handlers into `EvaluationPage`; the evaluation navigation entry and route are admin-only through the top-level role dispatch.
- `apps/web/src/pages/EvaluationPage.tsx`: current admin evaluation UI: set creation, adding reference questions, fixed metric cards, question table, quality-history chart, CSV/JSON export, and simulated run progress.
- `apps/web/src/data/mockData.ts`: fixed evaluation questions and summary metric fixtures.
- `apps/web/src/types.ts`: `EvaluationQuestion` and `EvaluationSummary` shapes; current evaluation question `score` is a number populated by fixtures, with no runner/result provenance model.
- `apps/web/src/pages/StudentWorkspace.tsx`: student navigation and home/course/assistant flows. Current student pages are home, courses, assistant, history, account; course/document fixtures are filtered by `user.courseIds`. No personal document state, library page, or upload handler exists in current source.
- `apps/web/src/pages/DocumentsPage.tsx`: existing PDF/DOCX metadata-only upload pattern and simulated progress, used in shared teacher/admin document management.
- `apps/web/src/pages/TeacherWorkspace.tsx`: teacher owns a separate local document list and upload callback, which reinforces that current role data does not persist/share through a service.
- `apps/web/src/data/demoData.ts`: fixed mock assistant responses/citations; a real selected file cannot currently ground an answer.
- `apps/web/README.md`: public demo limitations and frontend commands.
- `contracts/openapi/common.yaml`, `docs/architecture/service-boundaries.md`, and `docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md`: contract and planned backend boundaries; handbook behavior remains a proposal where no source/contract implements it.
- `docs/plans/2026-10-23/student-ui-personal-upload.md`, `docs/reports/2026-10-23/2026-10-23-student-ui-upload-brainstorm.md`, and `docs/handoffs/2026-10-23-student-ui-upload.md`: existing approved UI/upload direction, implementation plan, and blocked Cook handoff.

## 5. Existing implementation and conventions to follow

### Admin AI evaluation

- **Verified:** The current evaluation page explicitly says results are illustrative and that a run only simulates progress (`EvaluationPage.tsx:88-94`). The “run” is a timed interval in the page; after it completes it calls `onRun` (`EvaluationPage.tsx:40-54`).
- **Verified:** `AdminWorkspace` changes only `answerQuality` by a random ±1 step (clamped to 70–99), appends it to history, and updates a timestamp (`App.tsx:85-90`). Recall, citation accuracy, refusal accuracy, per-question scores, and actual model output are not evaluated by that operation.
- **Verified:** Questions store reference answer, expected evidence, answerable flag, and a numeric score, but the add-question handler initializes score to 0 (`App.tsx:79-82`; `types.ts:65-72`). Seeded fixture scores use decimal fractions such as `0.94` while the UI renders them with a `%` suffix, whereas the summary metric values use whole percentages (`mockData.ts:29-34,44-52`; `EvaluationPage.tsx:98-108`). This is a concrete display/data-shape inconsistency for the question score.
- **Unknown:** Whether the user wants a functional bug fixed, metric/score calculations corrected, a UI redesign, a real evaluation runner, or some combination. There is no specific failure report or expected result in this request.

### Student document upload

- **Verified:** Students have no upload/library navigation or handler in current source (`StudentWorkspace.tsx:9-25,74-88,133-141`). Student documents come from shared static fixtures filtered by the demo user's course IDs.
- **Verified:** Shared upload accepts PDF/DOCX by filename input and records metadata only; the interface explicitly says the selected file contents are not uploaded (`DocumentsPage.tsx:166-180`).
- **Verified from existing approved artifacts:** On 2026-10-23, the user approved simulated student upload, private to the student's demo session and intended for that student's own mock assistant; the plan also requires metadata-only behavior, isolation from teacher/admin shared materials, and synthetic-only answers/citations. Evidence is in `docs/handoffs/2026-10-23-student-ui-upload.md:10-16` and `docs/plans/2026-10-23/student-ui-personal-upload.md:1-5,17-28,90-96`.
- **Verified from existing approved plan:** The prior plan includes `EvaluationPage.tsx` readability work and a student personal library/upload page (`student-ui-personal-upload.md:63-76,85-90`). It does not specify revised AI-evaluation logic or a real AI evaluation backend.
- **Verified blocker:** The existing Cook handoff is marked `BLOCKED`; it required resolving the safe branch/main-baseline prerequisite before implementing (`docs/handoffs/2026-10-23-student-ui-upload.md:58-66`). The current branch has progressed beyond that recorded base, but latest remote `main` still cannot be checked because of DNS failure.

### Conventions and workflow

- **Verified:** Frontend changes should follow `frontend-feature-workflow` and applicable specialist skills; the repository root guidance and workflow docs require distinct stages and user direction before advancing.
- **Verified:** `frontend-api-integration` must not invent a frontend endpoint when OpenAPI has no paths; live evaluation/upload would require contracts and backend ownership. `frontend-forms`, `frontend-security`, and `frontend-ui-engineering` are relevant to student upload controls and role-scoped UI once planning/implementation is authorized.
- **Verified:** The existing frontend package provides build and typecheck only; it declares no frontend test/lint scripts or browser test framework (`apps/web/package.json`).

## 6. Commands available, plus baseline results

- **Verified from manifest:** `npm run typecheck --prefix apps/web`, `npm run build --prefix apps/web`, and `npm run dev --prefix apps/web`.
- No build, typecheck, lint, or test command was run in this read-only scout. No frontend test script is declared in `apps/web/package.json`.
- **Verified:** Remote freshness probe `git ls-remote origin refs/heads/main` failed because `github.com` could not be resolved.

## 7. Constraints, risks, assumptions, and open questions

1. **Evaluation intent is underspecified.** Ask what is wrong in the admin evaluation page and what should happen after a run. The code does reveal a score format inconsistency (decimal fixture values rendered as percentages) and simulated metrics, but those facts do not establish which one the user means to change.
2. **Real AI evaluation is unavailable in current architecture.** No evaluation API, chat/document API, model runner, or test framework is implemented/contracted here. A UI-only change must remain visibly mock; a real runner requires backend contract/service work and authorization decisions.
3. **The existing approved student-upload plan is applicable but not yet implemented.** It already settled the demo behavior; avoid reopening those approved choices without a changed requirement. It is an all-role UI refresh plan, so its `EvaluationPage` task covers readability only. Additional evaluation behavior would need to be scoped against it.
4. **Prior Cook branch blocker remains material.** The old handoff requires a safe branch preflight. Current worktree is clean on `thanh/init-fe`, but remote `main` is unverified; a substantial implementation should respect the project’s Git-flow gate and preserve the current app.
5. **No data/permission boundary exists in the demo backend.** Student upload in source would be only a per-workspace in-memory simulation, not real private persistence or server authorization. Do not expose it in teacher/admin shared document views or imply uploaded bytes informed the AI.
6. **Assumption:** The current request extends the previously approved student-upload direction and asks for some additional correction to admin evaluation. If it instead means a real uploaded-document product capability or real evaluation runner, backend work and a new scope decision are required.

Open questions for a follow-up stage:

- What specifically should be fixed in the admin AI evaluation view: score formatting/calculation, layout/usability, run behavior, or real model evaluation? What observable expected result defines done?
- Does the user want to proceed under the existing approved demo-only upload plan, or has the request changed to actual file transfer and persistence? The current approved plan is demo-only.
- If continuing implementation of the prior approved plan, how should the safe branch preflight proceed while remote `main` is unreachable?

## 8. Recommended next step

Continue with `$brainstorm` to define the expected behavior for the admin AI-evaluation fix and reconcile that scope with the already-approved upload plan. Reuse the prior plan for the student-private simulated upload requirements; revise or replace only what the new evaluation scope makes necessary. Keep Cook blocked until the existing safe-branch prerequisite is resolved or the user explicitly selects another safe branch policy. Do not implement a real model evaluation or file-transfer flow without the required API and backend contracts.

## Final state check

- This scout report and its task handoff are the only files written by this stage.
- The worktree was clean before the scout; no application source or configuration was modified.
