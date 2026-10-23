# Frontend skill system discovery

_Verified 2026-10-17 against the local working tree **before the skill-system edits**. This is the Phase 1 baseline; planned capabilities are labeled separately from implemented ones. See the [validation report](frontend-skill-validation.md) for the resulting files._

## Repository shape and evidence

Top-level implementation areas are `apps/` (empty `web/`), `contracts/openapi/`, `docs/` (architecture, development, and assignment/handbook documents), `infrastructure/` (gateway and Node Compose), `packages/` (`common`, `http`), `services/` (`identity`, `tenant`, `billing`, `notification`), `templates/` (Node service template), and `test/` (Node tests). The repository also had an untracked `.agents/skills/` tree at discovery.

| Area | Verified state | Primary evidence |
| --- | --- | --- |
| Frontend | `apps/web/` is empty and has no tracked files. There is no frontend source, build configuration, or test suite. | `git ls-files apps`; `apps/web/`; [README](../../README.md) |
| Workspace | npm lockfile and root workspaces cover `packages/*` and `services/*`, not `apps/*`. Root `build`, `typecheck`, and `test` run the Node workspaces; no frontend lint command exists. | [package.json](../../package.json), [package-lock.json](../../package-lock.json) |
| Backend | Four Express/TypeScript services currently expose health endpoints. Shared packages implement HTTP envelopes and middleware. | [README](../../README.md), `services/*/src/`, [common package](../../packages/common/src/index.ts), [HTTP package](../../packages/http/src/index.ts) |
| Gateway | Kong has routes for identity, tenant, billing, and notification services. The OPA gateway policy is currently deny-all. No document or chat route is deployed. | [Kong config](../../infrastructure/gateway/kong/kong.yml), [authorization design](../architecture/kong-opa-authorization.md) |
| API contract | The only OpenAPI file has shared schemas and `paths: {}`. There is no implemented frontend-facing Auth, Course, Document, Chat, LMS, or streaming contract. | [common.yaml](../../contracts/openapi/common.yaml) |
| Infrastructure | Compose files cover the current Node services and gateway, not a running frontend, database, object store, or AI stack. | `infrastructure/node/compose.yaml`, `infrastructure/gateway/compose.yaml` |

The frontend assignment [plans](../documents/assignments/01-frontend-Thanh.md) React, Vite, TypeScript, routing, a theme, an API client and query cache, cookie/CSRF session handling, tenant/course selection, PDF ingestion polling, chat with citations and feedback, and Playwright. **That is the intended stack, not a verified installed stack.** There is no current routing, component architecture, design token system, styling solution, state store, API client, auth UI, form system, responsive UI, accessibility implementation, frontend test tooling, or frontend build pipeline to audit in source code.

## Product and contract boundaries

The [AI-01 handbook](<../documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md>) describes a course-material RAG assistant: tenant/course-scoped text-PDF ingestion, permission-scoped questions, server-provided citations, feedback, and evaluation. A broader LMS with lessons, learning paths, and progress is a future direction. No backend contract yet establishes those LMS capabilities. [Frontend](../documents/assignments/01-frontend-Thanh.md), [platform](../documents/assignments/02-platform-saas-Duy-Tam.md), [document](../documents/assignments/03-document-retrieval-Linh.md), and [chat](../documents/assignments/04-chat-rag-evaluation-Thanh-Tam.md) assignments divide planned work among teams.

The handbook's `/api/v1/...` routes and response examples are proposals. They differ from the current Kong `/api/identity/auth` and `/api/tenants` route prefixes, and neither set is backed by functional handlers today. A frontend skill must require a checked-in contract or working handler before treating an endpoint as available. The shared package currently defines success as `{successful: true, data, error: null}` and failure as `{successful: false, data: null, error: {errorCode, errorMessage, fieldErrors}}`; it does not establish resource-specific DTOs.

Architecture documents assign sessions to Identity and tenant membership/course authorization to Tenant. Frontend calls are planned through Kong. A tenant ID supplied by the browser and a protected-route UI are not authorization proof. The handbook plans opaque HttpOnly session cookies and CSRF protection, but no functional auth flow exists yet. The handbook proposes ingestion states `UPLOADED`, `QUEUED`, `PROCESSING`, `READY`, `FAILED`, then `DELETING` and `DELETED`; chat examples distinguish an answered result with citation metadata from insufficient evidence with no citations. Streaming is not contracted.

The pre-existing, untracked `yeu_cau.md` admin UI request adds overview, documents, evaluation, feedback, courses, and configuration screens. It requests PDF/DOCX upload while the handbook MVP specifies text PDFs. Its displayed `Pending/Processing/Completed/Failed` labels also differ from the proposed ingestion state names. Resolve these product choices in BA before implementing them; a skill must not silently choose a backend capability.

## Existing conventions and agent inventory

- [Coding conventions](../development/coding-conventions.md) govern the Node services; they are not evidence of a frontend file structure or styling convention.
- Before implementation, the repository had no `AGENTS.md`, `CLAUDE.md`, `.claude/`, tracked workflow definition, or prompt template. `.codex/` was empty.
- At discovery, the only project skill was the pre-existing, untracked [frontend-ui-engineering](../../.agents/skills/frontend-ui-engineering/SKILL.md). This Codex session listed it as available. It covered component composition, visual consistency, responsive behavior, accessibility, and UI states, so those topics warranted improvement rather than duplication. Its then-current React/Tailwind examples were speculative; its `../../references/accessibility-checklist.md` link was broken, and its dialog example claimed a focus trap it did not implement. The revised skill fixes these issues.
- User-level Codex system skills (including `skill-creator`) and generic agent role definitions exist outside the repository. They are available to this session but should not be copied into project files. No project Claude Code discovery configuration was found.
- No project Git automation or custom agent workflow scripts were found. The recent Git messages do not establish a Conventional Commit convention.
- Local `main` and cached `origin/main` both point to `82157f1`; the tracked worktree is clean. `.agents/` and `yeu_cau.md` are existing untracked user work. `git ls-remote origin refs/heads/main` failed because `github.com` could not be resolved, so remote freshness is unverified. Recent commit messages do not yet use Conventional Commits.

## Gaps and risks

1. **No runnable frontend or functional API contracts.** Skills can guide implementation but cannot prescribe existing components, commands, DTOs, or tests that do not exist.
2. **Planned API versus gateway mismatch.** Frontend integration must wait for versioned routes, DTOs, auth/CSRF behavior, pagination, error codes, and document/chat contracts to be reconciled.
3. **RAG and LMS scope differs.** RAG course materials are planned; lessons, progress, enrollment, instructor/admin actions, and streaming must remain conditional until backend/product decisions exist.
4. **Existing UI skill has two correctness defects.** Repair the broken reference and inaccurate focus-management example without discarding its useful guidance.
5. **Branch freshness cannot be proved offline.** Preserve existing untracked files and record this limitation; do not reset or overwrite them.

## Recommended skill architecture and implementation plan

Use repository `.agents/skills/<name>/SKILL.md` because this runtime already discovers the existing skill there. Add a small root `AGENTS.md` to route substantial frontend work to an orchestrator, and add an index under `.agents/skills/` for human readers. Keep the existing `frontend-ui-engineering` skill for design system, responsive UI, accessible interaction, and visual quality. Add narrow skills for architecture/refactoring; API, auth, and forms; RAG chat/AI interaction; conditional LMS UI; security/performance/testing; the six-stage feature workflow; and safe Git flow. Split or combine the quality skills only where they remain independently actionable. Each skill must name its activation boundary, input evidence, steps, quality gates, failure handling, output, handoff, and next action. Store project facts in one reference where that avoids repeated provisional claims.

Implementation order:

1. Repair the existing UI skill's broken guidance and document current versus planned stack.
2. Write distinct specialist skills with conditional contract gates and real repository paths.
3. Add `Scout → BA → Analyze → Plan → Cook → Test` orchestration and Git Flow skills, then wire them through `AGENTS.md` and the index.
4. Validate frontmatter with the local `skill-creator` validator, verify links and cross-references, inspect the diff and Git state, and report that frontend build/tests are unavailable until `apps/web` is implemented.

No application source or dependencies need to change for this task.
