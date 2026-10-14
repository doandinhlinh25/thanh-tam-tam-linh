# SaaS Platform

Bốn service trong `services/` chạy bằng Node.js và TypeScript qua npm workspaces.
Mỗi service có cấu hình build, môi trường và container riêng; `packages/common`
chứa hợp đồng API kỹ thuật, còn `packages/http` chứa phần HTTP dùng chung.
Trong từng service, `index.ts` và các thư mục `configs`, `controllers`,
`helpers`, `interface`, `middlewares`, `models`, `routes`, `services`
theo bố cục của nhánh `duy-tam`; `dto/request`, `dto/response`,
`repositories`, `exceptions` giữ ranh giới rõ ràng cho nghiệp vụ.

## Service boundaries

| Service | Trách nhiệm |
| --- | --- |
| `identity-service` | Định danh và xác thực user. |
| `tenant-service` | Tenant, membership và role trong phạm vi tenant. |
| `billing-service` | Gói thuê bao, hóa đơn và thanh toán. |
| `notification-service` | Thông báo và trạng thái gửi. |

Mỗi service sở hữu database và migration của mình. Các service trao đổi qua
API hoặc event contract trong `contracts/openapi`, không chia sẻ entity,
repository hay truy cập trực tiếp database của nhau. Hiện các service mới có
endpoint `/health`; nghiệp vụ và database chưa được triển khai.

Sổ tay [AI-01](docs/documents/AI01_Handbook_RAG_SaaS_Microservices_Custom_Auth_v2%20%281%29.md)
mô tả MVP RAG dự kiến và phân biệt phần đã có với phần cần triển khai.
Frontend, Document/Chat, worker, Python inference và xác thực phiên chưa có trong repo.

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
