# Chat / Tenant / Auth contract verification — 2026-11-17

Base: Linh 9b7b910. Worktree: D:/SoftwareEngeering/chat-auth-tenant-work. Branch: fix/chat-tenant-auth-contract-20261117.
Scope: the user's requested Auth/Tenant contract corrections, documented internal contract, and regression tests. No Chat implementation, CourseService rules, public login/logout, gateway policy, DB ownership or secret values changed.

## Delivered behavior
- POST /internal/authorization/context authenticates Chat credential, introspects the forwarded user cookie, then requires an active/nondeleted selected tenant and membership. It returns trusted userId, canonical tenantId, role and an explicit csrfVerified result without a course.
- Optional forwarded X-CSRF-Token is verified against this session. Missing header returns false; wrong/cross-session header returns CSRF_INVALID. Chat still must validate browser Origin and require true for mutations.
- feedback:write is admitted by the existing course-check validator. courseId remains required and the existing CourseService remains unchanged.
- Internal reasonCode distinguishes incoming service credential failure from session failure. Tenant-to-Auth bad service credentials return 503/AUTH_SERVICE_CREDENTIAL_INVALID; unknown/malformed upstream 401 fails closed as 503/AUTH_RESPONSE_INVALID.

## Actual checks
| Check | Result |
| --- | --- |
| npm run build | PASS, all Node workspaces |
| npm run typecheck | PASS, all Node workspaces |
| npm test | PASS, exit 0: 28 total (root 8, common 4, HTTP 1, platform 15), no skips |
| New internal OpenAPI parsed with yaml | PASS |
| Existing CourseService/business models, Chat source, gateway diff | Empty |

New integration tests use actual Auth/Tenant processes and a new temporary MongoDB replica set. They cover selected tenant/member/account revocation and status, unknown tenant, platform admin without membership, forged headers/body claims, valid/missing/cross-session CSRF, feedback course scope, direct Auth reason codes and actual Tenant-to-Auth credential mismatch.

Upstream malformed/unknown/error responses and a refused connection are fault-injected using an isolated HTTP server; this is explicitly protocol-failure testing, not a claim that Chat runtime is integrated. Original cookie and correct internal Auth credential forwarding are asserted without logging their values.

The first run completed all 15 application tests but hung in teardown because a child stopped by signal had no exitCode. Only that verified test worker was stopped; the helper now checks signalCode as well. The final full suite exited 0. No failed/hung run is counted as passing.

## Review and rollout
Auth's additive reason codes must deploy before Tenant's strict upstream failure classification. HTTP status/code/message compatibility is retained where correct; new reasonCode is additive. Unknown upstream authentication failures deliberately do not become forced user logout.

Chat needs to consume this contract, configure its Tenant URL/token, validate Origin/CSRF and scope its own resources to trusted user+tenant. Those Chat/public gateway changes are outside this task and have not been claimed as tested.

No secret values were requested, exposed or changed. No production services, data migration, push, PR or merge were performed.

## Split PR validation scope
At the user's later request, Auth and Tenant are published as two independent branches based on Linh 9b7b910. The passing 28-test result above applies to both patches together in chat-auth-tenant-work. The new cross-service tests on the Tenant branch require the companion Auth reason-code fix; they are not claimed to pass against legacy Auth. Merge/deploy the Auth fix before Tenant. No changes to Auth source are included in the Tenant branch.
