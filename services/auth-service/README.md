# Auth service

Workspace thuộc project saas-platform, dùng Express, TypeScript, MongoDB/Mongoose. Login/logout JWT theo nhánh duy-tam.

## Chạy local

1. Dùng Node.js 22+, chạy npm ci và npm run build tại thư mục gốc repository.
2. Sao chép services/auth-service/.env.example thành .env trong cùng thư mục và điền cấu hình.
3. Chạy npm run start --workspace @saas/auth-service (mặc định cổng 4001).
4. Kiểm tra biên dịch bằng npm run build --workspace @saas/auth-service.

JWT_SECRET và AUTH_TENANT_TOKEN cần ít nhất 32 ký tự; AUTH_TENANT_TOKEN phải giống cấu hình Tenant. Điền ALLOWED_ORIGINS và APP_URL theo frontend. Super Admin dùng SUPER_ADMIN_ID (24 ký tự hex), SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD; không cần document tài khoản MongoDB.

Login/logout dùng JWT HS256 trong cookie HttpOnly tokenAdmin, mặc định 1 ngày hoặc 7 ngày khi ghi nhớ. JWT phải có session active trong MongoDB. Logout thu hồi phiên phía server và xóa cookie; bản sao JWT cũng bị từ chối. Đổi/reset mật khẩu thành công thu hồi phiên/challenge cũ nhưng không tắt 2FA. Yêu cầu quên mật khẩu không thu hồi JWT. Tài khoản initial kích hoạt bằng email; tài khoản active không nhận lại email thiết lập mật khẩu khi được mời vào tenant.

Các API browser có prefix /admin/account hoặc /api/v1/auth. Thao tác ghi cần Origin hợp lệ; các thao tác được bảo vệ cần X-CSRF-Token lấy từ login hoặc GET /admin/account/csrf. API quản lý tài khoản dùng /admin/account-admin. API nội bộ /internal cần credential service; không công khai qua gateway.

MongoDB replica set hoặc Atlas là bắt buộc, kể cả login, vì session và MFA dùng transaction. SMTP_URL và MAIL_FROM cần được điền để gửi email. Database của Auth tách riêng database Tenant.

## Tính năng tài khoản và bảo mật

- `GET /sessions`, `DELETE /sessions/:sessionId`: chỉ xem/thu hồi phiên của chính mình. Metadata IP/User-Agent là thông tin hiển thị, không xác thực được thiết bị vật lý. Thu hồi phiên đang dùng sẽ xóa cookie.
- `POST /logout-all`: password hiện tại và OTP hoặc recoveryCode nếu bật MFA; thu hồi tất cả phiên, gồm phiên đang gọi.
- `PATCH /profile`: fullName, phone, description, avatar (HTTPS URL hoặc null). Không upload/tải ảnh từ Auth, không đổi role/status/email/password qua endpoint này. Super Admin không sửa hồ sơ qua API.
- `POST /email-change/request`: newEmail, password và factor nếu bật MFA. Email hiện tại giữ nguyên cho đến khi `POST /email-change/confirm` với token, password và factor trong session cùng user. Confirm xong phải đăng nhập lại; email Super Admin vẫn quản lý trong env.
- `GET /2fa/status`, `POST /2fa/setup`, `/2fa/enable`, `/2fa/disable`, `/2fa/recovery-codes/regenerate`: TOTP Authenticator và 10 recovery codes một lần. Setup chưa bật MFA; chỉ enable sau OTP xác nhận. Enable/regenerate rotate cookie và CSRF, thu hồi các phiên cũ; disable thu hồi tất cả rồi yêu cầu đăng nhập lại.
- `GET /login-history?page=1&limit=20`: lịch sử thành công/thất bại của chính mình; có thể lọc outcome=success/denied. Dữ liệu mới giữ 90 ngày. Không trả password, token, MFA secret hoặc recovery hash.

Các đường trên tương đối với `/api/v1/auth` hoặc `/admin/account`, cùng logic và middleware. Contract đầy đủ: `contracts/openapi/auth-account.v1.yaml` tại gốc repository.

Khi account đã bật MFA, `POST /login` trả **202** với `data.mfaRequired`, `challengeToken`, `expiresIn=300`; chưa cấp cookie/JWT/CSRF mới. Gọi `POST /login/2fa` với challengeToken và đúng một trong otp/recoveryCode để hoàn tất. Không lấy rememberPassword từ lần gọi thứ hai. Client cũ cần được cập nhật để xử lý 202 trước khi người dùng bật MFA.

Logout với cookie hợp lệ cần X-CSRF-Token; cookie thiếu/sai/hết hạn vẫn được clear idempotent khi Origin hợp lệ. Lỗi MongoDB không được xử lý như session sai. Các thao tác thay đổi bảo mật cần Origin, cookie, CSRF và reauthentication theo contract. Endpoint login/MFA preauthentication chỉ dùng Origin và rate limit, không yêu cầu cookie phiên đầy đủ.

## Cấu hình MFA và rollout

Điền ngoài Git: AUTH_MFA_ENCRYPTION_KEY (32 bytes encode base64), AUTH_MFA_KEY_ID (tên key 1–64 ký tự chữ/số/gạch), AUTH_MFA_ISSUER (nhãn app, tối đa 120 ký tự). Key phải khác JWT_SECRET. Chỉ `.env.example` chứa tên biến; không đặt secret thật trong source/tài liệu. Thiếu/sai key sẽ chặn khởi động; lỗi giải mã không được fallback password-only. TOTP secret được mã hóa AES-256-GCM, recovery/challenge chỉ lưu hash. Đồng bộ giờ hệ thống; OTP một time step chỉ được dùng một lần.

Super Admin vẫn lấy ID/email/password từ env, không tạo account Mongo giả. Session và MFA của Super Admin lưu trong auth_security/auth_sessions theo ID. Không bypass MFA bằng password env, đổi/reset mật khẩu hay route alias. Bảo quản recovery codes offline. Đổi SUPER_ADMIN_ID là thay principal và cần quy trình bàn giao riêng, không phải reset MFA. Không có API phục hồi MFA password-only nếu mất cả app và codes.

Rollout sẽ buộc JWT cũ không có session record đăng nhập lại. Chuẩn bị replica set, indexes, encryption key và client xử lý 202 trước; drain instances Auth cũ, không để code password-only chạy song song. Sandbox/Compose cũng phải truyền đủ ba biến MFA vào tiến trình Auth bằng cấu hình vận hành riêng; thay đổi này không tự tạo secret hay deploy sandbox.

Trước migration, backup database/key bằng kênh vận hành. Script không tự đọc `.env`: đặt AUTH_MIGRATION_URI trỏ đúng database Auth rồi chạy:

```powershell
node services/auth-service/database/migrations/20261123-auth-account-features.mjs --help
node services/auth-service/database/migrations/20261123-auth-account-features.mjs --dry-run
# Chỉ sau khi được phép migrate môi trường đích:
node services/auth-service/database/migrations/20261123-auth-account-features.mjs --apply
```

Apply tạo indexes và backfill audit expiry, không tự cấp session cho JWT cũ. TTL có thể dọn audit đã quá 90 ngày sau backfill; cần duyệt retention trước khi apply trên dữ liệu thật. Kiểm tra expiry/revocation ở query không chờ TTL worker. Script chạy lặp được; không tự drop collection/index khi lỗi.

Sau khi đã có MFA, **không rollback về binary cũ bỏ qua MFA/session**. Safe rollback phải giữ enforcement hiện tại; nếu không có thì maintenance/fail closed và sửa lỗi. Phục hồi key đúng keyId khi key hỏng, không xóa MFA để mở login. Không phục hồi token/recovery codes đã tiêu thụ từ snapshot cũ. Không tự đổi lại email người dùng đã xác minh.

## Kiểm thử

Từ gốc: `npm run build`, `npm run typecheck`, `npm test`. Lệnh `npm run test:auth-features` chạy unit crypto/TOTP và integration với Auth/Tenant, Mongo replica set, SMTP cục bộ tạm. Không kiểm tra frontend, production gateway hoặc SMTP thật. Không dùng dữ liệu hay secret thật cho test.

.env là file riêng tư, đã được gitignore. Chỉ .env.example được commit.
