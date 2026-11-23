# Chat ↔ Tenant ↔ Auth: confirmed internal contract

Implementation baseline: Linh 9b7b910; fix branch fix/chat-tenant-auth-contract-20261117. Scope: Auth/Tenant authorization only. Chat routes/persistence, gateway policies, quotas and CourseService rules are not implemented or broadened by this change.

## 1. No-course identity and selected-tenant context

Chat calls POST /internal/authorization/context with:
- Authorization: Bearer CHAT_SERVICE_TOKEN (configured by the Chat server, not copied from a browser Authorization header).
- Cookie: the original user Cookie header containing tokenAdmin.
- Content-Type: application/json.
- Body: {"tenantId":"<selected ObjectId>"}.
- Optional X-CSRF-Token forwarded from a public browser request.

The tenantId is an untrusted selector. Tenant obtains userId only from Auth introspection, then requires both the selected tenant and this user's membership to be active and not deleted. A platform admin without that membership is denied. User/role/tenant claims in X-User-Id, X-Tenant-Id or a request body are not identity evidence; extra body fields are rejected.

Success shape:
```json
{
  "code": "success",
  "successful": true,
  "data": {
    "allowed": true,
    "userId": "<Auth-verified ObjectId>",
    "tenantId": "<canonical selected tenant ObjectId>",
    "role": "student",
    "csrfVerified": false
  }
}
```

No course is needed. A valid forwarded X-CSRF-Token makes csrfVerified true; an invalid/empty/cross-session token returns 403/CSRF_INVALID. An absent token yields false so read-only history can resolve context without pretending a write was verified. No raw JWT, csrfHash or signing secret is returned.

This context is not course authorization, personal-document ownership, conversation ownership or quota consumption. Chat must scope personal documents/conversations/messages/feedback to the returned userId AND tenantId and verify ownership in its own service. For a course-backed operation, resolve courseId from a trusted server record/path and call the course authorization contract as well; context must not bypass course ACL. A no-course personal operation must not fabricate a course ID.

## 2. Course and feedback checks

POST /internal/authorization/check still requires {"tenantId":"...","courseId":"...","action":"..."} and both CHAT_SERVICE_TOKEN and the forwarded cookie.

Allowed actions: course:read, document:read, chat:ask, feedback:write. feedback:write now reaches the existing CourseService rule; membership, assignment/enrollment, tenant/course state and cross-tenant checks remain unchanged. Missing courseId stays a validation error. This endpoint checks permission only; Chat still checks ownership of the message/conversation receiving feedback. Personal feedback without a course uses verified context plus ownership, not this course endpoint.

POST /internal/quota/chat/consume also continues to require courseId. No personal-chat quota API is added.

## 3. Error reasons and caller behavior

Existing code/message and status fields are preserved; reasonCode is additive for these internal failures.

| HTTP | reasonCode | Meaning / Chat handling |
| --- | --- | --- |
| 401 | SERVICE_CREDENTIAL_INVALID | Incoming Chat/Document service credential is absent, wrong or not configured. Server-to-server/configuration fault; do not log out the user. |
| 401 | SESSION_INVALID | With a valid service credential, user cookie/JWT is missing, malformed, expired or no longer valid for the account. Require sign-in again. |
| 403 | TENANT_ACCESS_DENIED | Selected tenant or membership is missing, inactive, suspended, revoked or deleted. Deny selected context without exposing which check failed. |
| 403 | COURSE_ACCESS_DENIED | Course check failed under the existing course policy. |
| 403 | CSRF_INVALID | Forwarded header is not a valid CSRF token for this session. Reject the public mutation; do not treat it as bad service credentials. |
| 503 | AUTH_SERVICE_CREDENTIAL_INVALID | Tenant's AUTH_TENANT_TOKEN was rejected by Auth. Dependency/configuration error, not an invalid browser session. |
| 503 | AUTH_SERVICE_UNAVAILABLE | Auth cannot be reached or returns an upstream server error. |
| 503 | AUTH_RESPONSE_INVALID | Auth returned malformed data or an unrecognized 401; fail closed without falsely reporting session expiry. |

Service credential is checked BEFORE user session. Never interpret every 401 as a logout instruction: inspect reasonCode. Chat should expose a dependency failure for service/configuration faults, without forwarding secrets or clearing tokenAdmin.

Deploy the additive Auth reason-code support before the updated Tenant client. Legacy/unrecognized Auth 401 responses intentionally map to dependency/protocol failure until Auth supplies the confirmed SESSION_INVALID reason.

## 4. Runtime configuration and forwarding

- Chat client should use TENANT_SERVICE_URL as its configured Tenant base URL; this is a client configuration contract, not a claim that the existing Chat implementation already reads it.
- Ordinary local Node start: http://127.0.0.1:4002. Host access to the sandbox: http://127.0.0.1:14002. Chat on the same sandbox Docker network: http://tenant:8080. Choose the address reachable from the Chat process; localhost in a container is not the Tenant container.
- Tenant and Chat must have the same CHAT_SERVICE_TOKEN, at least 32 characters. Document uses its separate DOCUMENT_SERVICE_TOKEN and cannot call Chat-only authorization routes.
- Tenant forwards Cookie to Auth and uses AUTH_TENANT_TOKEN for Auth service authentication. Do not give Chat AUTH_TENANT_TOKEN, JWT_SECRET or Super Admin credentials.
- JWT_SECRET stays only in Auth. Bearer service credentials are not the user's tokenAdmin JWT.
- Forward only to configured/trusted service URLs; never log Cookie, CSRF or service credential values.

## 5. Origin, CSRF and gateway boundary

Public cookie-authenticated Chat mutations must validate allowed Origin and forward the user's X-CSRF-Token to context, requiring data.csrfVerified === true before writing or invoking an action. A 200 context with false is sufficient only for read-only identity/membership resolution. Origin validation remains Chat's responsibility (or a specifically trusted edge integration); csrfVerified does not mean Origin was checked.

The internal context/check POSTs do not themselves require browser Origin: they authenticate a service and inspect session/permissions without performing Chat business writes. Tenant's existing public admin Origin/CSRF middleware is unchanged.

Gateway must not publish /internal routes or let client-supplied identity headers act as trusted claims. Existing Kong/OPA default-deny stays unchanged. Chat must still enforce authorization/ownership even when a gateway is present. This change does not assert that public Chat routes, CSRF integration or gateway routing are already deployed.

Machine-readable contract: contracts/openapi/tenant-authorization.v1.yaml.
