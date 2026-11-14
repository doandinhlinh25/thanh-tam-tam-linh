# PROMPT M03 / v1.1 — Chuyển sandbox/test của upload hiện có sang MongoDB

**Mã:** `M03-sandbox-mongodb-document-e2e`  
**Chủ quyền file:** `infrastructure/sandbox/**; scripts/sandbox.mjs; scripts/sandbox-fixtures.mjs; scripts/sandbox-smoke.mjs; scripts/sandbox-upload-e2e.mjs; test/sandbox-config.test.js`  
**Nhánh gợi ý:** `ai/m03-sandbox-mongodb-document-e2e-r1`  
**Điều kiện:** R0 đã ổn định, các dependency của M03 đã được phê duyệt, không tự bắt đầu COOK.

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

### Phần B — Nhiệm vụ M03: tích hợp sandbox sau M01/M02

**Điều kiện trước khi bắt đầu:** M01 và M02 đã REVIEW/APPROVE, branch tích hợp sạch, mã Document upload có MongoDB adapter đã được test unit; không chạy song song với M01 vì trùng file sandbox.

**File chủ quyền:** `infrastructure/sandbox/**`, `scripts/sandbox.mjs`, `scripts/sandbox-fixtures.mjs`, `scripts/sandbox-smoke.mjs`, `scripts/sandbox-upload-e2e.mjs`, `test/sandbox-config.test.js`. Các file `services/**`, `apps/web/**`, `contracts/**`, `infrastructure/gateway/**` ngoài scope.

**Chỉ làm những việc liên quan tới test upload đã triển khai:**
- Chuyển Document runtime config của sandbox từ PostgreSQL sang `tt_document_db` (hoặc `document_sandbox`, phải ghi tên DB sandbox nhất quán); tạo **credential riêng chỉ readWrite DB Document**. Không tạo MongoDB root credential cho service runtime; root chỉ dùng bootstrap an toàn.
- Không xóa PostgreSQL volume hiện có hoặc bí mật sandbox. Thay đổi compose mới phải hỗ trợ chạy trong môi trường test cô lập. Nếu migration test từ Postgres sang Mongo cần dữ liệu mẫu cũ, dùng fixture mới/backup đã xác minh và chỉ chạy sau khi owner đồng ý.
- Chỉnh script smoke/upload E2E chỉ ở chỗ kiểm metadata/jobs và idempotency để đọc Mongo mới (thay PostgreSQL); giữ lại kiểm S3 private, Redis event, 401/403/409/503 và dependency outage.
- Khắc phục **hai thiếu sót kiểm thử đã được ghi review ngày 27/10/2026**: U1 PDF fixture thực sự hợp lệ (mở được bằng PDF parser, có trang + văn bản), U6 dùng **tenant thứ hai có thật** và xác minh không cross-tenant. Không coi một ID `000...000` là tenant thứ hai thật.
- Kiểm quyền MongoDB: Auth credential không đọc Tenant/Document; Tenant credential không đọc Auth/Document; Document credential không đọc Auth/Tenant. Chạy check trong chính sandbox có quyền đã duyệt; không chạm dữ liệu ngoài sandbox.
- Ghi rõ môi trường thử chỉ xác nhận upload tới QUEUED. **Không** chờ trạng thái READY, không thêm worker/embedding/retrieval mới.
- Nếu không thể giữ test HTTP 202 → S3 → Mongo → Redis tương đương, báo FAIL chứ không mock kết quả hoặc bỏ test.

**Không được:** tự chạy `docker compose down -v`; đổi network production; tạo dịch vụ Vector Search, Chat runtime mới, OPA policy allow, billing/notification, OCR/worker/retrieval; tự xóa PostgreSQL database thật. Có thể xóa **dịch vụ Postgres khỏi Compose mới** khi chủ dự án đã duyệt, nhưng **không xóa volume/dữ liệu cũ**.

**Acceptance:**
1. Sandbox Auth/Tenant/Document ready với **3 DB MongoDB logic, 3 users tương ứng**, trong một cluster cô lập là hợp lệ; Mongo replica set vẫn có transactions cho Tenant.
2. E2E xác nhận theo thứ tự 202, 401, 403, 409, idempotency; S3 private object, Mongo metadata/jobs, Redis stream payload và checksum.
3. U1 dùng PDF parse được; U6 kiểm 2 tenants thực. Cần minh bạch trường hợp NOT RUN.
4. Hoàn tất test cross-DB permissions, test config/health; ghi câu lệnh và kết quả thực tế; không xóa volume/secret.
5. Hướng dẫn chạy sandbox và giới hạn tính năng được cập nhật **chỉ trong thư mục sandbox**.

**Phụ thuộc:** M01 + M02 đã xong; REVIEW độc lập M04 sau khi integration tests thực tế.

## Phần C — Lời nhắc đóng nhiệm vụ

Chỉ hoàn thành một giai đoạn, kết luận có bằng chứng, liệt kê cụ thể phần chưa làm và dừng. Không commit/push/merge.
