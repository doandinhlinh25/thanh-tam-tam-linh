# Chat / Tenant / Auth contract correction
Scope authorized by the user's direct request to inspect/fix Auth/Tenant, preserve correct behavior and confirm no-course, feedback, reason codes and runtime responsibilities.
Base: Linh 9b7b910; branch fix/chat-tenant-auth-contract-20261117, separate worktree.
Verified gaps: no no-course tenant context endpoint; feedback supported in CourseService but rejected in validator; every upstream Auth 401 incorrectly classified as invalid session.
Implementation: additive context endpoint; active tenant/member lookup with Auth identity only; additive internal reasonCode; upstream service misconfiguration becomes 503, unknown protocol fails closed; add feedback action without changing CourseService.
CSRF: context optionally verifies forwarded session-bound header and explicitly returns csrfVerified false when absent; public Chat mutations must validate Origin and require true. No secret/hash returned.
Preserve: courseId required for existing check/quota; JWT signing, login/logout, existing public CSRF/Origin, ACL/business data models, gateway and Chat implementation.
Verification: actual Auth/Tenant on a temporary Mongo replica set; positive/negative context, tenant/member/account states, forging, CSRF, feedback course scope, wrong incoming credential, wrong Tenant-to-Auth credential, unavailable/malformed upstream. Full Node build/typecheck/tests.
No paid service, migration, .env change, deployment, commit/push/PR is part of this request. Contract and service documentation are the handoff to Chat.
