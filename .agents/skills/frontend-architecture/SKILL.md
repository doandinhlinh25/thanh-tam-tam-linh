---
name: frontend-architecture
description: Shape or refactor React frontend modules, components, hooks, types, and state boundaries for maintainability. Use for frontend structure and code-quality decisions; use frontend-ui-engineering for visual or interaction design and frontend-api-integration for transport contracts.
---

# Frontend Architecture

## Purpose and activation

Use this skill when adding a substantial frontend feature, establishing the initial `apps/web/` structure, or refactoring components, hooks, state, and shared code. For a small isolated edit, follow nearby code instead of designing a new architecture. Visual layout and accessible UI details belong to `frontend-ui-engineering`; API transport and form submission have their own skills.

## Inputs and inspection

1. Read the request and acceptance criteria. Inspect the affected source, imports, tests, and current Git changes before editing. Read [frontend discovery](../../../docs/engineering/frontend-skill-discovery.md) for the verified baseline; inspect the live tree because the baseline can age.
2. Trace one real user action through route, data access, state, and presentation. Identify existing components and conventions worth reusing. Check whether a proposed type is a local view model, a contracted DTO, or a domain assumption.
3. Inspect `apps/web/` and its own package scripts before choosing a library, folder layout, test command, or styling approach. At the discovery baseline, `apps/web/` is empty; React, Vite, and TypeScript are the [frontend assignment's](../../../docs/documents/assignments/01-frontend-Thanh.md) plan, not installed tooling. Root `package.json` does not include `apps/*` in workspaces.

## Decisions and execution

- Give routes or features ownership of their UI composition and local behavior. Extract a shared component or hook when two real uses need the same behavior or a boundary is otherwise hard to understand. Keep presentation separate from request orchestration when this makes loading and error states easier to test.
- Choose state by lifetime and owner: component state for local interaction, URL state for shareable navigation, session context for authenticated identity, and a server-state cache only after its library and invalidation rules are chosen. Do not duplicate authoritative server data in unrelated stores.
- Keep DTO decoding and network calls at the API boundary; pass typed, UI-appropriate values into components. Preserve tenant and course context in the data flow and cache keys once those contracts exist. Coordinate the boundary with `frontend-api-integration`.
- During refactoring, record the behavior to preserve, make a focused change, and verify affected flows. Prefer clearer names, smaller responsibilities, and direct code over a framework or abstraction justified only by hypothetical reuse. Remove dead paths only after checking callers.
- Follow frontend conventions demonstrated by actual frontend code once it exists. [Node service coding conventions](../../../docs/development/coding-conventions.md) apply to `services/`; do not impose their server folder layout on `apps/web/`.

## Quality gates

- A reviewer can locate the owner of each changed behavior without tracing duplicate state or circular dependencies. Public component and hook contracts have clear TypeScript types; unchecked casts or `any` do not hide uncertain API data.
- The implemented UI covers the requested loading, empty, error, success, and permission states where applicable. Existing keyboard and responsive behavior remains usable; apply `frontend-ui-engineering` for the UI review.
- Run the frontend's actual typecheck, build, lint, and relevant tests when configured. For a refactor, compare behavior with the prior baseline. Inspect the final diff for accidental scope changes. Report every check as passed, failed, or unavailable; the current repository has no frontend commands or tests.

## Failure handling, output, and next action

If a required API, product rule, or frontend tool is absent, name the missing decision, keep mock data isolated if explicitly needed for a prototype, and avoid presenting it as production behavior. Do not invent modules or commands to make a plan appear complete.

Deliver the changed module map, the behavior or responsibilities moved, verification results, and remaining dependencies. Hand API decisions to `frontend-api-integration`, form behavior to `frontend-forms`, and visual or accessibility decisions to `frontend-ui-engineering`. Next, close any contract dependency, then verify the full user journey once the frontend and API are runnable.
