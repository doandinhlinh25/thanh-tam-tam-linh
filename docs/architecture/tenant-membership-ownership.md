# Tenant membership ownership

## Decision

`tenant-service` sở hữu membership user-tenant.

## Responsibilities

- `identity-service` xác thực user và phát hành định danh bất biến của user.
- `tenant-service` tạo, mời, vô hiệu hoá membership và quản lý role theo tenant.
- Các service nghiệp vụ khác dùng user ID và tenant ID từ contract; chúng không ghi vào hoặc đọc trực tiếp database membership.

## Data boundary

Database của `tenant-service` có thể lưu `identityUserId` như external reference. Nó không có foreign key qua database khác. Khi user bị xoá hoặc vô hiệu hoá, `identity-service` công bố event; `tenant-service` xử lý event đó theo quy tắc nghiệp vụ của mình.
