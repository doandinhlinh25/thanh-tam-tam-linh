# Môi trường thử Auth / Tenant / Document

Bộ Compose riêng cho Auth, Tenant, Document Java 21, MongoDB replica set, PostgreSQL, Redis và MinIO (S3 compatible). Không dùng network saas-gateway, database, volume hoặc token của môi trường đang chạy.

## Khởi động

Cần Docker Engine với Compose v2, hoặc Docker Desktop chạy Linux containers; Node.js 22+ để chạy công cụ điều khiển. Máy Windows cần Docker Desktop/WSL2 hoạt động. Java và Maven trên máy host không bắt buộc vì Document được build trong container.

Chạy tại thư mục gốc repository:

```powershell
npm ci
npm run sandbox:init
npm run sandbox:check
npm run sandbox:up
npm run sandbox:smoke
```

sandbox:init sinh infrastructure/sandbox/.env với secret ngẫu nhiên riêng, giữ nguyên file nếu đã tồn tại. File mẫu chỉ chứa tên biến. Không lấy hoặc sửa .env của các service. AUTH_TENANT_TOKEN được truyền chung cho Auth/Tenant; DOCUMENT_SERVICE_TOKEN được truyền chung cho Tenant/Document. JWT_SECRET chỉ cấp cho Auth. CHAT_SERVICE_TOKEN là token riêng được dành cho API Chat của Tenant.

Cả bộ dùng project name cố định saas-auth-tenant-document-test và network internal. Các database không publish cổng. Mặc định các cổng chỉ bind 127.0.0.1:

| Thành phần | URL |
| --- | --- |
| Auth | http://127.0.0.1:14001 |
| Tenant | http://127.0.0.1:14002 |
| Document | http://127.0.0.1:18080 |
| MinIO S3 | http://127.0.0.1:19000 |
| MinIO Console | http://127.0.0.1:19001 |

Có thể đổi các biến *_PORT trong .env nếu cổng đang được dùng. Tài khoản Super Admin và tài khoản MinIO nằm trong .env riêng này; công cụ không in mật khẩu/token. Dùng localhost và môi trường HTTP thử, NODE_ENV=test để cookie không yêu cầu HTTPS. Không dùng bộ Compose này làm cấu hình production.

MongoDB khởi tạo root account và single-node replica set sandbox-rs; Auth/Tenant dùng hai database auth_sandbox và tenant_sandbox. PostgreSQL tự áp dụng schema upload khi volume còn mới. MinIO tạo bucket document-sandbox-private, tắt truy cập anonymous. Redis bật mật khẩu và AOF. Dữ liệu lưu trong volume được Compose đặt tên theo project riêng.

Document gọi đúng http://tenant:8080/internal/authorization/course và chuyển tiếp cookie tokenAdmin của người dùng. Các service chờ dependency ready, replica set và bucket được tạo trước khi khởi động. Document /health/ready kiểm tra PostgreSQL, bảng đã migrate, Redis và quyền truy cập bucket.

## Kiểm tra

sandbox:smoke thực hiện thật: kiểm tra readiness; đăng nhập; tạo hai tài khoản, tenant và course thử; xác thực token nội bộ; từ chối anonymous/người ngoài tenant; upload PDF và retry idempotent; kiểm tra metadata/checksum PostgreSQL, event Redis, byte lưu S3 và chặn đọc S3 anonymous.

Bài smoke giữ lại fixture theo ID được in ra để kiểm tra. Nó không dùng database ngoài sandbox. Chưa có worker xử lý ingestion trong stack này: kỳ vọng kết quả upload là QUEUED, không phải tài liệu đã trích xuất xong.

Chạy test cấu hình riêng:

```powershell
node --test test/sandbox-config.test.js
```

## Xem trạng thái và dừng

```powershell
npm run sandbox:status
npm run sandbox:logs
npm run sandbox:down
```

down chỉ dừng/xóa container và mạng của sandbox, giữ các volume để chạy lại. Không thay đổi hoặc tái sinh secret trong .env khi đang dùng lại volume có dữ liệu. Nếu dịch vụ không ready, xem status và logs trước khi thử lại. Không chia sẻ output docker compose config vì lệnh đó có thể hiển thị secret; sandbox:check chỉ dùng config --quiet.

MinIO và mc được build từ mã nguồn GitHub chính thức, cố định commit trong S3.Dockerfile; không phụ thuộc image minio/minio hoặc minio/mc công khai. Lần build đầu cần mạng và có thể lâu hơn các lần sau. Bộ này không tự thay đổi policy Kong/OPA của project.
