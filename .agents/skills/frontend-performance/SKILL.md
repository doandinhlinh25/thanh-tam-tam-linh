---
name: frontend-performance
description: Diagnose and improve measurable browser performance for document lists, course views, RAG conversations, uploads, and other frontend flows. Use when performance is a requirement or a measured problem; ordinary UI construction belongs to frontend-ui-engineering.
---

# Frontend Performance

## Purpose and activation

Improve a user-visible frontend bottleneck with evidence, while preserving correct tenant, course, and conversation behavior. Use for a performance target, a measured slow flow, or a feature expected to handle substantial data. Do not add caching, virtualization, or dependencies solely because a page could someday be large.

## Inputs and inspection

- Read the affected flow, acceptance criteria, actual frontend source and scripts, API contract, and [frontend discovery](../../../docs/engineering/frontend-skill-discovery.md). `apps/web/` is currently empty; React/Vite/query caching and Playwright are plans, not installed tools.
- Reproduce with representative document or conversation volume, device, viewport, and network conditions. Record the baseline metric and trace whether delay comes from request latency, payload size, JavaScript, repeated renders, layout, assets, or long lists. Inspect existing caches, cancellation, paging, and tenant/course cache keys before changing them.
- If a runnable frontend does not yet exist, identify the likely load shape and specify a measurement scenario for the first implementation; do not fabricate numbers or run root Node workspace checks as frontend checks.

## Decisions and execution

1. Choose the smallest change supported by the profile. Remove unnecessary work before adding memoization or a new library. Keep UI state local where appropriate and avoid repeated data fetches or broad cache invalidation.
2. For document, course, or conversation lists, prefer contracted server pagination or incremental loading and stable keys. Confirm ordering and cursor semantics before implementing them. Consider virtualization only when measured rendering cost warrants it and keyboard access, focus, and assistive technology remain usable.
3. Scope server-state cache keys by tenant, course, user, and filters as needed. Set freshness and invalidation to the real data lifecycle; prevent stale protected data from appearing after tenant switch or logout. Cancel obsolete requests where rapid selection changes can race.
4. Split or lazy-load a measured heavy route or feature after checking the loading experience. Optimize images, PDFs, and other assets without hiding content or compromising citation access. If server or retrieval latency dominates, give the responsible team the trace and expected contract behavior.
5. Measure again under the same conditions. Record any trade-off in latency, bundle weight, memory, network use, and interaction quality that matters to the user.

## Verified project conventions

- The root `package.json` workspaces cover `packages/*` and `services/*`; its build, typecheck, and test scripts do not run a frontend. Discover frontend commands from the actual scaffold when it exists.
- No current API contract guarantees pagination, streaming, or a query cache. The frontend must not invent those behaviors or silently load all tenant data to simulate them.
- UI permission checks are convenience only. Performance changes must preserve service authorization and tenant separation.

## Quality gates and failure handling

- For an optimization, compare before and after using the same scenario and report the metric, method, and result. Meet an agreed target when one exists; otherwise show a concrete improvement without regression in correctness, accessibility, or protected-data handling.
- Exercise long content, changing filters, tenant switches, cancellation/races, loading, empty, and error states affected by the change. Run only available project checks and name any measurements or builds that could not run.
- If no baseline or runnable frontend is available, deliver a measurement plan and implement only performance decisions already necessary for correct bounded data handling. If a server contract blocks paging or caching correctness, hand off the needed contract rather than masking the bottleneck.

## Output, handoff, and next action

Report the scenario, baseline, diagnosis, changed files, after measurement, checks, and remaining bottleneck. Hand testable scale and race scenarios to `frontend-testing` and API or service needs to their owners. Next, address the largest measured remaining cost only if its impact justifies the change.
