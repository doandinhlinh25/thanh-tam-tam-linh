# Auth features — Scout — 2026-11-23

## 1. Request and scope
User: "ok, giờ hãy rebase lại dự án rồi làm các tính năng liên quan đến auth, tạo nhánh mới liên quan đến tính năng đã sửa và tôi tên là duy-tam".
Approved product direction: logout all devices, list/revoke sessions, self-service profile, verified email change, 2FA, and login history. Only Auth source and associated contracts/tests/docs should change. No push, PR, production migration or Tenant features authorized in this request.

## 2. Project overview
Verified: Auth is an Express/TypeScript npm workspace using Mongoose, JWT HS256 in tokenAdmin, Joi validation, bcrypt/Argon2 passwords and nodemailer. MongoDB transactions require replica set. Existing controllers/routes/services structure must be preserved.
Sources: services/auth-service/package.json, routes/admin/account.route.ts, services/auth.service.ts, config/database.ts.

## 3. Git preflight and requested rebase
Worktree: D:/SoftwareEngeering/duy-tam-auth-fix.
On first inspection, feature branch feat/duy-tam-auth-features-20261123 already existed and was clean. Its creation is not claimed as a new operation in this turn.
Executed git fetch origin Linh main successfully, then git rebase origin/Linh successfully: already up to date, no conflicts.
HEAD and verified origin/Linh both fa481e1abad589512f52ad58c44977eac2a8496b.
Auth PR #13 and Tenant PR #14 are already in this baseline (merge commits 672236f and fa481e1). No reapplication/cherry-pick of those patches needed. Local/shared branch histories and all other worktrees preserved. No remote writes.

## 4. Relevant implementation
- routes/admin/account.route.ts: login/logout/me/csrf/password endpoints; Origin and CSRF middleware.
- controllers/admin/account.controller.ts: HTTP cookies; current logout only clears cookie.
- services/auth.service.ts: login, current account checks, authVersion, CSRF, password/reset/activation.
- models/account-admin.model.ts: existing fullName/avatar/phone/description; email unique; no MFA/session model.
- models/auth-audit.model.ts: userId/action/outcome/timestamps only.
- models/action-token.model.ts: one-time hashed reset/setup tokens; no email-change purpose.
- middlewares/admin/auth.middleware.ts and controllers/internal.controller.ts: shared identity resolution; both must enforce revoked sessions.
- config/super-admin.config.ts: environment-backed Super Admin, not an ordinary Mongo account.
- services/account.service.ts: admin account edit is not a self-service profile endpoint.
- test/platform.integration.ts: actual Auth/Tenant/Mongo integration harness.

## 5. Verified gaps and proposed implementation direction
1. Session lifecycle: add hashed jti session records, expiry, revocation, bounded device metadata; enforce sessions in public and internal identity resolution. List only caller sessions, revoke only caller sessions, logout-all includes current session. Existing cookie-only logout semantics change and legacy JWT rollout must be explicitly defined in plan. Never return raw JWT/jti hash.
2. Self profile: allow only fullName/phone/description/avatar reference; forbid role/status/email/password changes through profile. Existing account-admin fields reusable. Avatar upload/storage pipeline is outside Auth unless separately approved.
3. Email change: reauthenticate, issue hashed one-time expiring token for proposed normalized email; leave current email unchanged until confirmation; handle unique-index races and reserved Super Admin email; revoke sessions on completion. Super Admin email remains environment-managed.
4. 2FA: proposal is TOTP with enrollment confirmation, authenticated disable, hashed recovery codes and short-lived login challenge. No normal JWT before successful second factor. Secret encryption key and dedicated library require explicit design approval; never put values in docs. Define Super Admin behavior without making environment credential an MFA bypass.
5. Login history: account-scoped bounded pagination; capture successful/failed attempts with safe metadata; never expose other users or raw credentials. Denied attempts currently omit userId, so ownership and anti-enumeration require deliberate design. IP must use verified proxy policy, not arbitrary forwarded headers.
6. Tests/contracts: positive and denied cases for each new endpoint; revoked JWT denied by Auth and Tenant introspection; concurrent one-time tokens/recovery codes; email uniqueness; no identity/secret leaks; existing login/password/Super Admin regressions.

## 6. Available verification
From root package.json: npm run build; npm run typecheck; npm test (Node workspaces and platform integration, not frontend). No test run is claimed in this scout. Prior 28-test result belongs to earlier feature patches, not these unimplemented features.

## 7. Constraints, risks and unknowns
Verified: root AGENTS.md requires one workflow stage per request; scout forbids source/config edits; cook requires an approved implementation plan for substantial changes.
Unknown: agreed legacy-session rollout, TOTP provider/dependency/encryption configuration and Super Admin MFA storage policy. Product feature list approval does not specify these contracts. Existing API responses and original duy-tam formatting should remain compatible; no broad architecture refactor.
No real .env read/edited, no dependencies installed, no source changes, no remote push/merge.

## 8. Recommended next step
Create and approve a concrete implementation plan covering the six agreed Auth features and the security/rollout decisions above, then implement on the existing isolated feature branch. Suggested order: sessions/logout-all; self-profile; verified email change; login history; 2FA; contracts/regression tests. New source work remains pending the plan gate.