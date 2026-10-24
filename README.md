# SaaS Platform

Các service trong `services/` chạy bằng Node.js và TypeScript qua npm workspaces.
Mỗi service có cấu hình build, môi trường và container riêng; `packages/common`
chứa hợp đồng API kỹ thuật, còn `packages/http` chứa phần HTTP dùng chung.
Trong từng service, `index.ts` và các thư mục `configs`, `controllers`,
`helpers`, `interface`, `middlewares`, `models`, `routes`, `services`
theo bố cục của nhánh `duy-tam`; `dto/request`, `dto/response`,
`repositories`, `exceptions` giữ ranh giới rõ ràng cho nghiệp vụ.

## Service boundaries

| Service | Trách nhiệm |
| --- | --- |
| `auth-service` | Đăng nhập JWT, Super Admin, tài khoản và khôi phục mật khẩu với MongoDB. |
| `identity-service` | Khung Identity có sẵn trên main; Auth hiện được triển khai trong auth-service. |
| `tenant-service` | Tenant, membership và role trong phạm vi tenant. |
| `billing-service` | Gói thuê bao, hóa đơn và thanh toán. |
| `notification-service` | Thông báo và trạng thái gửi. |

Mỗi service sở hữu database và migration của mình. Các service trao đổi qua
API hoặc event contract trong `contracts/openapi`, không chia sẻ entity,
repository hay truy cập trực tiếp database của nhau. Auth và Tenant đã có nghiệp vụ MongoDB, JWT, membership/course, invitation và quota.
Các service còn lại giữ nguyên hiện trạng trên main.

Sổ tay [AI-01](docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2%20%281%29.md)
mô tả MVP RAG dự kiến và phân biệt phần đã có với phần cần triển khai.
Frontend, Document/Chat, worker và Python inference giữ nguyên hiện trạng của main.
Auth sử dụng JWT theo yêu cầu hiện tại; gateway vẫn giữ policy từ chối route bảo vệ cho đến khi được tích hợp.

## Phát triển

Tại thư mục gốc:

```powershell
npm ci
npm run build
npm run typecheck
npm test
```

Để chạy riêng một service, sao chép `.env.example` thành `.env` trong thư mục
service, sau đó chạy script `start` của workspace tương ứng. Ví dụ:

```powershell
npm run start --workspace @saas/identity-service
```

`PORT` là cổng Node.js lắng nghe. `HOST_PORT` chỉ dùng khi chạy Docker Compose.

## Containers

Khởi động gateway trước để tạo network `saas-gateway`, rồi khởi động toàn bộ
service Node.js:

```powershell
docker compose --env-file infrastructure/gateway/.env.example -f infrastructure/gateway/compose.yaml up --build -d
docker compose --env-file infrastructure/node/.env.example -f infrastructure/node/compose.yaml up --build -d
```

Có thể chạy riêng từng `services/<name>/compose.yaml` sau khi network đã có;
sao chép `.env.example` thành `.env` trong thư mục service trước khi chạy.
Gateway hiện từ chối các route bảo vệ theo mặc định cho đến khi có xác thực
đáng tin cậy và policy phù hợp.

## Cấu trúc hỗ trợ

- `templates/node-service-template`: mẫu tạo Node.js service mới.
- `docs/architecture`: ranh giới service và quyết định kiến trúc.
- `docs/development`: quy chuẩn TypeScript.
- `infrastructure/gateway`: Kong và OPA.

## Auth và Tenant trong cùng project

Code nằm tại `services/auth-service` và `services/tenant-service`, thuộc npm workspaces hiện có. Hai service là workspace của repository, dùng package-lock.json chung ở thư mục gốc.

Tại thư mục gốc: `npm ci`, `npm run build`, `npm run typecheck`, `npm test`.
Sao chép `.env.example` thành `.env` trong từng service, điền MongoDB và các secret.
MongoDB cần replica set hoặc Atlas cho transaction; Auth và Tenant dùng hai database riêng.
`AUTH_TENANT_TOKEN` phải giống nhau giữa hai service, còn `JWT_SECRET` chỉ nằm ở Auth.

Chạy lần lượt trong hai terminal:

```powershell
npm run start --workspace @saas/auth-service
npm run start --workspace @saas/tenant-service
```

Mặc định Auth cổng 4001, Tenant cổng 4002; `AUTH_SERVICE_URL=http://localhost:4001` khi chạy local.
Khi chạy Compose chung, Auth/Tenant đọc `.env` tương ứng và dùng DNS nội bộ auth-service. URI MongoDB trong container phải trỏ tới địa chỉ mà container truy cập được, không dùng localhost của máy host.

`/health` giữ response chung của main; `/health/live` và `/health/ready` bổ sung kiểm tra trạng thái.
API nghiệp vụ giữ luồng cookie/CSRF và JWT đã triển khai; xem README của từng service.
`npm run test:platform` chạy kiểm thử tích hợp Auth/Tenant bằng MongoDB replica set tạm và SMTP local.
`.env`, file build, node_modules và dữ liệu test không được commit hoặc đưa vào Docker build context.
