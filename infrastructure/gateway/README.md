# Kong Gateway custom OPA authorizer

Kong là edge gateway của hệ thống. OPA quyết định authorization trước khi Kong chuyển request đến business service.

## Prerequisites

Mẫu này dùng custom plugin `opa-authorizer`, nên không phụ thuộc Kong OPA plugin Enterprise. Điền image Kong OSS và port vào `.env` từ `.env.example` trước khi chạy.

## Run locally

```powershell
docker compose --env-file .env up
```

Kong chạy DB-less, build custom plugin từ `kong/plugins/opa-authorizer` và nạp route/plugin từ `kong/kong.yml`. OPA chạy độc lập và nạp policy Rego từ `opa/policies`.

## Authorization flow

```text
Client -> Kong authentication -> opa-authorizer -> OPA policy decision -> business service
```

`identity-service` xác thực danh tính. `tenant-service` sở hữu membership user-tenant. OPA không được truy cập trực tiếp database của hai service này; policy data phải được đồng bộ qua bundle/event hoặc API nội bộ được kiểm soát.

Policy mặc định hiện là deny-all. Khi tích hợp authentication, chỉ dùng identity context do Kong hoặc identity provider đã xác thực. Không sử dụng header do client tự gửi làm nguồn quyền hạn.

## Adding a protected service

1. Thêm Kong Service và Route vào `kong/kong.yml`.
2. Gắn plugin `opa` theo mẫu `tenant-service`.
3. Mở rộng `opa/policies/authz.rego` và thêm test policy.
4. Đảm bảo service chạy cùng network `saas-gateway` với Kong.
5. Không gắn OPA vào route public như login, refresh token hoặc health check; các route này phải được khai báo tách biệt.

## Custom plugin

`handler.lua` gọi OPA trong Kong access phase. `schema.lua` xác thực URL OPA, timeout, fail-open/fail-closed và danh sách header identity được phép gửi tới OPA. Plugin mặc định fail-closed và không chuyển toàn bộ request header, đặc biệt là credential, tới OPA.
