# Frontend screen-to-operation map

This map describes the current React demo and checked-in contracts. “Mock-only” means the visible behavior is backed by in-memory fixtures, not a browser request. “Blocked” means a production operation needs a versioned contract and a working public gateway route.

The only checked-in OpenAPI document currently defines shared success and error envelopes; [`contracts/openapi/common.yaml`](../../contracts/openapi/common.yaml) has `paths: {}`. Therefore no row below represents a production API integration.

| Screen / flow | Current implementation | Production operation | Status / owner dependency |
| --- | --- | --- | --- |
| Login, signup, logout | Seeded personas and temporary in-memory demo identity | Login, signup, current session, logout, expiry and CSRF behavior | Mock-only; Identity contract and gateway route required |
| Student home and course list | Seeded courses filtered by the demo persona | Current enrollments and course permissions | Mock-only; Tenant membership/course contract required |
| Student personal library | PDF/DOCX metadata is held in page state; file bytes are not sent or read | Course-scoped upload, validation, storage ownership, ingestion status, retry/cancel, list and delete | Mock-only; Document contract must resolve supported file formats, limits and state model |
| Teacher course and documents | Seeded assigned courses and shared course documents | Assigned courses, documents, upload and processing state | Mock-only; Tenant and Document contracts required |
| Student assistant and history | Fixed answers, canned refusal/error cases, fixture citations | Chat request/answer, history, refusal/error and verified citation metadata | Mock-only; Chat contract and Document citation linkage required |
| Answer feedback | Rating updates local chat message state | Create feedback against a server answer | Mock-only; Chat/feedback contract required |
| Teacher/admin feedback | Seeded feedback with local filters and details | List, paginate and filter feedback | Mock-only; feedback contract and role permissions required |
| Admin overview | Seeded metrics and feedback/evaluation summaries | Tenant-scoped operational metrics | Mock-only; metrics contract and Tenant authorization required |
| Admin AI evaluation | Fixed sample scores, deterministic local run, local question set and CSV/JSON export | Manage evaluation sets, run evaluation, retrieve result history and export | Mock-only; evaluation contract and evaluation service required |
| Admin courses and settings | Demo fixtures and local component state | Course management and tenant AI configuration | Mock-only; Tenant/course and configuration contracts required |

## Required contract details before connecting screens

- **Identity:** public route, method, request/response DTOs, cookie attributes, CSRF mechanism, expiration, logout behavior, and safe error semantics.
- **Tenant:** membership/course scope, role permissions, pagination/filtering, and behavior on tenant/course changes.
- **Document:** accepted formats, size and quota constraints, server content validation, ownership, upload response, ingestion lifecycle, retry/cancel/delete, and polling or event semantics.
- **Chat and feedback:** request/answer/refusal/error shapes, validated citation metadata and protected source access, history, and feedback operations.
- **Evaluation/admin:** set/question DTOs, run semantics, deterministic versus model-backed output, metric definitions, history/export, and permission boundary.

All future browser requests must use the shared public-gateway transport. A UI route, selected tenant/course, or mock role does not grant authorization. Cross-tenant denial and cookie/CSRF enforcement need service-level integration tests after the contracts and isolated fixtures exist.
