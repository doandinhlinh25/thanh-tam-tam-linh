# Service template

Template này dùng cấu trúc Spring truyền thống giống `tenant-service`. Nó không nằm trong Maven reactor và không được build như service thật.

## Tạo service mới

1. Copy toàn bộ thư mục này vào `services/<service-name>`.
2. Đổi `artifactId` trong `pom.xml` từ `__SERVICE_NAME__` thành tên service, ví dụ `catalog-service`.
3. Đổi thư mục package `org/example/saas/template` thành package của service, ví dụ `org/example/saas/catalog`.
4. Thay toàn bộ token `__SERVICE_NAME__` trong `compose.yaml` bằng tên service thực tế.
5. Thêm `<module>services/<service-name></module>` vào `pom.xml` gốc.
6. Điền `.env` từ `.env.example`, thêm database driver/Flyway database support cho database engine của service, cập nhật `database/schema.dbml` và tạo migration đầu tiên tại `src/main/resources/db/migration`.

## Package responsibilities

- `controller`: HTTP endpoint; không chứa business logic.
- `dto/request` và `dto/response`: Dữ liệu vào/ra API.
- `entity`: JPA entity của database do service sở hữu.
- `repository`: Truy cập database nội bộ của service.
- `services` và `services/impl`: Interface và business logic.
- `exception`: Business exception và HTTP error handler.
- `utils`: Tiện ích kỹ thuật nhỏ, không chứa business logic.

Không service nào được dùng database, entity, repository hoặc migration của service khác.
