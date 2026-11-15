# Coordination: 2026-11-14-04-01-chat-auth

- Integration owner: Member 04 (Chat) after Technical Lead clears Cook gate
- Integration branch: Pending Git strategy approval and refreshed main/PR #8 state
- Base commit: `a8d548fa1d6b3bb603e151d2215f53daf7436d2f` (`feat/chat-persistence`, local baseline)

| Plan task | Owner | Branch / worktree | Files owned (exclusive) | Status | Depends on |
|---|---|---|---|---|---|
| T1 Auth/Tenant contract | Member 02 | To be assigned by 02 | `services/auth-service/**`, `services/tenant-service/**`, Auth/Tenant contract artifacts and tests | `blocked` | 02 decisions below |
| T2 Trusted context/client | Member 04 | Pending Cook gate | Chat config/dependency/context and new Tenant client files | `blocked` | T1 contract and credential details |
| T3 Course chat | Member 04 | Same authorized Chat worktree | Chat controller/service and course-chat tests | `blocked` | T1, T2 |
| T4 Personal/history/continuation | Member 04 | Same authorized Chat worktree | Chat/conversation controllers/services/repositories and associated tests | `blocked` | T1 no-course, selection and revoke policy; T2 |
| T5 Feedback | Member 04 | Same authorized Chat worktree | Feedback controller/service, message/conversation repository changes and tests | `blocked` | T1 actions/revoke; T2; serialize against T4 |
| T6 Error/config/OpenAPI | Member 04 with 02/platform | Shared Chat worktree; owner per file below | Chat error/config/OpenAPI; platform-owned gateway files only by platform | `blocked` | T1–T5 and platform contract |
| T7 Security/integration tests | Member 04 with 02/QA | Test ownership to be coordinated | Chat tests by 04; Auth/Tenant tests by 02; E2E fixture by QA/02 | `blocked` | T1–T6 and real fixture |

## Shared files

No two owners may edit the same file concurrently without updating this record first. Member 02 owns all Auth/Tenant source and service tests. Member 04 owns Chat source, Chat tests and Chat OpenAPI. Platform owns gateway configuration. For `services/chat-service/.env.example` and shared sandbox Compose, Member 04 coordinates the exact diff with current local owner before touching it. Existing `.env.example` modifications and untracked user artifacts must remain intact.

Conflict-prone Chat paths include `app/api/controllers/chat_controller.py`, `conversation_controller.py`, `feedback_controller.py`, `app/api/router.py`, `app/dependencies.py`, `app/domain/value_objects/tenant_context.py`, Chat/conversation/feedback services, repositories, `tests/integration/test_chat_api.py`, and `contracts/openapi/chat.yaml`. These are assigned exclusively to Member 04. Tenant route/validator/controller/service changes are assigned exclusively to Member 02. If a contract file spans ownership, 02 drafts/owns it and 04 reviews through a proposed diff, without concurrent edits.

## Dependencies requiring Member 02 decision

| Dependency | Owner | Proposed contract | Decision requested | 04 work blocked | Expected acceptance evidence |
|---|---|---|---|---|---|
| Resolve-by-course Chat→Tenant | Member 02 / Tenant | Internal request carries `courseId`, server-allowlisted `action`, forwarded `tokenAdmin` cookie and Chat service bearer. Tenant resolves tenantId from course data, introspects Auth, applies membership/course ACL, and returns verified identity/scope/decision. This is new/proposed; existing `/internal/authorization/check` requires `tenantId` and already returns allow plus user/tenant on success. | New endpoint or approved compatible extension; deny/not-found behavior; exact route and caller authorization | T2/T3 | Tenant contract test proves course→tenant lookup and that caller-supplied tenant headers cannot set identity/scope |
| Request/response schema | Member 02 / Tenant | Strict schema for IDs, action enum, envelope, `allowed`, `userId`, `tenantId`, `courseId`, error reason and correlation ID | Required fields, casing, validation/status rules, schema version | T2/T3/T6 | Contract tests reject unknown/malformed IDs and inconsistent scope; valid allow/deny fixtures |
| Personal/history no-course auth | Member 02 with Document owner | Contract identifies session and authorized tenant/document/history scope without assuming course exists | API and action policy for personal chat, history list/detail/delete and resources spanning courses | T4 and release of personal routes | Tests show membership and ownership checks for no-course routes and no data returned before allow |
| Multi-tenant user selection | Member 02 + Product | Client selector selects context only; Tenant proves membership and authorization. No implicit default tenant. | Selector source/format, missing/ambiguous selection behavior | T4 | User in two tenants can select only an authorized context; absent/invalid selector has defined safe result |
| History/feedback after revoke | Member 02 + Product | Reauthorize resource actions on each request; retention/read-after-revoke policy explicit | Whether history is denied, read-only or selectively available after membership/enrollment revoke | T4/T5 | Integration tests revoke membership/enrollment then assert the selected read/write policy |
| Session vs S2S errors | Member 02 / Auth + Tenant | Machine-readable `SESSION_INVALID` distinct from `SERVICE_UNAUTHORIZED`, `AUTH_UNAVAILABLE`, `AUTHZ_DENIED`, malformed upstream | Codes, status semantics and propagation through Tenant | T2/T6 | Wrong S2S credentials never map to public user-session 401; invalid user session does |
| `CHAT_SERVICE_TOKEN`, URL, timeout, rotation | Member 02 / ops | Dedicated least-scope Chat→Tenant bearer, configured Tenant base URL and bounded timeout; documented rotation | Secret provisioning mechanism, env names, network path, timeout and rotation ownership | T2/T6/T7 | Non-secret config examples, deployment wiring and wrong-token/timeout tests |
| Cookie forwarding, CSRF, Origin, gateway | Member 02 + platform | Forward only required `tokenAdmin` to Tenant; define unsafe-method CSRF/Origin checks and gateway cookie route | Trust boundary, CORS/CSRF responsibility, cookie attributes and gateway route | T2/T6/release | Integration verifies cookie reaches Tenant/Auth securely and writes reject missing/invalid CSRF per contract |
| Two-tenant fixtures and live test environment | Member 02 + QA | Isolated tenant A/B, users A/B, courses, sessions, memberships and runnable Auth/Tenant/Chat dependencies | Fixture owner/lifecycle, CI/runtime availability, secrets-free test provisioning | T7 and E2E acceptance | Reproducible E2E proves bidirectional isolation for evidence, conversations, deletion and feedback |

## Integration steps

1. Member 02 resolves the tabled decisions, implements the Auth/Tenant contract and reports contract-test evidence.
2. Technical Lead refreshes PR #8/main state and approves Git path and Cook start. Preferred path is wait for PR #8 to merge, then create a security branch from refreshed main. If work must precede merge, obtain explicit Technical Lead approval for a stacked branch/PR based on PR #8.
3. Member 04 implements Chat integration against the approved contract. No shared-file concurrent edits; update this record before any ownership change.
4. Integrate contract 02 → Chat 04 → service integration tests → real two-tenant E2E.
5. Run `$test` on integrated result, then `$review`. No auto-merge. Keep Cook blocked until prerequisites are accepted.
