# Auth account security collections

Database riêng của Auth; Tenant chỉ hỏi introspection, không truy cập collection này.

| Collection | Nội dung | Index chính |
| --- | --- | --- |
| auth_security | Một record mỗi principal; version/revision serialize thay đổi bảo mật; encrypted MFA secret, last accepted TOTP step, recovery hashes | unique userId |
| auth_sessions | Hash jti, userId, securityVersion/authVersion, binding Super Admin, expiry/revocation và metadata giới hạn | unique tokenIdHash; TTL expiresAt; userId + createdAt |
| auth_challenges | Hash token login/enrollment; purpose, expiry, 5 attempts; version/credential binding snapshot; enrollment ràng buộc session | unique tokenHash; TTL expiresAt; userId |
| email_change_tokens | Một yêu cầu hiện hành mỗi user, email đích, hash token, securityVersion và expiry/consumedAt | unique userId; unique tokenHash; TTL expiresAt |
| auth_audit_logs | userId hoặc null, login outcome/method/reasonCode; IP/UA bounded, timestamps và expiry 90 ngày | userId + action + createdAt; TTL expiresAt |

MFA ciphertext chứa keyId/IV/tag/ciphertext, AAD gồm userId và purpose. Pending/active secret không hoán đổi được. Recovery codes entropy cao chỉ lưu SHA-256 hash. Không lưu JWT hoặc password vào collection mới. Field nhạy cảm select:false vẫn cần allowlist response khi dùng lean()/native driver.

AuthSecurity không TTL-delete khi tắt MFA, vì version vẫn bảo vệ các phiên cũ. Không tạo session từ JWT legacy. Query luôn kiểm tra expiry/revokedAt/consumedAt dù TTL chưa chạy. Các lần phát hành/revoke/security mutation chạm cùng revision trong transaction; retry transaction không được gửi email/cookie ngoài ý muốn.

Script migration ở migrations/20261123-auth-account-features.mjs chỉ tạo indexes và backfill expiresAt cho audit có createdAt hợp lệ. Không đổi account, không giải mã/ghi lại MFA key, không chạy trên DB thật nếu chưa được duyệt. Apply là thay đổi retention: audit cũ quá 90 ngày có thể bị TTL dọn sau đó.

lastSeenAt là gần đúng, throttle 5 phút; IP/User-Agent là metadata chứ không chứng minh thiết bị. Không bật trust proxy vô điều kiện; giữ mặc định Express không tin forwarded headers cho đến khi có policy gateway được xác minh.
