---
name: frontend-api-integration
description: Integrate the frontend with versioned API contracts through the gateway, including typed DTOs, error handling, session boundaries, cache scoping, pagination, and cancellation. Use when browser data access or auth state changes; use frontend-forms for field validation and submission UX.
---

# Frontend API Integration

## Purpose and activation

Use this skill for browser requests, API types, session-aware data access, server-state caching, and request lifecycle changes in `apps/web/`. It does not define backend endpoints or implement server authorization. Use `frontend-forms` for a form's validation and feedback and `frontend-ui-engineering` for visual states.

## Inputs and inspection

1. Read the requested user flow, affected frontend code, checked-in OpenAPI, working handlers, gateway configuration, and relevant tests. Record method, path, request and response DTOs, HTTP status, error codes, pagination, permissions, session and CSRF behavior, and ownership for each needed operation. Check the actual deployed topology when available.
2. Use [frontend discovery](../../../docs/engineering/frontend-skill-discovery.md) as a starting inventory, then verify the live repository. `contracts/openapi/common.yaml` currently has `paths: {}`. [Kong configuration](../../../infrastructure/gateway/kong/kong.yml) names route prefixes, while the [handbook](<../../../docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md>) proposes different `/api/v1/...` routes. Neither is proof of a functional operation.
3. Check whether a related frontend client, query cache, or generated type pipeline exists before adding one. The frontend is empty at the discovery baseline, so no client or query library is established.

## Contract and implementation decisions

- Treat a checked-in versioned contract or working handler as the source for each operation. Resolve disagreement between OpenAPI, gateway, and handlers with the API owner before binding a production flow. Browser calls go through public Kong routes, never internal service routes. Keep base URL and route definitions central; do not scatter strings through components.
- Define request and response types from the agreed contract. Decode untrusted JSON at the boundary where necessary; do not use a TypeScript assertion as runtime validation. The only shared response shape currently established is `successful: true` with `data` and `error: null`, or `successful: false` with `data: null` and `{ errorCode, errorMessage, fieldErrors }` in [the common package](../../../packages/common/src/index.ts). Resource-specific DTOs and error codes still require contracts.
- Normalize network failure, non-2xx HTTP response, malformed response, and API failure into states the UI can distinguish. Keep a stable error code and field errors when supplied; present safe, actionable messages without exposing raw server details. Do not turn a technical failure into a RAG “insufficient evidence” result.
- Follow the finalized session and CSRF contract. The [frontend assignment](../../../docs/documents/assignments/01-frontend-Thanh.md) plans cookie-based sessions; do not store session tokens in `localStorage` or infer login state from a client-side flag. Handle expired sessions and revoked membership as server decisions. A tenant ID selected in the UI requests context; it does not grant access. Protected routes may improve navigation but cannot authorize access. [Ownership](../../../docs/architecture/tenant-membership-ownership.md) and [gateway policy](../../../docs/architecture/kong-opa-authorization.md) describe the server boundary.
- Scope cache keys and invalidation by confirmed user, tenant, course, and filters where relevant. Clear or isolate prior tenant data on session and tenant changes. Honor contracted pagination and filtering. Cancel obsolete reads or ignore stale responses when navigation, filters, or tenant context changes. Retry only where the operation is safe and the contract supports it; avoid duplicate writes.

## Quality gates

- Every production call has a verified public route and typed request, success, and error handling. No internal endpoint, secret, session token, or authorization claim is embedded in the browser bundle.
- Relevant tests exercise success, structured API failure, transport failure, expired session or denied access, and stale or cancelled reads. Verify tenant changes cannot show prior tenant data. Run configured frontend typecheck, build, and relevant tests; report unavailable checks accurately.
- Confirm loading, empty, denied, error, and success states with the consuming UI. Review the changed request paths and the final diff against the contract map.

## Failure handling, output, and next action

When no functional operation or agreed contract exists, produce a concise contract gap with the needed route, DTO, status and error semantics, permissions, cookie/CSRF behavior, and owning team. An explicitly requested prototype may use isolated mock adapters with a visible limitation; it must not claim real integration.

Deliver an operation-to-screen map, client/type changes, test evidence, and unresolved contract gaps. Hand field-level validation to `frontend-forms`, UI state design to `frontend-ui-engineering`, and backend decisions to the responsible service owner. Next, reconcile the blocking API contract and re-run the flow against the real gateway.
