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

`packages/common` chỉ chứa DTO và formatter kỹ thuật dùng chung. `packages/http` chứa phần HTTP dùng chung. Không đưa entity, repository, business rule, database driver hoặc persistence code vào các package này.

## Database migrations

Mỗi business service sở hữu migration trong `database/migrations` của chính mình. Chọn công cụ migration khi chọn database engine; migration không được dùng chung, không được di chuyển giữa các service và không được chạy bằng kết nối tới database của service khác.

Mỗi service lưu sơ đồ dbdiagram.io tại `database/schema.dbml`. DBML mô tả database của service đó và không được tham chiếu bảng của service khác.

## Mở rộng cho MVP RAG

`identity-service` sẽ triển khai xác thực user và session. `tenant-service` sẽ sở hữu tenant, membership, course, enrollment và quyền theo course. `document-service` dự kiến sở hữu document, chunk, embedding và trạng thái ingestion; worker xử lý queue theo cùng ranh giới sở hữu này. `chat-service` dự kiến sở hữu conversation, message, citation và feedback, đồng thời điều phối RAG trong MVP. Nếu tách RAG thành service riêng về sau, cần chốt API và quyền truy cập dữ liệu trước khi tách.

`billing-service` và `notification-service` hiện chỉ có health endpoint; thanh toán thực nằm ngoài MVP. Không chuyển bảng subscription sang `tenant-service` chỉ vì tính năng billing chưa triển khai. Các service mới được thêm vào `services/` khi bắt đầu code, dùng `templates/node-service-template`. `apps/web` và `ai/` chỉ tạo khi có frontend và pipeline Python thực tế. Sổ tay thiết kế tại `docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2 (1).md` mô tả lộ trình và tiêu chí nghiệm thu.
