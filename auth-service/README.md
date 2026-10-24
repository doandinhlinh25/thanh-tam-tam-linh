# Auth service

Express, TypeScript, MongoDB/Mongoose. Login/logout JWT theo nhánh duy-tam.

## Chạy local

1. Dùng Node.js 22, chạy npm ci trong thư mục auth-service.
2. Sao chép .env.example thành .env và điền cấu hình.
3. Chạy npm start (mặc định cổng 4001).
4. Kiểm tra biên dịch bằng npm run build.

JWT_SECRET và AUTH_TENANT_TOKEN cần ít nhất 32 ký tự; AUTH_TENANT_TOKEN phải giống cấu hình Tenant. Điền ALLOWED_ORIGINS và APP_URL theo frontend. Super Admin dùng SUPER_ADMIN_ID (24 ký tự hex), SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD; không cần document tài khoản MongoDB.

Login/logout dùng JWT HS256 trong cookie HttpOnly tokenAdmin, mặc định 1 ngày hoặc 7 ngày khi ghi nhớ. Logout xóa cookie; bản sao JWT vẫn còn hiệu lực đến khi hết hạn. Đổi/reset mật khẩu thành công vô hiệu JWT cũ. Yêu cầu quên mật khẩu không thu hồi JWT. Tài khoản initial kích hoạt bằng email; tài khoản active không nhận lại email thiết lập mật khẩu khi được mời vào tenant.

Các API browser có prefix /admin/account hoặc /api/v1/auth. Thao tác ghi cần Origin hợp lệ; các thao tác được bảo vệ cần X-CSRF-Token lấy từ login hoặc GET /admin/account/csrf. API quản lý tài khoản dùng /admin/account-admin. API nội bộ /internal cần credential service; không công khai qua gateway.

MongoDB standalone dùng được cho login/logout; nghiệp vụ dùng transaction như đổi/reset mật khẩu và cập nhật tài khoản cần replica set hoặc Atlas. SMTP_URL và MAIL_FROM cần được điền để gửi email. Database của Auth tách riêng database Tenant.

.env là file riêng tư, đã được gitignore. Chỉ .env.example được commit.
