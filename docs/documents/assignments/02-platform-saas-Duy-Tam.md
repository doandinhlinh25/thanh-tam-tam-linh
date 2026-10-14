# Người 2 — Backend Platform & SaaS Lead

**Trạng thái:** Mới có khung Express, `/health`, package HTTP và Kong/OPA mặc định từ chối route bảo vệ.<br>
**Nguồn:** Sổ tay AI-01, mục 4A, 9.2, 10, 11 và 14.<br>
**Phạm vi mã nguồn:** `services/identity-service/`, `services/tenant-service/`, `infrastructure/gateway/`, `infrastructure/node/`, `contracts/openapi/` và cấu hình môi trường dùng chung.

## Mục tiêu

Triển khai xác thực phiên tự xây dựng, quyền tenant/course và hạ tầng tích hợp. Giữ Kong làm gateway, Identity sở hữu user/credential/session, Tenant sở hữu membership/course/enrollment. Tiếp tục Express cho MVP theo khuyến nghị hiện tại; nếu có yêu cầu bắt buộc NestJS, ghi quyết định và kế hoạch chuyển đổi trước khi viết nghiệp vụ.

## Công việc theo thứ tự

1. **Tuần 1 — contract và quyết định nền tảng:** chốt cookie/CSRF, luồng Kong → Identity → OPA → service, OpenAPI Auth/Tenant/Course, response `ApiResponse` và error code. Chốt cơ chế xác thực nội bộ; không tin header identity do client tự gửi.
2. **Tuần 1–2 — dữ liệu và Auth:** chọn PostgreSQL driver/công cụ migration; cập nhật DBML và migration của Identity. Làm user, Argon2id password, opaque session chỉ lưu hash token, login/logout/me, reset token một lần, rate limit và audit không lộ bí mật.
3. **Tuần 2 — Tenant/Course:** cập nhật DBML và migration của Tenant; làm tenant, membership, invitation, role/permission, course, enrollment, lecturer assignment và seed hai tenant. Business service tự kiểm tra quyền sau gateway.
4. **Tuần 2–3 — Kong/OPA:** nối Identity đã xác thực vào policy, mặc định deny cho đến khi test end-to-end đạt. Thêm request ID, timeout, chuẩn lỗi và health/readiness phù hợp với dependency thật.
5. **Tuần 3–5 — hạ tầng và quota:** Compose cho PostgreSQL, Redis, object storage, service và inference khi từng thành phần có mã; secrets qua environment. Làm quota/rate limit và phép đếm an toàn khi request đồng thời. Gói Free/Pro ở MVP là chính sách quota demo; `billing-service` vẫn sở hữu subscription/thanh toán về sau.
6. **Tuần 5 — kiểm thử tích hợp:** IDOR, giả mạo session/header, hết hạn/thu hồi phiên, CSRF, reset token dùng lại, membership revoked, quota concurrency và truy cập chéo tenant.

## Phụ thuộc và bàn giao cho nhóm

| Người nhận | Bàn giao |
|---|---|
| Người 1 | OpenAPI public, cookie/CSRF, role/permission và response lỗi để làm client/UI |
| Người 3 | Course/tenant authorization API, object storage, PostgreSQL, Redis, service credential và Compose |
| Người 4 | Session/tenant authorization contract, quota chat, request ID và response envelope |

**Sản phẩm bàn giao:** mã Identity/Tenant, migration riêng từng service, OpenAPI, Kong/OPA policy và test, Compose, `.env.example`, seed demo, setup guide. Tất cả public class/function có JSDoc; giá trị cấu hình ở constant/env; các phương thức validation trong service trả `boolean`.

## Điều kiện nghiệm thu

- Không lấy `tenant_id`, role hoặc user ID từ request làm bằng chứng cấp quyền. Không đọc database của service khác.
- Không có test nào truy cập chéo tenant thành công; request sau khi thu hồi membership/session bị chặn.
- Route bảo vệ chỉ được mở sau khi Identity và OPA dùng danh tính đã xác thực từ đầu đến cuối.
- Stack demo khởi động theo hướng dẫn, migration chạy lại an toàn, health check phản ánh trạng thái thực; `npm run build`, `npm run typecheck`, `npm test` đạt.
