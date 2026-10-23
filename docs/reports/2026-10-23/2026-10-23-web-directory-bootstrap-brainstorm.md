# Brainstorm: Complete the frontend structure from assignment 01

## Problem statement

The user asked: “giúp mình tạo ra thư mục đầy đủ cho web như trong file 01-frontend-Thanh.md yêu cầu”.

The assignment describes a React/TypeScript frontend with routing, theme, API client, query cache, loading/error behavior, login/session/tenant/course flows, document ingestion, RAG chat/citations/feedback, minimal tenant administration and Playwright tests. The live app is already a role-based mock demo, but lacks URL routing, API/query infrastructure, real contracts, and a frontend test suite. The core decision is whether to build the structure around the present demo or make live integration a prerequisite.

Affected users: students, lecturers/teachers, and organization administrators. Product data and access boundaries span Identity/Tenant, Document, and Chat owners.

## Goals and non-goals

### Goals

- Create an understandable, maintainable frontend structure corresponding to the assignment.
- Preserve the existing student, teacher, and admin demo flows and the in-progress upload/evaluation work.
- Put future API calls behind a single gateway-facing boundary, typed from checked-in contracts when available.
- Establish runnable frontend verification, including user-visible UI tests; isolate mock behavior from future live adapters.
- Deliver run instructions, screen-to-contract/API mapping, and a handoff that identifies service dependencies.

### Non-goals

- Implement Identity, Tenant, Document, Chat, storage, ingestion worker, or AI evaluation backend.
- Guess public API URLs, resource DTOs, cookie/CSRF policy, polling states, or authorization behavior.
- Claim that client-side role presentation authorizes access, that mock citations are backend verified, or that demo uploads are real.
- Replace existing role/product behavior without a separately approved scope.

## Requirements

### Confirmed

- **Source-confirmed:** Assignment requires React + TypeScript + Vite, routing, theme, API client, query cache, loading/error states, frontend tests, login/logout/session, tenant switch, course access, upload/ingestion states, RAG chat/citations/feedback, minimal tenant administration and Playwright E2E. [Assignment](../../documents/assignments/01-frontend-Thanh.md)
- **Source-confirmed:** Browser must call public Kong routes only, never internal service endpoints. [Assignment](../../documents/assignments/01-frontend-Thanh.md)
- **Source-confirmed:** Do not store session tokens in `localStorage`; cookie/CSRF behavior must follow the agreed Auth contract. [Assignment](../../documents/assignments/01-frontend-Thanh.md)
- **Source-confirmed:** UI must not invent citations; backend remains authoritative for permissions. [Assignment](../../documents/assignments/01-frontend-Thanh.md)
- **Source-confirmed:** The assignment targets at least ten valuable UI tests and a lecturer upload → READY → student question → citation → feedback flow, plus cross-tenant denial. [Assignment](../../documents/assignments/01-frontend-Thanh.md)
- **Verified current constraint:** `contracts/openapi/common.yaml` currently contains `paths: {}`; the existing services are skeletons and no frontend operation contracts are available. [OpenAPI](../../../contracts/openapi/common.yaml), [Scout](2026-10-23-web-directory-bootstrap-scout.md)
- **Verified current behavior:** Current web demo uses local synthetic fixtures/state and has working React/Vite/TypeScript scripts. It is not API-backed. [apps/web README](../../../apps/web/README.md)
- **User-work constraint:** Preserve the current dirty `thanh/init-fe` worktree and the untracked `.aws` path; do not clean, reset, stash, or silently switch branches.
- **User-confirmed branch preference:** Continue on `thanh/init-fe`, as explicitly requested earlier in this project thread. The worktree is dirty, so make changes in place without branch switching or cleanup.

### Proposed

- Keep the existing role pages as the initial presentation layer and migrate by feature slice rather than replacing the app in one large rewrite.
- Introduce an explicit data boundary with separate demo/mock implementation and future gateway implementation. Do not add resource operations until a versioned contract or working handler exists.
- Add route-level loading, empty, denied, error and success states wherever the agreed operation supports them.
- Add a frontend test harness and prioritize at least ten meaningful UI cases for implemented flows. Use clearly labeled mocks for UI cases, but reserve real cross-tenant E2E claims for a deployed contract-backed environment.
- Add an API/screen mapping artifact that labels each operation as `implemented`, `mock-only`, or `blocked on owner contract`.
- Retain the user's preference to work on `thanh/init-fe`; implement in place without touching the existing task's unrelated user changes.

### Assumptions

- “Thư mục đầy đủ” means completing frontend architecture and assignment deliverables, not creating empty directories alone.
- The user wants useful frontend progress while backend teams are still implementing contracts, so a mock-backed application shell and isolated adapter seam are acceptable.
- The current role-based mock demo remains the visual and interaction baseline unless BA changes a particular workflow.

## Options and trade-offs

| Option | Description | Complexity / maintainability | Compatibility and security | Cost / risk |
| --- | --- | --- | --- | --- |
| **A. Contract-ready frontend around the current demo (recommended)** | Add a router, shared theme/layout boundaries, API transport/query layer, and frontend test setup; keep current screens operating through an explicit mock adapter. Add production operations only after owners publish contracts. | Moderate and incremental; preserves existing feature work while creating clear module ownership. | Aligns with Kong-only browser calls, cookie/CSRF rules and server authorization. No guessed resource routes/DTOs. Mock and live paths can be labeled separately. | Some adapter/test scaffolding is added before services exist; UI still cannot claim real integration or prove backend isolation. |
| **B. Wait for all contracts and handlers, then build the frontend architecture/integration** | Pause frontend work until Identity/Tenant, Document and Chat owners deliver versioned operations and runnable services. | Lowest risk of contract churn; larger later delivery wave. | Strongest basis for typed production calls and true E2E. Existing demo continues without architectural changes. | Does not meet the near-term request to complete the web folder; blocks useful UI/test setup on cross-team timelines. |
| **C. Mirror handbook APIs as assumed contracts now** | Invent DTOs/routes based on handbook examples and build query/client flows against them before owners agree. | Fast initial coding, likely rework across all feature modules. | Conflicts with current Kong prefixes and no OpenAPI paths; risks false auth/citation/tenant behavior and wrong cache/error rules. | Highest integration and security risk; not recommended. |

### Trade-off notes

- No query library or router is established in the current web package. Option A may choose and add dependencies in the plan, but only after confirming toolchain compatibility and scope; it should not assume those packages are already installed.
- Current app supports PDF/DOCX in demo screens, while the assignment's real upload asks for PDF. Production formats, MIME/size/quota rules and ingestion states must come from Document contracts.
- Mock UI tests can prove rendering and interaction with a known fixture shape; they cannot prove session, CSRF, tenant authorization, or cross-tenant denial.

## Recommendation

Choose **Option A**. Create the frontend structure as a contract-ready evolution of the existing mock app: centralize navigation and shared UI foundations; define the gateway transport/cache boundary; keep demo adapters explicitly isolated; add interaction test tooling and a contract-to-screen matrix. Migrate current workflows incrementally and preserve their demo labels.

For every missing operation, show a clear blocked/demo state and record the owner/contract needed. Do not send requests to guessed endpoints or fabricate resource DTOs. Add live auth, tenant switching, upload/polling, chat/citation/feedback, or tenant admin operations only in a later slice when their contracts are checked in.

Option B wins if the desired deliverable is only production API integration and no mock-backed progress is useful. Option C should not be selected given the contract/gateway mismatch.

## Edge cases and failure scenarios

- Missing or expired session; server `401` versus `403`; tenant membership removed while a page is open.
- Switching tenant/course while requests are in flight; prevent stale results or prior-tenant cache entries from rendering in the new scope.
- Forbidden course selection and direct navigation to a restricted page; UI may guide users, but server denial remains authoritative.
- Upload invalid type, scanned PDF, quota, transport failure, ingestion failure, retry, cancellation, duplicate submission, and status polling that outlives navigation.
- Chat answered with validated citations, insufficient evidence with no citations, provider/transport error that is not mislabeled as refusal, malformed response, and stale responses after course switch.
- Large/paginated course/document/feedback lists, empty states, and long labels/citations on narrow viewports.
- Mock adapter and future API adapter must not accidentally share state or allow synthetic citations to be presented as server-verified.
- No live API scenarios can be meaningfully E2E-tested until service contracts, test environment and seed identities/data are available.

## Proposed acceptance criteria

1. Existing React/Vite/TypeScript demo pages and current in-progress student upload/evaluation changes remain available after the structural refactor.
2. Navigation is represented by explicit URL routes with role-aware view presentation, and unknown routes show a recoverable not-found state; route guards are not presented as authorization.
3. Shared theme, feature/page modules, typed domain/view models and reusable loading/empty/error/denied/success states have clear ownership and documented paths.
4. Browser data access has one centralized public-gateway transport boundary; no API route string is scattered across UI components, no internal-service URL is used, and no resource endpoint/DTO is introduced without a checked-in contract.
5. Session design does not store tokens in local/session storage. Until an approved cookie/CSRF contract is wired, demo auth remains explicitly synthetic and is isolated behind an adapter.
6. Mock fixtures/adapters are clearly separated from future live operations; mock citations and uploads remain identified as synthetic.
7. Course/tenant-scoped client data, once contract-backed, has documented cache scoping/invalidation and stale-request behavior; cross-tenant denial is not claimed based on mock tests.
8. A frontend test toolchain is configured and at least ten valuable UI tests exercise supported behaviors such as auth form states, role navigation, upload validation/progress/failure, answered citation/refusal/error states, feedback, and tenant/course-scoped UI behavior where currently implemented.
9. A Playwright path is documented and runnable against an isolated test/mocked environment for the frontend journeys currently supported; a real lecturer-upload-to-student-citation and cross-tenant authorization E2E is explicitly blocked until services/contracts/test environment exist.
10. README includes setup/run/check commands; a screen-to-API/contract map distinguishes implemented, mock-only and blocked operations; demo screenshots/wireframe are delivered or marked unavailable with reason.
11. Frontend build, typecheck, and configured tests pass; CI/test setup does not weaken backend security checks.
12. Work remains on the user-selected `thanh/init-fe` branch without disturbing existing dirty changes or `.aws`; no commit/push/merge occurs unless separately authorized.

## Unresolved decisions

1. **Choose scope: Option A (recommended), B, or revised direction.** Recommendation: A, because the present demo can be preserved while the future integration boundary and testable structure are built safely.
2. **Confirm the definition of “full”:** Should this task target the complete mock-backed frontend architecture and test setup now, while deferring real backend operations to their contract owners? Recommendation: yes; otherwise the task is blocked because the specified contracts do not exist.
3. **Branch policy is already confirmed:** Continue on the user's selected `thanh/init-fe` branch. The worktree is dirty, so edit in place and preserve every pre-existing path; do not switch, stash or clean.

After approval, proceed to `$plan` with Option A (or the user-selected direction), ordered by structural foundation → migration of existing views → tests/docs, and list explicit contract-dependent work as deferred rather than guessed.
