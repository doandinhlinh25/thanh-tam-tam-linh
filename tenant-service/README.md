# Tenant service

Express, TypeScript, MongoDB/Mongoose. Quản lý tenant, thành viên, lời mời, course và quota.

## Chạy local

1. Dùng Node.js 22, chạy npm ci trong thư mục tenant-service.
2. Sao chép .env.example thành .env và điền cấu hình.
3. Khởi động Auth trước, sau đó chạy npm start (mặc định cổng 4002).
4. Kiểm tra biên dịch bằng npm run build.

MongoDB cần replica set hoặc Atlas để dùng transaction. MONGODB_URI phải trỏ tới database riêng của Tenant. AUTH_SERVICE_URL trỏ tới Auth; AUTH_TENANT_TOKEN phải giống Auth và dài ít nhất 32 ký tự. Không sao chép JWT_SECRET hoặc mật khẩu Super Admin sang Tenant.

Điền ALLOWED_ORIGINS và APP_URL theo frontend; SMTP_URL và MAIL_FROM dùng để gửi lời mời. DOCUMENT_SERVICE_TOKEN và CHAT_SERVICE_TOKEN là credential riêng cho các API nội bộ tương ứng.

API quản trị dùng prefix /admin/tenant. Danh tính lấy qua Auth; quyền trong tenant lấy từ membership. Browser gửi cookie tokenAdmin, Origin hợp lệ và X-CSRF-Token cho thao tác ghi. Tài khoản platform admin không tự động có quyền truy cập course của tenant.

Thành viên và lời mời đang chờ còn hạn được kiểm tra theo maxUsers; quota được kiểm tra lại khi nhận lời mời. Owner cuối cùng được bảo vệ. Course và quota chat có transaction để xử lý yêu cầu đồng thời; requestId tránh trừ quota hai lần khi retry. API nội bộ /internal chỉ dành cho service được cấp credential.

Nhánh feat/auth-service cung cấp Auth. Có thể merge cả hai nhánh vào nhánh tích hợp để chạy đầy đủ hai service.

.env là file riêng tư, đã được gitignore. Chỉ .env.example được commit.
