# Plan: Sáu tính năng Auth cho duy-tam

- Task ID: `2026-11-23-duy-tam-auth-features`
- Status: `APPROVED (by duy-tam, 2026-11-23)`
- Người phụ trách: duy-tam; thực hiện tuần tự, không dùng sub-agent.
- Inputs: `docs/reports/2026-11-23/2026-11-23-duy-tam-auth-features-scout.md`, `docs/handoffs/2026-11-23-duy-tam-auth-features.md`, yêu cầu lập kế hoạch của người dùng ngày 2026-11-23.
- Baseline: `feat/duy-tam-auth-features-20261123` tại `fa481e1abad589512f52ad58c44977eac2a8496b`; worktree `D:/SoftwareEngeering/duy-tam-auth-fix`.
- Nhánh đã rebase thành công với `origin/Linh` trong lượt trước. Lượt lập kế hoạch chỉ kiểm tra local HEAD vẫn giữ nguyên; không khẳng định remote chưa thay đổi kể từ lần fetch đó.
- Duyệt danh sách tính năng chưa đồng nghĩa duyệt các quyết định bảo mật dưới đây. Chỉ chuyển sang APPROVED sau khi duy-tam duyệt kế hoạch này.

## 1. Objective and background

Bổ sung sáu tính năng backend cho Auth: đăng xuất tất cả thiết bị; xem/thu hồi phiên; cập nhật hồ sơ cá nhân; đổi email có xác minh; 2FA; lịch sử đăng nhập. Giữ cấu trúc code và cách đặt route/controller/service theo duy-tam, MongoDB riêng của Auth và contract Auth–Tenant đã thống nhất.

Người dùng cần quản lý được tài khoản của mình; bản sao JWT của phiên đã thu hồi phải bị từ chối cả ở API Auth và khi Tenant introspect. Các tính năng phải áp dụng rõ ràng cho tài khoản thường và Super Admin dùng `.env`.

## 2. Scope and non-goals

Trong phạm vi: source Auth, Mongo models/indexes và script nâng cấp của Auth, OpenAPI, `.env.example`, tài liệu và kiểm thử Node/Auth–Tenant. Cho phép một dependency TOTP nhỏ sau khi duyệt kế hoạch, không thêm dịch vụ trả phí.

Ngoài phạm vi: giao diện frontend/QR renderer, sửa nghiệp vụ Tenant/Course/Chat, refresh token, OAuth/social login, SMS OTP, upload/resize/scan ảnh, định vị thiết bị, thông báo realtime, hệ thống gửi mail bằng queue/outbox, tự động phục hồi MFA qua email, deploy hoặc migrate dữ liệu thật. Profile chỉ nhận URL ảnh HTTPS có kiểm tra, không tải URL đó trên server.

Không commit, push, tạo PR hoặc merge trong bước triển khai nếu chưa được yêu cầu riêng. Không đọc/ghi giá trị secret thật. Việc duyệt kế hoạch không phải quyền chạy migration production.

## 3. Current-state findings

Các dữ kiện đã xác minh tại baseline:

| Nguồn | Hiện trạng | Phần cần bổ sung |
| --- | --- | --- |
| `services/auth-service/services/auth.service.ts` | JWT HS256 có `jti`; tra account hiện hành và `authVersion`; đổi/reset mật khẩu vô hiệu phiên cũ | Bản ghi phiên, thu hồi riêng từng phiên, MFA và xác minh đổi email |
| `controllers/admin/account.controller.ts` | Logout chỉ xóa cookie; `/me` trả thông tin cơ bản | Thu hồi phiên phía server, self-profile và endpoint mới |
| `routes/admin/account.route.ts`, `app.ts` | Cùng router ở `/admin/account` và `/api/v1/auth`; kiểm tra Origin, CSRF và rate limit | Đăng ký endpoint mới ở cả hai alias, giữ ranh giới middleware |
| `models/account-admin.model.ts` | Có fullName, avatar, phone, description, unique email | Tái sử dụng field hiện hữu, không tạo account thứ hai |
| `models/auth-audit.model.ts` | userId/action/outcome/timestamps | Metadata an toàn, index, API history giới hạn theo người dùng |
| `models/action-token.model.ts` | Token hash một lần cho reset/setup | Token đổi email riêng, hết hạn và chặn replay |
| `config/super-admin.config.ts` | Super Admin lấy ID/email/password từ env; không có AccountAdmin | Security state và session độc lập với AccountAdmin |
| `config/database.ts` | Khởi tạo indexes; chưa bắt buộc replica set cho login | Các transaction mới đòi replica set, cần kiểm tra readiness/startup |
| `test/platform.integration.ts` | Có local SMTP, Auth/Tenant thật và Mongo tạm | Mở rộng test và thay kỳ vọng logout cookie-only có chủ đích |

`authReason` đã phân biệt SESSION_INVALID và SERVICE_CREDENTIAL_INVALID. Không đổi ý nghĩa hai mã này; không sửa Tenant để giải mã JWT.

## 4. Proposed design

### 4.1. Quyết định chung đề nghị duyệt

1. Bắt buộc session record cho mọi JWT được chấp nhận sau rollout. JWT cũ không có record phải đăng nhập lại một lần; không có fallback chấp nhận JWT vô trạng thái.
2. Logout hiện tại đổi sang thu hồi phiên server-side. Logout tất cả bao gồm phiên đang gọi. Quản lý phiên không biến User-Agent/IP thành bằng chứng thiết bị đáng tin cậy.
3. MFA dùng TOTP qua app Authenticator và recovery code, không dùng email làm yếu tố thứ hai. Tính năng hỗ trợ mọi tài khoản, gồm Super Admin; bật theo lựa chọn, không tự áp chính sách bắt buộc MFA cho tất cả admin trong đợt này.
4. Super Admin giữ ID/email/password trong env. Hồ sơ và đổi email qua API bị từ chối; session, MFA, recovery và audit lưu theo ID của Super Admin trong Auth MongoDB. Không có đặc quyền bỏ qua MFA.
5. Đổi email, tắt MFA và tạo lại recovery code yêu cầu mật khẩu hiện tại và OTP/recovery nếu MFA đã bật. Đổi/reset mật khẩu không tự tắt MFA.
6. MongoDB replica set là điều kiện vận hành mới của Auth để bảo đảm các thay đổi bảo mật đồng thời là atomic. Không hỗ trợ login mới trên standalone sau rollout.

### 4.2. Dữ liệu và chống race

Các collection mới, chỉ trong database Auth:

| Model dự kiến | Dữ liệu chính | Index và quy tắc |
| --- | --- | --- |
| `AuthSession` | userId, tokenIdHash, securityVersion, createdAt, expiresAt, revokedAt, lastSeenAt, userAgent, ip | tokenIdHash unique; userId/createdAt; TTL expiresAt. Không lưu JWT/jti thô. API dùng `_id` opaque, vẫn kiểm tra owner |
| `AuthSecurity` | userId, version, revision, credentialBinding cho Super Admin, MFA secret đã mã hóa, keyId, lastAcceptedStep, recovery hashes | userId unique. Là điểm serialize login, revoke-all, đổi email/password, bật/tắt MFA, hoàn tất challenge |
| `AuthChallenge` | tokenHash, userId, purpose, expiresAt, consumedAt, attemptCount, version/binding snapshot, rememberPassword; encrypted pending secret khi enroll | tokenHash unique; TTL expiresAt. Session ràng buộc với thao tác enroll, challenge login không phải JWT |
| `EmailChangeToken` | tokenHash, userId, targetEmail, securityVersion, expiresAt, consumedAt | tokenHash unique; TTL expiresAt; chỉ một yêu cầu hiện hành theo user |

Không TTL-delete AuthSecurity chỉ vì tắt MFA: vẫn cần version để vô hiệu phiên cũ. TTL chỉ dọn rác; mọi query xác thực phải tự so sánh expiresAt/revokedAt/consumedAt. lastSeenAt cập nhật tối đa một lần mỗi 5 phút, không ghi ở mọi introspection.

Mọi issuance/revoke-all/security mutation chạm cùng AuthSecurity trong transaction. Increment version và thu hồi phiên/challenge liên quan phải atomic; login chạy đồng thời với logout-all/đổi mật khẩu không được phát hành JWT hợp lệ từ bằng chứng đã cũ. Các đường change/reset password, account lock/delete và provision hiện có phải được tích hợp hoặc chứng minh vẫn an toàn bằng authVersion/status. Kiểm tra trạng thái account và config Super Admin ở cả bước cấp và bước dùng session.

AuthSession trả lỗi dependency/server khi DB hỏng, không giả thành SESSION_INVALID. Kiểm tra public middleware và internal introspection cùng gọi một hàm getIdentity đã áp dụng session policy.

### 4.3. API dự kiến

Tất cả đường dưới đây tương đối với cả `/api/v1/auth` và `/admin/account`. Đây là endpoint đề xuất, chưa tồn tại trừ các route ghi rõ cập nhật. Contract mới: `contracts/openapi/auth-account.v1.yaml`, do người triển khai Auth sở hữu.

| Method / path | Request | Kết quả và bảo vệ |
| --- | --- | --- |
| POST `/login` (cập nhật) | email, password, rememberPassword | Không MFA: 200 và cookie như cũ. Có MFA: 202, `mfaRequired`, challengeToken hết hạn 5 phút; không cấp cookie/JWT/CSRF mới |
| POST `/login/2fa` | challengeToken; đúng một trong otp hoặc recoveryCode | 200 sau xác minh, cấp session/cookie/CSRF; challenge một lần, Origin + rate limit, không dùng middleware phiên đầy đủ |
| POST `/logout` (cập nhật) | Không body | Phiên hợp lệ: Origin + CSRF rồi revoke và clear cookie. Cookie thiếu/sai/hết hạn: Origin hợp lệ vẫn clear cookie idempotent; không cho token rác xác định user/thu hồi phiên khác |
| POST `/logout-all` | password; OTP/recovery nếu bật MFA | Origin + session + CSRF + reauth; thu hồi tất cả, clear cookie, 200 |
| GET `/sessions` | page, limit | Chỉ phiên còn hiệu lực của mình; id, createdAt, expiresAt, lastSeenAt, userAgent, ip, current; không trả token/hash |
| DELETE `/sessions/:sessionId` | Không body | Origin + session + CSRF; không đúng owner trả 404; của mình đã revoke xử lý idempotent; xóa phiên hiện tại thì clear cookie |
| GET `/me` (mở rộng) | Không body | Giữ field hiện có, bổ sung phone/description/avatar cho account thường và mfaEnabled; không lộ security state |
| PATCH `/profile` | Một hoặc nhiều fullName, phone, description, avatar | Origin + session + CSRF; reject field ngoài allowlist; trả profile đã lọc; Super Admin 403 |
| POST `/email-change/request` | newEmail, password; OTP/recovery nếu bật MFA | Origin + session + CSRF + reauth + rate limit; gửi token tới email mới; chưa đổi email |
| POST `/email-change/confirm` | token, password; OTP/recovery nếu bật MFA | Session hiện tại + CSRF + Origin; transaction consume token/unique email/update account/thu hồi mọi phiên; clear cookie |
| GET `/2fa/status` | Không body | enabled, recoveryCodesRemaining; không trả secret hoặc hashes |
| POST `/2fa/setup` | password | Origin + session + CSRF + reauth; chỉ khi chưa enabled; trả setupToken, secret base32 và otpauth URI một lần, TTL 10 phút |
| POST `/2fa/enable` | setupToken, otp | Session/Origin/CSRF; setup phải thuộc user và session đang gọi; xác nhận OTP rồi enable atomic, trả 10 recovery codes một lần và cấp phiên mới thay thế, revoke các phiên cũ |
| POST `/2fa/disable` | password; otp hoặc recoveryCode | Session/Origin/CSRF + reauth; xóa MFA secret/recovery, revoke mọi phiên/challenge, clear cookie |
| POST `/2fa/recovery-codes/regenerate` | password; otp hoặc recoveryCode | Như disable; thay toàn bộ codes atomic, trả mới một lần, rotate phiên hiện tại và revoke phiên khác |
| GET `/login-history` | page, limit, outcome tùy chọn | Chỉ sự kiện login của mình, mới nhất trước, pagination có giới hạn; không xuất email người khác hoặc metadata bí mật |

Validation: page >=1, limit mặc định 20/tối đa 100; tên 2–120, phone tối đa 30, description tối đa 2000, avatar HTTPS tối đa 2048 hoặc null; không fetch avatar URL. Dùng email normalization hiện hữu, giới hạn password/JSON như cũ. OTP đúng 6 chữ số, cấm trim làm thay đổi recovery token ngoài quy tắc đã ghi contract. Field ngoài schema bị từ chối.

Giữ envelope `code`, `message`, `account` hiện hữu và response format đang dùng trong Auth; contract mới khai báo cụ thể `data` cho endpoint mới, timestamps ISO 8601. Không refactor toàn repo sang envelope khác. Thêm reasonCode có chọn lọc qua helper lỗi, không thay payload thành công của login khi MFA tắt.

Mã lỗi dự kiến: 400 VALIDATION_FAILED; 401 SESSION_INVALID hoặc REAUTHENTICATION_FAILED; 403 CSRF_INVALID/FORBIDDEN; 404 RESOURCE_NOT_FOUND; 409 EMAIL_UNAVAILABLE/MFA_STATE_CONFLICT; 400 TOKEN_INVALID_OR_EXPIRED cho email/setup; 401 MFA_CHALLENGE_INVALID cho challenge/OTP login; 429 RATE_LIMITED; 503 AUTH_DEPENDENCY_UNAVAILABLE/MFA_CONFIGURATION_INVALID. Không trả lý do chi tiết cho challenge lạ/hết hạn/đã dùng hoặc OTP sai. SERVICE_CREDENTIAL_INVALID của API internal giữ nguyên.

### 4.4. Phiên và tương thích

Cookie vẫn là tokenAdmin HttpOnly, sameSite strict, secure ở production; JWT HS256, remember duration và CSRF gắn với jti giữ nguyên. Session tạo thành công trước khi trả JWT. Gửi JWT cho client nhưng transaction session thất bại là không được phép.

Logout-all tăng securityVersion, không thay password. Với revoke riêng, chỉ đánh dấu session; không làm gián đoạn các phiên khác. Các introspection bắt đầu sau khi revoke commit phải từ chối phiên đó; không tuyên bố hủy request đã được xác thực trước commit. Không cache identity dài hạn làm trễ thu hồi.

Legacy JWT chưa có session không được tự nâng cấp từ JWT gửi tới. Tài khoản phải login mới. Cần cập nhật test cũ vốn khẳng định bản sao JWT vẫn hợp lệ sau logout; đây là thay đổi hành vi được đề nghị duyệt, không phải test regression ngẫu nhiên.

### 4.5. Hồ sơ và đổi email

PATCH profile chỉ sửa chính người gọi, không chấp nhận userId/role/status/email/password trong body. Tái sử dụng schema account; cập nhật search khi fullName thay đổi. Không yêu cầu thu hồi phiên khi chỉ sửa profile; getIdentity đọc dữ liệu mới như hiện nay.

Email request dùng token ngẫu nhiên 256-bit, chỉ lưu hash, TTL 30 phút; gửi lại vô hiệu token cũ. Không dùng chung purpose reset/setup, không làm hủy password reset chỉ vì xin đổi email. Gửi link dạng fragment trên APP_URL cố định; không lấy callback/host từ client. Có mail adapter local để kiểm thử.

SMTP thất bại trả lỗi tạm thời; email account vẫn nguyên, yêu cầu mới thay thế token thất bại. Không log token và không trả token API. Trường hợp SMTP timeout sau khi nhà cung cấp đã nhận mail có thể có email dư nhưng chỉ token hiện hành được chấp nhận; không hứa exactly-once mail.

Confirm cần token + session cùng user + current password/MFA. Re-check trạng thái active, version và email unique trong transaction; hai người confirm cùng targetEmail chỉ một người thành công. Sau đổi: emailVerifiedAt cập nhật, search cập nhật, authVersion/securityVersion tăng, revoke mọi phiên và challenge, vô hiệu token đổi email và reset/setup còn tồn tại. Đăng nhập lại bằng email mới; email cũ không còn dùng được. Email Super Admin và các email đã bị unique index giữ lại vẫn unavailable, không tự tái sử dụng email tài khoản soft-deleted.

### 4.6. 2FA và Super Admin

Dependency đề xuất: `otpauth`, chọn phiên bản cụ thể tương thích CommonJS/Node hiện tại lúc Cook, pin qua package-lock và ghi version vào báo cáo; không tự viết thuật toán TOTP. TOTP theo RFC 6238: SHA-1, 6 digits, 30 giây, window ±1. Kết hợp atomic lastAcceptedStep để một time step không được dùng lại trên nhiều challenge/thao tác. Đồng bộ đồng hồ là điều kiện runtime.

Secret TOTP cần giải mã để verify, do đó mã hóa AES-256-GCM bằng node:crypto, IV ngẫu nhiên 12 bytes, auth tag, keyId và AAD gồm userId/purpose. Không dùng hash thay cho mã hóa secret, không dùng JWT_SECRET làm encryption key. Recovery code: 10 mã, mỗi mã random 128-bit, chỉ lưu SHA-256 hash, mỗi mã tiêu thụ atomic một lần. Không lưu bản thô codes sau response.

Env mới dự kiến: AUTH_MFA_ENCRYPTION_KEY (base64 32 bytes), AUTH_MFA_KEY_ID, AUTH_MFA_ISSUER; TTL/limit và retention đặt constant có tên thay vì thêm quá nhiều env. Chỉ thêm tên/giải thích vào `.env.example`, không sinh hoặc ghi key thật. Runtime cần key hợp lệ khi tính năng MFA được triển khai; cấu hình hỏng không được chuyển thành password-only login. Key cũ phải giữ trong backup an toàn; xoay key cần quy trình riêng, không thay key một cách tùy tiện.

OTPAuth URI/secret chỉ trả trong setup sau reauth; endpoint/list/history/log không bao giờ lộ lại. Không tạo QR qua dịch vụ bên ngoài; frontend sau này tự render URI. Setup pending không làm bật MFA; confirm hết hạn/replay/cross-user/cross-session bị chặn.

Password hợp lệ với account bật MFA chỉ tạo random opaque challenge (hash trong DB), snapshot version, TTL 5 phút, tối đa 5 lần thử và rate limit theo challenge + user + IP. rememberPassword lấy từ challenge do server lưu, không tin giá trị gửi lại. Hoàn tất challenge atomic cùng OTP/recovery consume và session issuance. Không có normal JWT hay trusted identity trước bước này. Cookie cũ nếu có không được coi là kết quả login mới thành công.

Super Admin không được ghi password/email vào AccountAdmin để hỗ trợ MFA. AuthSecurity theo SUPER_ADMIN_ID; credential binding dùng hash config hiện hữu để làm stale session/challenge sau thay env. Bật MFA không bị reset chỉ vì đổi SUPER_ADMIN_PASSWORD. Đổi SUPER_ADMIN_ID là thay principal, phải có quy trình bàn giao bảo mật; không trình bày như cách reset MFA. Quên cả app và recovery codes không có API password-only override; cần xử lý vận hành có xác minh riêng, ngoài phạm vi tự động hóa này.

Đổi/reset mật khẩu chỉ thay credential và revoke sessions, vẫn yêu cầu OTP ở login kế tiếp. Mail activation/password reset không phải MFA bypass. Thay đổi/tắt MFA phải thu hồi challenge login đã phát hành trước đó.

### 4.7. Audit, rate limit và riêng tư

Mở rộng AuthAudit với method, reasonCode nội bộ, ip, userAgent, expiresAt; index userId/action/createdAt và TTL 90 ngày cho bản ghi mới. Backfill expiresAt từ createdAt cho dữ liệu cũ bằng script dry-run/được duyệt riêng. Không thêm raw email, token, password, OTP, otpauth URI hoặc recovery code vào log.

Khi login bằng email đã biết nhưng sai mật khẩu, gắn userId nội bộ để chủ tài khoản xem thất bại; response vẫn generic. Email không tồn tại dùng userId null, không xuất trong API của bất kỳ người dùng nào. Login chỉ tính success sau hoàn tất MFA nếu có. Phân biệt password failure/MFA failure nội bộ; không đánh dấu mới nhập đúng password là đăng nhập thành công.

IP lấy req.ip theo cấu hình proxy được tin cậy; mặc định không bật trust proxy và không tin X-Forwarded-For tự khai. User-Agent cắt tối đa 512 ký tự, chỉ là chuỗi hiển thị; frontend phải render text. Chỉ user đó xem metadata của mình. Không thêm API công khai tra cứu email/IP.

Tận dụng rateLimit Mongo atomic hiện hữu và bổ sung khóa challenge/user cho MFA; đề xuất login giữ 15/15 phút, email request 3/15 phút/user và IP, sensitive reauth 10/15 phút/user và IP, MFA verify tối đa 5/challenge cộng 20/15 phút/user và IP. Giới hạn không được chỉ dựa vào cookie/email có thể đổi tùy ý. Return Retry-After; log cấu trúc action/outcome/reason, không log body/headers bí mật.

## 5. Files and components affected

Đường ngắn trong bảng là tương đối với `services/auth-service/` trừ khi ghi root. Các file mới đều phải có nội dung cần dùng, không tạo thư mục rỗng.

| Path | Change | Task |
| --- | --- | --- |
| root `contracts/openapi/auth-account.v1.yaml` | Contract endpoint/payload/error/security/alias/202 | T1 |
| `configs/auth-feature.config.ts`, `config/auth-reason.config.ts` | Constants, limits, reason codes, key validation | T1,T2,T5 |
| `models/auth-session.model.ts`, `auth-security.model.ts`, `auth-challenge.model.ts`, `email-change-token.model.ts` | New Auth-owned persistence/indexes | T2,T4,T5 |
| `models/auth-audit.model.ts` | Metadata + expiry/indexes; giữ field cũ | T6 |
| `repositories/auth-session.repository.ts`, `auth-security.repository.ts`, `auth-challenge.repository.ts`, `email-change.repository.ts`, `auth-audit.repository.ts` | Query Mongo của tính năng mới; atomic consume/version/ownership | T2–T6 |
| `services/session.service.ts`, `profile.service.ts`, `email-change.service.ts`, `mfa.service.ts`, `login-history.service.ts` | Business rules tách khỏi controller | T2–T6 |
| `helpers/mfa-crypto.helper.ts`, `helpers/request-metadata.helper.ts` | AES-GCM, metadata đã lọc; không tự viết TOTP | T5,T6 |
| `dto/request/auth-features.request.ts`, `dto/response/auth-features.response.ts` | Kiểu request, Joi validation và response của endpoint mới | T1–T6 |
| `services/auth.service.ts`, `services/account.service.ts` | Hook session/MFA và đường reset/change/lock/delete hiện hữu | T2,T4,T5 |
| `controllers/admin/account.controller.ts`, `controllers/admin/account-security.controller.ts` | Cookies/HTTP, session/profile/email/MFA/history | T2–T6 |
| `routes/admin/account.route.ts`, `middlewares/admin/auth.middleware.ts`, `middlewares/security.middleware.ts`, `helpers/error.helper.ts` | Route guards, reauth/rate limit, optional reasonCode, shared verification | T2–T6 |
| `controllers/internal.controller.ts`, `interfaces/request.interface.ts` | Giữ identity contract; session enforcement; không xuất MFA secret | T2,T5 |
| `config/database.ts`, `index.ts` | Replica set prerequisite và fail-closed cấu hình MFA | T2,T5 |
| `database/migrations/20261123-auth-account-features.mjs`, `database/auth-models.md` | Script Node dry-run/apply, indexes, audit backfill, rollback runbook | T7 |
| `README.md`, `.env.example`, root `package-lock.json`, `package.json` của Auth | Runtime notes và duy nhất dependency otpauth | T5,T7 |
| root `test/platform.integration.ts`, `test/auth-features.integration.ts`, `package.json` | Cập nhật regression và thêm lệnh test tích hợp riêng sau khi tạo file | T8 |
| `test/auth-features.test.ts` trong Auth | Unit validation/crypto/contracts; wiring root test cụ thể ở T8 | T8 |

Nếu có DB schema/DBML thực tế khi Cook thì cập nhật cùng migration; hiện chưa xác minh file DBML Auth tồn tại, không tự tạo một mô hình SQL giả cho Mongo. Tài liệu auth-models.md mô tả collection/index.

## 6. Ordered implementation tasks

Một người thực hiện tuần tự. Không spawn agent; không có coordination record cần thiết. Dù một số logic độc lập, auth.service.ts, router, fixtures và lockfile là các điểm dùng chung nên không sửa song song.

| ID | Task | Files (section 5) | Verify with | Expected | Depends on |
| --- | --- | --- | --- | --- | --- |
| T1 | Chốt contract, constants, DTO và reasonCode; ghi rõ MFA 202 và rollout legacy | OpenAPI/configs/DTO | Parse YAML bằng yaml đã có; đối chiếu handler/alias; npm run typecheck | Không route trùng; contract đủ request/response/failure | Duyệt plan |
| T2 | Session/security model, login issuance, introspection enforcement, revoke/logout-all, guards và replica readiness | Session repository/service, auth/account services, controller/middleware/database | npm run build; npm run typecheck; T8 integration checkpoints | Token bị revoke không dùng lại; không revoke nhầm user; race không tạo phiên stale | T1 |
| T3 | Self profile và /me mở rộng | Profile service/DTO/controller/router | Typecheck và checkpoint profile ở T8 | Chỉ sửa allowlist, không đổi role/email/status; Super Admin bị chặn đúng | T2 |
| T4 | Email-change lifecycle và SMTP failure contract | Email token/repository/service, account/auth hooks, DTO/routes | Typecheck và test SMTP local, consume song song ở T8 | Không đổi email trước confirm; unique atomic; revoke sau confirm | T2,T3 |
| T5 | Pin otpauth, key validation, MFA setup/enable/challenge/recovery/disable cho cả Super Admin | MFA model/helper/service, login/controller, env example/lock | Build/typecheck, RFC vector tests, concurrency và no-bypass tests T8 | Không JWT trước MFA; secret encrypted; OTP/code/challenge một lần | T2,T4 |
| T6 | Metadata và login-history API, rate limits từng account/challenge | Audit model/repository/service, request metadata/router | History isolation/pagination/no-secret checks T8 | Chỉ lịch sử của mình; login success chỉ sau MFA | T2,T5 |
| T7 | Script dry-run/migration tạm, tài liệu runtime/key/legacy/recovery, OpenAPI cuối | Migration/README/OpenAPI/database docs | node migration --help; dry-run và apply trên DB tạm; chạy lại apply | Idempotent; không xóa account; không ghi secret; standalone bị từ chối rõ | T2–T6 |
| T8 | Regression/unit/integration cho sáu tính năng và Auth–Tenant; sửa expectation logout cũ | Test files/root scripts | npm run build; npm run typecheck; npm test; script mới sau khi đăng ký | Tất cả suites thoát 0; cleanup worker/DB đầy đủ; không silent skip | T1–T7 |
| T9 | Review phạm vi, security/data leaks, contract, acceptance checklist và handoff | Diff/docs/report | git diff --check; git status; review từng AC | Chỉ Auth + tests/contracts/docs/lock liên quan; ghi PASS/PARTIAL thật | T8 |

Trong Cook được chạy checkpoint kiểm tra code mình vừa viết; báo cáo Test/Review chính thức theo stage workflow của repo, không tự đánh dấu approved review hoặc tự push.

## 7. Dependencies and prerequisites

- Người dùng duyệt DRAFT này trước Cook, gồm các thay đổi logout, forced re-login legacy và replica set prerequisite.
- Giữ nhánh `feat/duy-tam-auth-features-20261123`; trước Cook kiểm tra lại git status/HEAD, giữ toàn bộ artifact/user work. Nếu Linh thay đổi thì fetch/read diff và rebase khi trong quyền đã cho, không force-push shared branch, không thay Linh.
- Skills phải đọc: `.agents/skills/cook/SKILL.md` trước source edit; `.agents/skills/test/SKILL.md` khi sang Test; `.agents/skills/review/SKILL.md` khi sang Review. Không có specialist backend khác trong skill index đã đọc; không tự áp frontend workflow cho Auth.
- Mongo replica set tạm + local SMTP để chạy integration. Có thể dùng mongodb-memory-server trong manifest; không dùng DB thật hoặc container/service đang chạy của người dùng.
- otpauth là dependency mới duy nhất đề xuất. Xác nhận version, Node/CommonJS compatibility, license và advisory khi cài; nếu cần dependency khác có ảnh hưởng vận hành phải ghi thay đổi và xin duyệt.
- Runtime cần encryption key mới do người vận hành cấp ngoài Git. Có thể dùng key tổng hợp chỉ trong process test; không ghi key thật vào `.env` hay artifact.
- Nguồn kỹ thuật chính: [OTPAuth official repository](https://github.com/hectorm/otpauth), [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238). Các lựa chọn TTL/limits/rollout trong kế hoạch là thiết kế đề xuất của dự án, không phải yêu cầu bắt buộc của thư viện/RFC.

## 8. Testing and verification strategy

Các lệnh đã có: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:platform`. Chúng kiểm tra Node, không kiểm tra frontend hoặc production gateway.

T8 sẽ thêm lệnh `test:auth-features` chạy test/auth-features.integration.ts bằng tsx và nối nó vào root npm test. Unit test mới của Auth phải được wiring rõ vào script, không mặc định tưởng workspace Auth đã có npm test. Không chạy lệnh mới trước khi file/script tồn tại.

| Acceptance criterion | Check | Level |
| --- | --- | --- |
| AC1 Session và legacy policy | Hai login độc lập; JWT hợp lệ không có record; expired/revoked/inactive/authVersion stale; DB outage không thành 401 | Integration Auth + Tenant introspection |
| AC2 Logout-all | Logout-all rồi dùng lại cả hai JWT tại /me và context; cookie cleared; login đồng thời/security transaction; gồm Super Admin | Integration + concurrency |
| AC3 Session management | Pagination/active filter/current flag; revoke phiên khác/hiện tại; cross-user 404; token/hash không xuất; TTL chưa dọn vẫn denied | Integration |
| AC4 Self profile | Roundtrip fields; unknown fields/role/email/status denied; bad avatar URL; tên đổi search; Super Admin 403; user A không sửa B | Integration + DTO unit |
| AC5 Verified email | SMTP capture, trước/sau confirm, sai user/password/MFA, hết hạn/replay, resend, reserved/duplicate email, concurrent target, SMTP lỗi và rollback transaction | Integration + concurrency |
| AC6 MFA lifecycle | RFC vectors; setup pending không enabled; encrypted DB; owner/session binding; expiry; step replay và time-window boundaries | Unit + real Mongo integration |
| AC7 MFA login/recovery | Password đúng chỉ 202/no new cookie; bad/expired/replayed challenge; 5 attempts; concurrent OTP/recovery chỉ một success; stale version/status; remember giữ server-side; Super Admin không bypass | Integration + concurrency |
| AC8 Sensitive changes | Disable/regenerate/current password required + MFA; code cũ invalid; revoke sessions/challenges; reset password không tắt MFA; config/key mất/hỏng fail closed | Integration |
| AC9 History/privacy | A không xem B; email lạ không lộ; failure/success đúng giai đoạn; pagination cap; user-agent bounded; forged forwarded headers không trusted; no secret serialization/log | Integration + source/response inspection |
| AC10 Boundary compatibility | Origin thiếu/sai, CSRF thiếu/sai/cross-session, rate limit 429, service credential vs session reason, cả hai router alias; login không MFA giữ response cũ | Regression platform + security |
| AC11 Migration/runtime | Replica set prerequisite, dry-run không mutate, apply/reapply, backfill audit, indexes/TTL, fixture cleanup; không dùng network SMTP thật | Temporary DB integration/manual runbook review |
| AC12 Quality/scope | Full build/typecheck/npm test exit 0; git diff --check; no .env/dist/node_modules/secrets trong diff; tài liệu và OpenAPI khớp | Tool checks + review |

Test mới dùng account, key, OTP, token và SMTP tổng hợp; không đọc credentials thật. Dùng injected clock/check time step cho unit tests, không sleep chờ TTL hàng phút. Tests mutation/concurrency dùng Mongo thật. SMTP mock cho protocol errors ghi rõ phạm vi, không gọi là production E2E. Full suite phải kết thúc và cleanup đúng; test bị treo không được tính PASS.

## 9. Risks and mitigations

| Rủi ro | Giảm thiểu |
| --- | --- |
| Forced re-login gây bất ngờ | Ghi release note, đồng bộ Auth instances và drain code cũ; không mixed rollout password-only/MFA |
| Old binary bỏ qua session/MFA | Không rollback về baseline nếu đã enroll MFA; dùng safe rollback release giữ enforcement (section 11) |
| Mất key khiến không xác minh MFA | Key backup/keyId, kiểm tra startup; không password-only fallback; phục hồi key trước |
| Super Admin bypass hoặc bị khóa ngoài | Cùng policy session/MFA, lưu recovery offline, kiểm thử config change; không cấp backdoor API |
| Race logout-all/login/OTP/token | AuthSecurity serialization + transaction + atomic consume, test concurrency thật |
| Mongo standalone hoặc thiếu quyền index | Startup prerequisite và dry-run; thông báo vận hành trước khi deploy, không tự đổi DB |
| Mail fail, stale token, email uniqueness | Email cũ giữ nguyên, token ngắn hạn/hash, transaction và unique index, retry tạo token mới |
| MFA làm client login cũ không hiểu 202 | Contract và handoff frontend, account chưa bật MFA giữ flow cũ; không tuyên bố UI hoàn tất |
| Rò metadata/token/secret qua audit | Allowlist response, select:false/cẩn thận lean(), no body logging, privacy tests |
| Tăng DB latency/session race | Index queries, lastSeen throttling, không cache stale authorization; đo số query và bottleneck trong test |

## 10. Acceptance criteria

- [ ] AC1: Mọi JWT được xác thực gắn session active; JWT legacy phải login lại; DB lỗi không giả logout.
- [ ] AC2: Logout-all vô hiệu mọi phiên hiện hữu, gồm hiện tại và Super Admin; không issuance từ bằng chứng stale.
- [ ] AC3: Người dùng chỉ xem/thu hồi phiên của mình; single logout server-side; không lộ token.
- [ ] AC4: Self-profile dùng allowlist, có validation, không leo quyền; Super Admin env-managed được bảo vệ.
- [ ] AC5: Đổi email chỉ khi confirm hợp lệ; chống replay/race, email unique, revoke sessions và token cũ.
- [ ] AC6: MFA enable chỉ sau OTP xác nhận; secret encrypted, pending hết hạn, OTP replay bị chặn.
- [ ] AC7: Account bật MFA không nhận JWT trước factor thứ hai; recovery/challenge một lần, giới hạn thử, Super Admin cũng tuân thủ.
- [ ] AC8: Tắt MFA/tạo lại codes có reauth, codes cũ mất hiệu lực; password reset không bypass; key lỗi fail closed.
- [ ] AC9: History đúng user và giai đoạn login, bounded pagination/metadata, không lộ dữ liệu nhạy cảm.
- [ ] AC10: Origin/CSRF/rate limit/internal service boundary và login không MFA tương thích theo contract.
- [ ] AC11: Migration tạm idempotent, có dry-run; replica set/keys/legacy rollout/recovery có hướng dẫn, không chạy production tự động.
- [ ] AC12: Build, typecheck, toàn bộ test thực sự pass; diff đúng scope, docs/contracts cập nhật; không secret/.env thật trong Git.

## 11. Rollback or recovery

Trước rollout: backup DB và encryption key bằng kênh vận hành, chạy dry-run trên bản sao, kiểm tra indexes/replica set, chuẩn bị client hiểu 202. Deploy toàn bộ Auth instances tương thích và drain instance cũ; không để instance cũ tiếp tục cấp JWT bỏ qua MFA.

Nếu lỗi trước khi có người dùng enroll: dừng rollout, giữ dữ liệu và điều tra; không drop collection/index hoặc reset DB bằng script tự động. Revert code local chỉ khi có yêu cầu và giữ công việc khác.

Nếu đã có session/MFA mới: không quay lại binary baseline vì nó bỏ qua session/MFA. Safe rollback phải giữ lớp getIdentity session enforcement, MFA login gate và encrypted-data reader, có thể tạm ẩn profile/email/session UI không thiết yếu. Khi không có bản safe rollback, fail closed/maintenance có thông báo thay vì tắt MFA để khôi phục truy cập.

Nếu key lỗi/mất: phục hồi đúng key theo keyId từ backup; không xóa MFA record hoặc chấp nhận password-only. Nếu cần invalidate toàn bộ phiên sau sự cố, tăng securityVersion theo script riêng có phê duyệt, không ghi lệnh destructive tự chạy trong migration.

Email đã confirm là dữ liệu người dùng đã thay đổi; không tự đổi ngược về email cũ vì rollback code. Không phục hồi snapshot cũ làm sống lại token/recovery đã tiêu thụ. Khôi phục dữ liệu cần kế hoạch sự cố riêng và phải vô hiệu hóa lại sessions/challenges bị ảnh hưởng.

## 12. Completion checklist

- [x] Duy-tam đã duyệt kế hoạch và các quyết định section 4.1 ngày 2026-11-23.
- [ ] T1–T9 hoàn tất hoặc có quyết định hoãn rõ ràng, không tự giảm sáu tính năng.
- [ ] AC1–AC12 được `$test` xác minh bằng bằng chứng mới; không dùng kết quả 28 tests cũ làm bằng chứng cho feature mới.
- [ ] `$review` ghi quyết định, nêu rõ giới hạn frontend/runtime/production.
- [ ] OpenAPI, README, env example, collection/index docs và migration runbook khớp code.
- [ ] Handoff cập nhật, ghi dependency version và thay đổi tương thích.
- [ ] Giữ nguyên code ngoài scope; không secret thật, không push/PR/deploy nếu chưa được yêu cầu.
