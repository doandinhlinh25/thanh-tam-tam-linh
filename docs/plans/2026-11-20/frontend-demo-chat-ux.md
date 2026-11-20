# Plan: course-scoped demo chat UX

- Status: `DRAFT`
- Task ID: `2026-11-20-frontend-demo-chat-ux`
- Branch: `thanh/fe-demo-chat-ux` at `8f36675`
- Approved direction: user selected fixture-backed course/chat UX; this plan awaits explicit plan approval before Cook.

## 1. Objective

Deliver a polished, contract-independent course-material RAG demo journey based on the architecture reference `origin/Linh:docs/architecture/document.pdf` at `9b7b910`: student course context, chat, answer states, citations, history, and feedback. Keep live integration blocked behind explicit API/gateway/session/CSRF/citation contracts.

## 2. Verified baseline

- `apps/web` already contains React/Vite/TypeScript role-based demo screens and tests.
- Existing shared primitives/tokens are in `apps/web/src/shared/ui/` and `apps/web/src/shared/theme/styles.css`.
- Existing student/chat fixtures are in `apps/web/src/features/demo/adapters/` and `apps/web/src/features/student/pages/StudentWorkspace.tsx`.
- `contracts/openapi/common.yaml` has no resource paths; Kong has no public Chat/Document routes.
- `docs/engineering/frontend-api-map.md` marks chat, citations, feedback, course data, and documents mock-only.
- The architecture PDF specifies the target persona flow and state distinctions, but labels the design TO-BE.

## 3. Scope and non-goals

In scope: fixture-backed student course workspace; typed chat result states; citation panel/drawer; history selection; feedback; empty/loading/error/retry/permission presentation; responsive and keyboard behavior; focused tests and demo E2E.

Out of scope: browser API calls, auth/session/CSRF, real upload/ingestion/retrieval/LLM/streaming, publish mutation, backend contract changes, lessons/progress/enrollment, billing, notifications, and commits/pushes.

## 4. Specialist skills required at Cook/Test

- `frontend-architecture`: feature module/state and adapter boundaries.
- `frontend-ui-engineering`: visual hierarchy, responsive layout, focus, accessible states.
- `rag-chat-experience`: answer/citation/history/feedback state semantics.
- `frontend-security`: untrusted answer/citation/URL handling and tenant/course isolation in UI state.
- `frontend-testing`: component, interaction, keyboard, responsive, and demo E2E checks.
- `frontend-git-flow`: preserve current user work and keep the `thanh/fe-demo-chat-ux` branch based at the recorded commit.

## 5. Planned module map

- `apps/web/src/features/student/pages/StudentWorkspace.tsx`: compose course context and chat journey.
- `apps/web/src/features/demo/adapters/demoData.ts`, `mockData.ts`: explicit demo scenarios and typed fixture responses.
- `apps/web/src/shared/domain/types.ts`: extend local view/domain types only; do not assert unverified API DTOs.
- `apps/web/src/shared/ui/`: extract or extend reusable message, status, citation, drawer/dialog, and feedback primitives only when there are real repeated uses.
- `apps/web/src/shared/theme/styles.css`: responsive states and tokens following existing conventions.
- `apps/web/src/app/App.test.tsx` and focused feature tests: interaction and state coverage.
- `apps/web/e2e/demo.smoke.spec.ts`: one critical browser journey, marked demo-only.
- `docs/engineering/frontend-api-map.md` or a focused feature record: record fixture-to-contract gaps if implementation exposes new needs.

## 6. Ordered implementation phases

### Phase 0 — baseline and contract fence

Re-read current student workspace, fixtures, routes, tests, and architecture section 23. Record existing behavior and keep a visible demo boundary. Verify the branch/worktree and do not introduce endpoint strings.

Check: `git status --short --branch`, source inspection, and `rg` confirming no new live endpoint dependency.

### Phase 1 — domain and fixture scenarios

Define a discriminated local result model for answered, insufficient evidence, technical error, and pending states. Add deterministic fixtures for empty history, multi-citation answer, no-evidence refusal, permission/dependency error, and retry. Keep courseId/tenantId/userId metadata explicit in fixture data without treating it as authorization.

Check: TypeScript compile and unit tests for scenario selection, course isolation, and result mapping.

### Phase 2 — student course workspace composition

Refine course context, material summary, conversation/history affordances, message list, composer, and pending/disabled behavior. Preserve existing demo navigation and avoid route changes unless required by the current route model.

Check: component tests for course selection, empty/loading states, draft preservation, duplicate-submit prevention, and course-switch reset.

### Phase 3 — answer, citation, and feedback UX

Implement distinct answer states, citation list/detail view with accessible focus management, feedback states for answered messages, and safe inert rendering for untrusted fixture text/links. No guessed document download URL or raw HTML injection.

Check: component tests for citation/no-citation/technical-error branches, keyboard dialog flow, hostile text/URL fixture, and feedback retry.

### Phase 4 — responsive and visual finish

Tune existing tokens/layout for narrow, medium, and wide widths; handle long titles, citation overflow, touch targets, visible focus, reduced motion, and status announcements. Keep demo labeling visible without overwhelming the learning task.

Check: Playwright demo screenshots or inspected browser states where available, keyboard traversal, and accessibility assertions supported by installed tooling.

### Phase 5 — regression and handoff

Run frontend typecheck, build, Vitest, and demo Playwright checks. Inspect diff and update the API map/feature record with the exact live-contract gaps. Do not claim backend authorization, CSRF, or ingestion readiness.

Check: all configured commands with exact outcomes; acceptance matrix; clean intended diff on `thanh/fe-demo-chat-ux`.

## 7. Parallelism and ownership

Implementation should remain single-owner because Phases 1–3 share types, fixtures, and `StudentWorkspace.tsx`. Phase 4 and test additions may be parallelized only after Phase 3 stabilizes and with exclusive file ownership recorded in a coordination handoff. No extra agent or worktree is required for the initial Cook.

## 8. Acceptance criteria to checks

| Criterion | Verification |
| --- | --- |
| AC1 course context | Phase 2 component test and demo E2E |
| AC2 distinct states | Phase 1 fixture tests + Phase 2/3 component tests |
| AC3 citation semantics | Phase 1 mapping test + Phase 3 UI assertions |
| AC4 accessible citation detail | Phase 3 keyboard/focus test + manual browser check |
| AC5 duplicate/retry/draft | Phase 1/2 interaction tests |
| AC6 course/history isolation | Phase 1/2 fixture and component tests |
| AC7 feedback behavior | Phase 3 component tests |
| AC8 responsive/keyboard | Phase 4 Playwright/manual checks |
| AC9 untrusted content/security | Phase 3 security-focused tests and source inspection |
| AC10 demo boundary | Phase 0/5 source and UI inspection, API map update |

## 9. API and backend dependencies

No browser API is planned in this phase. Future integration requires public gateway routes, versioned DTOs, session cookie attributes, CSRF behavior, tenant/course authorization, citation metadata and protected source access, history/feedback semantics, and structured error codes. Owners are Auth, Tenant, Document, Chat, and gateway teams; this plan does not modify their services.

## 10. Security, compatibility, and performance

- Never store or expose tokens in fixtures, browser storage, logs, or bundles.
- Treat answer Markdown, filenames, citation metadata, and URLs as untrusted data.
- Keep fixture cache/state scoped by course and reset stale pending results on course changes.
- Avoid optimistic writes or streaming because no duplicate/idempotency/event contract exists.
- Keep rendering bounded for long histories/citations; do not add a dependency without need and review.
- Preserve existing routes, role demo entry points, and current user untracked work.

## 11. Rollback and recovery

Revert only the feature branch's intended files if a phase regresses existing demo routes. Restore the prior fixture/model and component implementation together if the discriminated state model proves incompatible. Do not reset or clean the shared checkout. If a live API contract appears during implementation, stop at the adapter boundary and return to Plan rather than silently switching scope.

## 12. Approval gate and next action

This plan is `DRAFT`. User approval is required before `$cook`. After approval, open the specialist skill files listed in section 4, implement phases in order, then run `$test` and `$review`. No commit, push, merge, or PR is included.
