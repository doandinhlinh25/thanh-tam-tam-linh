# Cook validation: sáu tính năng Auth

Ngày: 2026-11-23 (Asia/Bangkok). Nhánh: feat/duy-tam-auth-features-20261123.
Baseline: fa481e1abad589512f52ad58c44977eac2a8496b. Toàn bộ feature nằm trong working tree, chưa commit/push.
Kế hoạch đã được duy-tam duyệt trực tiếp trong cuộc hội thoại; xem docs/plans/2026-11-23/duy-tam-auth-features.md.

## Kết quả triển khai

| Tính năng | Hành vi đã triển khai |
| --- | --- |
| Đăng xuất tất cả thiết bị | Password và factor nếu bật MFA; tăng security version và thu hồi mọi phiên/challenge; xóa cookie |
| Quản lý phiên | Danh sách phiên active/pagination/current; thu hồi riêng theo owner; logout hiện tại thu hồi server-side; legacy JWT không có session bị từ chối |
| Hồ sơ cá nhân | /me mở rộng; PATCH /profile chỉ fullName/phone/description/avatar HTTPS hoặc null; không sửa role/status/email; Super Admin giữ env-managed |
| Đổi email | Reauth ở request và confirm; email mới nhận opaque token hash một lần; gửi lại/hết hạn/chống race email unique; confirm thu hồi phiên và reset/setup token cũ |
| 2FA | TOTP qua OTPAuth 9.6.0; secret AES-256-GCM; enrollment xác nhận; login 202 không cấp JWT; 10 recovery codes hash một lần; disable/regenerate có reauth và rotate/revoke; hỗ trợ Super Admin không bypass |
| Lịch sử login | Outcome/method/safe IP/UA của chính user; pagination/filter; chỉ success sau MFA; dữ liệu mới có retention 90 ngày |

Auth/Tenant tiếp tục introspect cùng getIdentity, không chia sẻ JWT_SECRET hoặc truy cập chéo database. Cookie tokenAdmin/HS256 và hai router alias được giữ. Origin/CSRF/rate limit áp dụng cho các endpoint mới. Không sửa code Tenant/Chat/gateway.

## Tác vụ và file

- T1: contracts/openapi/auth-account.v1.yaml, configs/auth-feature.config.ts, dto/request/auth-features.request.ts và dto/response/auth-features.response.ts. Có 16 paths và shared error responses đã kiểm tra references.
- T2: models/auth-security.model.ts, auth-session.model.ts; repositories/auth-security.repository.ts; services/session.service.ts; auth.service/account.service hooks, login/logout controllers và middleware. Replica set prerequisite ở config/database.ts.
- T3: services/profile.service.ts và /me/profile handlers, schema account hiện hữu được tái sử dụng.
- T4: models/email-change-token.model.ts, services/email-change.service.ts; mail token tách với reset/setup password.
- T5: models/auth-challenge.model.ts, helpers/mfa-crypto.helper.ts, services/mfa.service.ts, controller/routes/manifest/lockfile và ba tên biến mới trong .env.example.
- T6: models/auth-audit.model.ts, helpers/request-metadata.helper.ts, services/login-history.service.ts, user-scoped rate counters.
- T7: database/migrations/20261123-auth-account-features.mjs, database/auth-models.md, README. Dry-run/apply chỉ được chạy trên database tạm trong test.
- T8: services/auth-service/test/auth-features.test.ts, test/auth-features.integration.ts, root test scripts; update đúng ba kỳ vọng logout cookie-only trong test/platform.integration.ts. Đưa security.integration.test.ts hiện hữu vào npm run test:auth-features.
- T9: kiểm tra scope, đọc diff/security paths và allowlist responses, kiểm tra OpenAPI/format/diff. Đây là self-check trong Cook, không tự nhận là review độc lập hay được phép merge.

## Sai khác nhỏ so với danh sách file dự kiến

Giữ model queries trong business services như pattern Auth hiện hữu; chỉ tách AuthSecurityRepository cho transaction/revision chung. Không tạo các repository bọc model thuần túy hoặc thư mục rỗng chỉ để khớp tên file dự kiến. Hành vi transaction, owner scope, indexes và data ownership giữ đúng thiết kế. Không thêm dependency ngoài OTPAuth và transitive @noble/hashes của nó.

Không thêm field vào AccountIdentity hay sửa internal.controller: getIdentity vốn là điểm dùng chung, nên session enforcement tại đó đã áp dụng đồng thời cho middleware và introspection. Không cần trả session metadata/security state cho Tenant.

## Lệnh xác minh đã thực sự chạy

| Check | Kết quả |
| --- | --- |
| npm run build | PASS, tất cả Node workspaces; chạy riêng và trong npm test |
| npm run typecheck | PASS, exit 0, tất cả Node workspaces |
| npm test (lượt cuối) | PASS, exit 0; tổng 60 tests, không fail/skip/cancel |
| Breakdown | root 8 + common 4 + HTTP 1 + platform 15 + Auth suite 32 |
| Auth suite 32 | 3 unit crypto/TOTP + 8 security regression hiện hữu + 21 feature integration |
| OpenAPI parse/reference resolution | PASS; 16 paths, cả schemas/responses references được kiểm tra |
| Migration --help | PASS; không cần URI, không kết nối database |
| Migration dry-run/apply/reapply | PASS trên DB migration_test thuộc replica set tạm; dry-run không tạo collection/backfill; apply tạo indexes và backfill audit expiry; chạy lại thành công |
| Prettier | Đã format các source/contract thay đổi bằng cấu hình 2 spaces, double quotes, semi, no trailing comma, printWidth 100 của workspace |
| git diff --check | PASS |

Các lỗi trung gian được ghi nhận, không tính là PASS: typecheck Auth riêng ban đầu thiếu dist của common/http; root build tạo dependencies và các lần typecheck sau pass. Lượt feature integration đầu có 12/13 pass, assertion privacy nhầm nhãn method=password là giá trị password; đã sửa assertion kiểm tra field/value bí mật thật, không đổi production để né lỗi. Full suite cuối đã pass với assertion sửa và các ca bổ sung.

## Acceptance mapping

| AC | Bằng chứng chính | Kết quả Cook check |
| --- | --- | --- |
| AC1 | sessions legacy denial; introspection regression; state/status/version tests | PASS |
| AC2 | logout-all qua Auth/Tenant; Super Admin; source revision lock chung issuance/revoke | PASS |
| AC3 | sessions owner/current/cross-user/CSRF; server revoke và missing/invalid logout | PASS |
| AC4 | profile both aliases, strict allowlist, search, HTTPS/null avatar, Super Admin | PASS |
| AC5 | email ownership/resend/expiry/concurrent consume/unique target, SMTP refused | PASS |
| AC6 | RFC vectors, encrypted storage, pending enrollment owner/session/expiry, step replay | PASS |
| AC7 | password-only 202; remember preserved; challenge cap/expiry/version; parallel recovery; Super Admin alias | PASS |
| AC8 | regenerate/disable, reset preserves MFA, wrong encryption key 503, env password change retains MFA | PASS |
| AC9 | history own records/known failure, metadata cap, untrusted forwarded IP, pagination/extra fields, secret assertions | PASS |
| AC10 | existing security regression 8 tests + platform 15; service reason vs session; Origin and cross-session CSRF | PASS |
| AC11 | migration dry/apply/reapply temporary DB; startup missing-key/standalone denied; docs rollout/recovery | PASS |
| AC12 | full build/typecheck/60 tests, diff/scope checks, no .env thật trong thay đổi | PASS |

Đây không phải chứng minh mọi interleaving hoặc load profile. Race password-reset/login và one-time token/recovery thực sự chạy đồng thời trong MongoDB; tính tuần tự hóa logout-all/login còn dựa trên cùng revision transaction và review source. Chưa benchmark production hoặc kiểm tra gateway/SMTP ngoài hệ thống.

## Dependency audit và giới hạn

OTPAuth pin 9.6.0, transitive @noble/hashes 2.4.0; build CommonJS/Node và TOTP vector tests pass. npm audit qua network trả nonzero vì advisories của các dependency đã có: body-parser, follow-redirects, joi, minimatch, nodemailer, nodemon, qs. Phiên bản các package này trong lockfile không đổi so với baseline; không có finding cho otpauth trong kết quả đó. Không chạy audit fix hoặc nâng cấp dependency ngoài kế hoạch. Đây không phải security audit toàn bộ sản phẩm.

Môi trường test: MongoMemoryReplSet, một MongoMemoryServer standalone để kiểm tra từ chối startup, local SMTP và service workers riêng. Tất cả dùng dữ liệu/key tổng hợp, có cleanup trong test. Không sửa .env thật, không dùng database/account/SMTP production.

Frontend chưa triển khai; client phải hiểu login 202 và dùng cookie/CSRF mới sau rotation. Runtime cần replica set/Atlas và AUTH_MFA_ENCRYPTION_KEY, AUTH_MFA_KEY_ID, AUTH_MFA_ISSUER; người vận hành điền giá trị ngoài Git. Sandbox cần cấu hình truyền chúng riêng, chưa tự deploy. JWT legacy sẽ phải login lại; không rollback về binary bỏ qua MFA sau khi đã enroll. Không migrate hoặc backfill dữ liệu thật trong task này.

## Trạng thái bàn giao

Sáu tính năng backend và kiểm thử triển khai xong tại working tree. Không commit, không push, không tạo PR hay deploy. Nếu yêu cầu bước Test/Review chính thức của workflow, dùng bằng chứng này làm đầu vào và không tự đánh dấu đã có review độc lập.
