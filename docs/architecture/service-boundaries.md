# Service boundaries

## Ownership rules

1. Mỗi service sở hữu database, schema và migration của chính nó.
2. Một service không được kết nối hay truy vấn trực tiếp database của service khác.
3. Domain model, repository, entity và business logic không được chia sẻ giữa các service.
4. Tích hợp giữa service sử dụng API contract hoặc event contract có phiên bản.
5. Mỗi service có lifecycle build, deploy, cấu hình môi trường và container độc lập.

## Tenant membership ownership

`tenant-service` là owner duy nhất của quan hệ membership giữa user và tenant, bao gồm vai trò và trạng thái membership trong tenant. Bảng membership chỉ lưu identity user như một external reference; không có foreign key, join hoặc truy vấn trực tiếp tới database của `identity-service`.

`identity-service` chỉ sở hữu credential, xác thực và định danh user. Khi một service cần kiểm tra quyền theo tenant, nó sử dụng claim/token đã được đồng bộ hoặc gọi API/event contract của `tenant-service`; không sao chép bảng membership thành nguồn dữ liệu ghi độc lập.

## Shared assets

Thư mục `contracts/openapi` chỉ chứa hợp đồng giao tiếp. Khi cần client hoặc DTO, hãy sinh mã từ contract cho từng service thay vì tạo một thư viện domain dùng chung.

`libraries/common-lib` chỉ được chứa DTO kỹ thuật dùng chung, hiện tại là response envelope. Không đưa entity, repository, service, business rule, database driver hoặc persistence code vào thư viện này.

## Database migrations

Mỗi business service sở hữu database dùng Flyway và chỉ đọc migration từ `src/main/resources/db/migration` của module mình. Migration không được dùng chung, không được di chuyển giữa các service và không được chạy bằng kết nối tới database của service khác.

Mỗi service lưu sơ đồ dbdiagram.io tại `database/schema.dbml`. DBML mô tả database của service đó và không được tham chiếu bảng của service khác.
