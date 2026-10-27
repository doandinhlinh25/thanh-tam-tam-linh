---
name: frontend-testing
description: Select and run meaningful frontend tests and quality checks for RAG or LMS behavior, API integration, accessibility, responsive states, and regressions. Use for feature verification or a focused test strategy; visual design implementation belongs to frontend-ui-engineering.
---

# Frontend Testing

## Purpose and activation

Prove observable frontend behavior at the cheapest level that can catch the relevant failure. Use for feature implementation, regression fixes, integration changes, release checks, or explicit testing work. Pair with the security or performance skill when their risk is central; do not duplicate those skills' implementation guidance.

## Inputs and inspection

- Read the accepted behavior and prior workflow artifacts, affected code, available scripts/configuration, checked-in API contract or handler, and [frontend discovery](../../../docs/engineering/frontend-skill-discovery.md). Map each acceptance criterion to an observable assertion and note whether backend services are actually available.
- Inspect existing fixtures, mocks, browser tooling, and baseline failures. `apps/web/` has no source or test tooling yet. The root npm scripts exercise the Node workspaces, not frontend build, typecheck, lint, or tests.
- Identify states and risks: session expiry, tenant/course change, upload/ingestion, answered versus insufficient evidence, citations, feedback, request races, loading, empty, error, permission, narrow viewport, keyboard, and untrusted content as applicable.

## Decisions and execution

1. Test pure transformations with unit tests; component interactions and states with component tests; request mapping and error normalization with contract-shaped integration tests; and a few critical cross-service journeys with browser E2E when services exist. Favor assertions about user-visible results and network outcomes over snapshots or checks that mirror implementation details.
2. Use mocks only for known API shapes. Keep temporary mock paths isolated and label them as such. Mocked `403`, citation, or CSRF responses verify UI handling, not server enforcement. Reserve a real integration check for cross-tenant denial and session/CSRF guarantees.
3. Cover the relevant success and failure branches. For the planned MVP, the frontend assignment expects at least ten valuable UI tests across session, tenant/course permission, valid and invalid upload, scan/quota/ingestion errors, citation, insufficient evidence, provider error, and feedback; this is a whole-frontend delivery target, not a quota for every change.
4. Verify keyboard and focus behavior, accessible names and error feedback, screen-reader semantics where practical, reduced motion where applicable, and representative narrow/wide layouts. Automated accessibility checks complement manual interaction checks. Probe malicious Markdown/links and tenant cache isolation for security-sensitive features.
5. Run the actual formatter, linter, typechecker, test command, and production build only when the frontend defines them. For a changed browser flow, inspect the rendered result and console/network behavior when a runnable environment is available. Check the final diff for unintended changes.

## Verified project conventions

- Planned React/Vite/TypeScript and Playwright tooling are not installed in the current tree. Do not invent `apps/web` commands, test files, or a passing baseline.
- API examples in the handbook are proposed, while current OpenAPI has `paths: {}`. Derive fixtures from an agreed contract or working handler, and document any temporary assumption.
- Citations must come from server-provided metadata; an `insufficient_evidence` result must not display invented citations. A technical error must not be tested as a valid refusal.

## Quality gates and failure handling

- Each applicable acceptance criterion has an executed check or an explicit unverified reason. Record exact commands and outcomes, including failures, skipped checks, and checks blocked by missing frontend or services. Never claim that a test passed unless it ran and passed.
- A test is useful only if it would fail for a plausible user-visible regression. Keep fixtures independent of implementation internals, isolate tenant/user data between cases, and investigate failures before changing expectations.
- If no runnable frontend exists, produce the test map and setup prerequisites, then defer execution honestly. If a contract or backend endpoint is absent, test only the isolated UI behavior supported by known shapes and hand off integration verification to the owning team.

## Output, handoff, and next action

Report acceptance criteria, test level and case selection, executed commands/results, browser and accessibility observations, remaining risks, and blocked dependencies. Return failures to the feature owner with reproduction steps and evidence. Next, run the missing end-to-end contract checks when their frontend and services become available.
