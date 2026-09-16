# SaaS Platform

Khung Maven multi-module cho hệ thống SaaS theo kiến trúc microservice.

## Service boundaries

- `libraries/common-lib`: DTO response wrapper dùng chung, không chứa domain hoặc persistence code.
- `services/identity-service`: Xác thực, phân quyền và quản lý danh tính.
- `services/tenant-service`: Quản lý tenant, thiết lập SaaS theo tenant và membership user-tenant.
- `services/billing-service`: Gói thuê bao, hoá đơn và thanh toán.
- `services/notification-service`: Gửi email, thông báo đẩy và các thông báo bất đồng bộ.

Mỗi service là một Maven module độc lập, được đóng gói thành một container riêng. Service sở hữu database và migration của chính mình; không service nào được truy cập trực tiếp database của service khác. Các service trao đổi qua API hoặc event contract đặt tại `contracts/openapi`, không chia sẻ domain model, repository hay persistence code.

`identity-service` chỉ xác thực và cung cấp định danh user. `tenant-service` sở hữu membership cùng role/quyền trong phạm vi tenant; user ID được lưu như external reference, không tạo foreign key tới database của identity service.

## Chạy một service

Trong thư mục của service, điền giá trị vào `.env`, rồi chạy:

```powershell
docker compose up --build
```

Mỗi business service có các tệp sau:

- `Dockerfile`: Build riêng Maven module của service.
- `compose.yaml`: Chạy một container ứng dụng riêng.
- `.env`: Biến môi trường cục bộ, không được commit.
- `.env.example`: Mẫu cấu hình không có bí mật.
- `database/migrations`: Migration database do service sở hữu.

## Flyway

Mỗi business service sở hữu database có `flyway-core` và `flyway-maven-plugin`, dùng migration tại `src/main/resources/db/migration`.

Migration đầu tiên của một service có dạng `V1__initial_schema.sql`. Không đặt migration, entity hoặc database driver vào module dùng chung.

Mỗi service cũng có `database/schema.dbml` để vẽ schema riêng trên dbdiagram.io. DBML là tài liệu thiết kế; Flyway migration là nguồn thay đổi database khi chạy.

Hãy bổ sung database driver và Flyway database support phù hợp vào đúng service sau khi chọn database vendor. Điều này cho phép từng service sử dụng database engine và lifecycle migration độc lập.

## Supporting directories

- `contracts/openapi`: Hợp đồng API dùng để chia sẻ giữa các service và client.
- `docs/architecture`: Tài liệu kiến trúc và quyết định kỹ thuật.
- `docs/development`: Quy chuẩn code và hướng dẫn phát triển.
- `scripts`: Script phục vụ phát triển và vận hành.
- `templates/service-template`: Template để tạo service mới theo cùng cấu trúc chuẩn.
- `infrastructure/gateway`: Mẫu Kong Gateway OSS với custom OPA authorizer cho authorization tại edge.

Chạy toàn bộ reactor trên Windows:

```powershell
.\mvnw.cmd verify
```
