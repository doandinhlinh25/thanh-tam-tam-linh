# PROMPT M01 / v1.1 — Cách ly quyền MongoDB của hai service đã dùng DB

**Mã:** `M01-mongodb-quyen-db-auth-tenant`  
**Chủ quyền file:** `infrastructure/sandbox/**; scripts/sandbox.mjs; test/sandbox-config.test.js`  
**Nhánh gợi ý:** `ai/m01-mongodb-quyen-db-auth-tenant-r1`  
**Điều kiện:** R0 đã ổn định, các dependency của M01 đã được phê duyệt, không tự bắt đầu COOK.

## Phần A — Hợp đồng chung, không được bỏ qua

**Repository:** https://github.com/doandinhlinh25/thanh-tam-tam-linh  
**Baseline khảo sát:** `main` / `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b` (đọc lại HEAD thực tế trước khi làm).  
**Tài liệu đích:** `reference/Thanh-Tam-Tai-Lieu-Tong-Hop-BRD-Kien-Truc-V4.md` (TO-BE, không phải hệ thống đã chạy).  
**Đợt:** R1 — chỉ chuyển đổi thành phần **đã có chức năng hoạt động**, không làm tính năng mới.  
**MẶC ĐỊNH:** `GIAI_DOAN = SCOUT`.

### Quy tắc cứng

1. Xem `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` và code/test thực tế trước khi lập phương án. Báo cáo sự khác nhau giữa AS-IS và V4; không coi bản thiết kế là code tồn tại.
2. **Chỉ làm đúng một stage** mỗi lần nhận lệnh: `SCOUT` (chỉ đọc), `BRAINSTORM` (nếu cần), `PLAN` (DRAFT, không sửa code), `COOK` (chỉ sau khi người giao việc duyệt `Status: APPROVED`), `TEST` (test độc lập), `REVIEW` (read-only). KHÔNG tự chuyển stage.
3. Trên branch/worktree riêng, quyền sở hữu file rõ ràng; bảo toàn file tracked/untracked đang có. Không tự `commit`, `push`, `merge`, `rebase`, `reset`, mở PR hay force-push. Không sửa mã nguồn ngoài whitelist của nhiệm vụ.
4. **Tính năng CHƯA có thì KHÔNG đụng:** ingestion worker; PDF extraction/chunk/embedding; Mongo Vector Search/retrieval; hoàn thiện Chat session/permission/history/feedback; frontend nối backend; payment/notification; Kong public routes mới; OPA allow; analytics mới. Không tạo endpoint/collection thực thi cho backlog.
5. **Không đọc/ghi trực tiếp DB của service khác.** Mỗi service chỉ có MongoDB database + credential của mình. Tenant và Auth trao đổi bằng API; Document chỉ dùng API Tenant để kiểm quyền. S3/MinIO dùng cho PDF; Redis Streams là hạ tầng truyền thông, không phải DB nghiệp vụ dùng chung.
6. Không xử lý dữ liệu sản xuất, chạy migration thật, xóa database/volume, tạo dịch vụ trả phí, chỉnh secret thật hoặc đổi hạ tầng production nếu không có **phê duyệt riêng**. Tuyệt đối không in mật khẩu, JWT, cookies, API keys, URI chứa password trong tài liệu hoặc log.
7. Mọi thay đổi phải giữ tương thích hợp đồng đã triển khai hoặc liệt kê tác động và lập kế hoạch chuyển đổi được phê duyệt. Không "green" test bằng cách bỏ kiểm tra, thay assertion, mock che lỗi; phân biệt PASS, FAIL và NOT RUN.
8. Nếu code thực tế khác prompt, có phụ thuộc service khác hoặc cần làm chức năng mới để hoàn tất: **DỪNG** phần đó, ghi blocker và đề nghị nhiệm vụ mới. Không tự mở rộng phạm vi.

### Định dạng đầu ra bắt buộc

- Mã nhiệm vụ, stage, commit/branch/worktree, người sở hữu và phạm vi file.
- Bảng `AS-IS | Đích V4 | Việc có thể sửa bây giờ | Việc chưa có, đóng băng`.
- Bảng `File | Lý do thay đổi | Hành vi/API phải giữ | Test | Rollback`.
- Bằng chứng kiểm thử với lệnh chính xác; ghi `NOT RUN` nếu không chạy được; diff whitelist và file bị ảnh hưởng.
- Mục `Blockers/Cần chủ dự án duyệt`; tự dừng sau stage hiện tại.

### Cú pháp giao giai đoạn (do chủ dự án chọn)

```text
GIAI_DOAN = SCOUT
# Chỉ khảo sát, không sửa mã nguồn. Dừng ngay sau báo cáo.
```

```text
GIAI_DOAN = PLAN
# Dựa vào SCOUT đã được duyệt; chỉ soạn DRAFT, không sửa code.
```

```text
GIAI_DOAN = COOK
APPROVED_PLAN = docs/plans/YYYY-MM-DD/<ten-task>.md
PLAN_STATUS = APPROVED
# Chỉ triển khai từng thay đổi được phê duyệt; không commit/push/merge.
```

```text
GIAI_DOAN = TEST
# Chạy kiểm thử độc lập; báo bằng chứng.
```

```text
GIAI_DOAN = REVIEW
# Đánh giá diff/tính an toàn; không tự sửa hoặc merge.
```

### Phần B — Nhiệm vụ M01: database credential isolation cho Auth/Tenant AS-IS

**Lý do:** Auth đã dùng `MONGODB_URI` và collections trong MongoDB; Tenant cũng dùng MongoDB và Mongo replica set để chạy transaction. Sandbox có 2 database logic `auth_sandbox` / `tenant_sandbox` nhưng đang khởi tạo kết nối bằng thông tin đăng nhập Mongo root dùng chung. Đây là việc gia cố **cách truy cập DB đã tồn tại**, không tạo nghiệp vụ mới.

**File chủ quyền:** chỉ `infrastructure/sandbox/**`, `scripts/sandbox.mjs`, `test/sandbox-config.test.js`. Không được sửa `services/auth-service/**`, `services/tenant-service/**`, Java Document hoặc scripts upload E2E (M03 phụ trách sau).

**Chỉ được phép nếu SCOUT xác nhận:**
- Xem `mongo-init.js`, Compose sandbox, trình tạo `.env` của `scripts/sandbox.mjs`, readiness/config tests. Đối chiếu real URI và quyền hiện có, không in password.
- Thiết kế tài khoản Mongo riêng cho Auth và Tenant, **mỗi tài khoản readWrite đúng DB của mình**, không quyền `readAnyDatabase`/clusterAdmin. Chọn `authSource` chính xác và kiểm thử từ chối truy vấn chéo DB. Chạy Mongo replica set như hiện có, không tắt transaction.
- Giữ nguyên dữ liệu, DB, collection và business rules hiện hữu; chỉ cập nhật provisioning/config kiểm thử phát sinh từ đổi credential. Secrets chỉ ở sandbox `.env` được gitignore, luôn dùng giá trị riêng/ngẫu nhiên.
- Sandbox đã có volume đang dùng? Chỉ đề xuất cơ chế nâng cấp **không xóa volume**; `createUser`/`updateUser` phải idempotent và quản lý đổi credentials an toàn. Nếu không chứng minh được, dừng để owner chọn môi trường test mới.

**Không được:** tạo `tt_document_db`, `tt_chat_db`, `billing_db`, `notification_db` trống chỉ để "đúng sơ đồ"; migrate Document; tạo collection hoặc business service mới; sửa cấu hình production.

**Khi COOK đã được duyệt:** chỉnh đúng file whitelist; bổ sung kiểm tra config để phát hiện runtime root credentials/role quá rộng mà không log secrets. Không chạy thao tác thay đổi secret trên hệ thống có dữ liệu chưa phê duyệt.

**Acceptance:** (1) Auth không có quyền đọc `tenant_sandbox`; Tenant không có quyền đọc `auth_sandbox`; (2) login Auth/transaction Tenant vẫn hoạt động trong sandbox có quyền chạy test; (3) không in secret; (4) có rollback dựa trên bản sao cấu hình, không reset volume. Nếu không có môi trường để đo cách ly quyền, báo NOT RUN, không báo đã chứng minh.

**Phụ thuộc:** R0 P01/P02/P07 đã review. M02 có thể song song vì file không trùng; M03 chạy sau khi M01 và M02 hoàn tất.

## Phần C — Lời nhắc đóng nhiệm vụ

Chỉ hoàn thành một giai đoạn, kết luận có bằng chứng, liệt kê cụ thể phần chưa làm và dừng. Không commit/push/merge.
