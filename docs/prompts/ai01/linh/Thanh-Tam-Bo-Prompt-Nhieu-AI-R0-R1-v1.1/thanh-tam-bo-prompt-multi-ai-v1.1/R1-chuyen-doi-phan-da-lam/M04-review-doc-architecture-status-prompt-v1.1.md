# PROMPT M04 / v1.1 — Điều phối, review từng diff và tổng hợp tính phù hợp V4

**Mã:** `M04-review-doc-architecture-status`  
**Chủ quyền file:** `READ-ONLY (không sửa mã nguồn)`  
**Nhánh gợi ý:** `ai/m04-review-doc-architecture-status-r1`  
**Điều kiện:** R0 đã ổn định, các dependency của M04 đã được phê duyệt, không tự bắt đầu COOK.

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

### Phần B — Nhiệm vụ M04: kiểm toán read-only sau các PR

**Quyền hạn:** chỉ đọc toàn repo và artifact các task P01–P10, M01–M03. Không sửa file, không đẩy code, không merge, không tự chọn phạm vi mới.

**Việc phải làm:**
1. Đọc `AGENTS.md`, V4, trạng thái thực tế của `main`, các diff của branch đã gửi, test logs của từng task. Kiểm tra file ownership và xung đột merge.
2. Phân loại **phần đã triển khai/có test**, **sửa nhỏ**, **đã chuyển persistence**, **chưa làm**. Không nâng trạng thái dựa trên README hoặc dự thảo contracts.
3. Kiểm 4 điều kiện bắt buộc: (a) 1 service = 1 **logical** MongoDB database + runtime credential; (b) không DB access xuyên service; (c) API upload và các hành vi cũ không regression; (d) Auth/Chat/Document security fail-closed và Redis/S3 không coi là DB dùng chung.
4. Kiểm V4 là đích và việc chưa làm không bị tạo lén: worker, retrieval/vector, chat history, gateway routes, frontend API thật, billing, notification.
5. Kiểm file migration có thể rollback, không xóa dữ liệu thật; test U1 PDF parse được và U6 2 tenants thật; không bị bỏ assertion.
6. Báo kết quả theo từng PR `APPROVE / REQUEST CHANGES / NOT EVALUATED`, kèm đường dẫn evidence, mức độ nguy cơ và thứ tự merge được đề xuất. Không nói "TO-BE hoàn tất".

**Output:** bảng theo service `AS-IS | Đã làm | Diff | Test | Còn thiếu | Đạt scope?`; thứ tự tích hợp với dependencies; danh sách **việc chưa làm phải để nguyên**. Nếu audit cần sửa code, chỉ mở issue riêng giao đúng owner, không tự sửa.

## Phần C — Lời nhắc đóng nhiệm vụ

Chỉ hoàn thành một giai đoạn, kết luận có bằng chứng, liệt kê cụ thể phần chưa làm và dừng. Không commit/push/merge.
