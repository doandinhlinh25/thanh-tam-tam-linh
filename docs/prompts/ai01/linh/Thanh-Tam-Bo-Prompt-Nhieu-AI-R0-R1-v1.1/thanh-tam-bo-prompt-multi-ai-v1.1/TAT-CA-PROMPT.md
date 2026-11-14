# BỘ PROMPT THANH TÂM — COPY/PASTE TỪNG AI

Đọc `README-BAT-DAU.md` trước. Tài liệu này gom phần quan trọng của tất cả prompt để tìm nhanh. **Khi gửi cho AI, dùng file riêng hoàn chỉnh** từ các thư mục R0 / R1, không chỉ gửi đoạn ngắn.


---

# R0-on-dinh-hien-trang / P01-auth-prompt-v1.0.md

# PROMPT P01 / v1.0 — Auth Service — gia cố nghiệp vụ xác thực đã có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P01-auth`  
**Độ ưu tiên:** `P0`  
**Người sở hữu:** Thành viên Backend Auth  
**Vùng sửa code ĐỘC QUYỀN:** `services/auth-service/**`  
**Nhịp tích hợp:** Song song với P02/P03/P04/P05/P06 sau P07  
**Nhánh gợi ý:** `ai/p01-auth-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Auth Service — gia cố nghiệp vụ xác thực đã có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

services/auth-service/app.ts; routes/admin/account.route.ts; routes/internal.route.ts; middlewares/admin/auth.middleware.ts; middlewares/security.middleware.ts; services/auth.service.ts; models/account-admin.model.ts; models/action-token.model.ts

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Kiểm lại luồng login, logout, me, csrf, đổi/quên/reset mật khẩu **đã có**; sửa bug tái hiện được, kiểm không rò cookie/JWT và reset token dùng một lần.
- Kiểm auth JWT HS256 `tokenAdmin`, `authVersion`, user vô hiệu hóa; Origin/CSRF/rate-limit ở các endpoint hiện có; giữ định dạng response AS-IS.
- Kiểm `/internal/auth/introspect` chỉ được gọi bằng đúng `AUTH_TENANT_TOKEN`, không để client giả mạo identity; bổ sung regression tests nội bộ trong vùng owner nếu cần.
- Bổ sung mô tả đúng về `MONGODB_URI` đang có, index/TTL và cấu hình an toàn trong README service nếu là hiệu chỉnh tài liệu hiện trạng.

### Tuyệt đối KHÔNG làm

- KHÔNG tạo identity provider thứ hai; KHÔNG thêm OAuth/SSO/MFA/refresh-token mới.
- KHÔNG đổi `tokenAdmin` sang tên cookie theo tài liệu TO-BE; KHÔNG thay cấu trúc login API trong đợt R0.
- KHÔNG sửa `services/tenant-service/**`, shared `test/platform.integration.ts`, gateway hoặc hợp đồng toàn hệ thống.
- KHÔNG tự đổi database name/credential đang được môi trường sử dụng hoặc xóa account.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/auth-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p01-auth` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Đường đăng nhập hợp lệ vẫn hoạt động; tài khoản vô hiệu hóa/JWT hết hạn bị từ chối như contract hiện tại.
2. CSRF/Origin phải từ chối request không hợp lệ, bảo toàn hành vi GET/HEAD/OPTIONS đã thiết kế.
3. Các test regression mới (nếu có) tái hiện bug trước khi sửa; không lộ token/log.
4. Node build/typecheck và test liên quan được báo đúng kết quả.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
npm run build --workspace @saas/auth-service; npm run typecheck --workspace @saas/auth-service; npm run test:platform (chỉ đọc file test chung)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P02-tenant-prompt-v1.0.md

# PROMPT P02 / v1.0 — Tenant Service — multi-tenant/course/quota hiện có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P02-tenant`  
**Độ ưu tiên:** `P0`  
**Người sở hữu:** Thành viên Backend Tenant  
**Vùng sửa code ĐỘC QUYỀN:** `services/tenant-service/**`  
**Nhịp tích hợp:** Song song với P01/P03/P04/P05/P06 sau P07  
**Nhánh gợi ý:** `ai/p02-tenant-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Tenant Service — multi-tenant/course/quota hiện có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

services/tenant-service/models/tenant.model.ts; models/tenant-membership.model.ts; models/course.model.ts; models/course-enrollment.model.ts; services/course.service.ts; services/membership.service.ts; services/quota.service.ts; routes/internal.route.ts; controllers/internal.controller.ts

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Rà hiện trạng tạo/sửa/khóa tenant, mời/tham gia/thu hồi membership, tạo môn, phân công lecturer, ghi danh student, quota đã có.
- Sửa lỗi quyền đọc/ghi theo `tenantId` và `courseId` được chứng minh bằng test; kiểm lecturer có assignment, student có enrollment; tenant không active không có quyền.
- Kiểm `/internal/authorization/course`, `/internal/authorization/check`, `/internal/quota/chat/consume` đang có; mỗi đường yêu cầu credential riêng và session gốc đã xác minh qua Auth.
- Kiểm idempotency `requestId` khi tiêu thụ quota hiện có, kiểm không trừ quota trùng khi retry; sửa bug mà không đổi contract tùy tiện.
- Thêm regression test phục vụ đa tenant trong vùng owner và ghi rõ test liên service đề nghị P08.

### Tuyệt đối KHÔNG làm

- KHÔNG tạo bảng/collection nghiệp vụ mới, event broker, entitlement/billing plan mới, hay quota chính sách TO-BE chưa chốt.
- KHÔNG chỉnh Auth, Chat, Document, Gateway, `test/platform.integration.ts` (thuộc P08).
- KHÔNG sửa response HTTP 409 quota sang 429 chỉ vì V4 có đề xuất nếu chưa có quyết định tương thích.
- KHÔNG thêm endpoint public hoặc DB cross-service lookup.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/tenant-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p02-tenant` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Tenant A/B không truy cập hoặc sửa course của nhau qua các API hiện có.
2. Lecturer/student sai assignment/enrollment không vượt quyền.
3. Service credential Document không thể dùng để gọi API quota Chat; quota retry cùng requestId không tính hai lần.
4. Các endpoint, lỗi và MongoDB collections hiện có bảo toàn khả năng tương thích.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
npm run build --workspace @saas/tenant-service; npm run typecheck --workspace @saas/tenant-service; npm run test:platform (đọc test chung, không sửa)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P03-document-prompt-v1.0.md

# PROMPT P03 / v1.0 — Document Service — hardening upload PDF hiện có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P03-document`  
**Độ ưu tiên:** `P0`  
**Người sở hữu:** Thành viên Backend Document (Java)  
**Vùng sửa code ĐỘC QUYỀN:** `services/document-service/**`  
**Nhịp tích hợp:** Song song; phối hợp P08 về test fixture, không sửa file P08  
**Nhánh gợi ý:** `ai/p03-document-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Document Service — hardening upload PDF hiện có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

services/document-service/src/main/java/com/linh/document/controller/UploadController.java; services/business/impl/UploadServiceImpl.java; services/authorization/impl/HttpCourseAuthorizationGatewayImpl.java; services/queue/impl/RedisIngestionQueueImpl.java; services/storage/impl/S3DocumentObjectStoreImpl.java; database/migrations/001_document_upload.sql

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Chỉ gia cố chuỗi đã chạy: `POST /api/v1/courses/{courseId}/documents` → Tenant authz → kiểm MIME/magic PDF → S3 private → PostgreSQL metadata/jobs → Redis Stream → `202 QUEUED`.
- Kiểm request thiếu cookie/không có quyền, header giả, file sai MIME/chữ ký, idempotency retry, conflict HTTP 409, timeout Tenant/Redis/S3, cleanup khi lỗi; sửa bug được xác nhận trong phần code này.
- Giữ nguyên `Idempotency-Key`, scope document `COURSE`, đường dẫn lưu S3, schema và event hiện đang được sử dụng. Kiểm biến cấu hình và xử lý lỗi.
- Bổ sung unit tests Java cho code upload đã có, tài liệu hóa rõ mức kiểm PDF chỉ là magic bytes (chưa xác nhận cấu trúc tệp).

### Tuyệt đối KHÔNG làm

- **KHÔNG chuyển PostgreSQL/JPA sang MongoDB** ở R0; V4 chỉ là đích, P03 chưa có migration approval.
- KHÔNG làm ingestion worker, extract/chunk/embedding/vector index/retrieval/get/delete document hay chuyển `READY`.
- KHÔNG tạo Mongo DB Document, outbox mới, không làm dual write, không đổi Docker sandbox.
- KHÔNG đọc/ghi collection của Tenant/Auth; chỉ dùng API authz đang có.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/document-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p03-document` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Upload được phép nhận 202 và đúng trạng thái `QUEUED` theo hệ thống hiện tại; anonymous/unauthorized trả 401/403.
2. Cùng idempotency key+cùng bytes không thêm document/job/event; bytes khác trả 409.
3. Lỗi dependency không bị hiểu là PDF `READY`; không tạo side effect trái kỳ vọng trong ca thất bại đã kiểm chứng.
4. Java tests chạy/báo trung thực; P08 được thông báo khi cần cập nhật test fixture.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
cd services/document-service && ./mvnw test (Windows: mvnw.cmd test); npm run sandbox:upload-e2e (chỉ nếu sandbox sẵn và có quyền)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P04-chat-prompt-v1.0.md

# PROMPT P04 / v1.0 — Chat Service — AI pipeline/LLM endpoint hiện có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P04-chat`  
**Độ ưu tiên:** `P0-SEC`  
**Người sở hữu:** Thành viên AI / RAG  
**Vùng sửa code ĐỘC QUYỀN:** `services/chat-service/**`  
**Nhịp tích hợp:** Song song với backend khác, merge sau security review  
**Nhánh gợi ý:** `ai/p04-chat-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Chat Service — AI pipeline/LLM endpoint hiện có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

app/api/controllers/chat_controller.py; app/api/controllers/llm_controller.py; app/core/security.py; app/ai/pipeline.py; app/ai/evidence_gate.py; app/ai/citation_validator.py; app/ai/retrieval/client.py; app/ai/llm/providers/openai_provider.py; tests/integration/test_chat_api.py

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Gia cố **pipeline RAG đã viết**: evidence gate, context building, citation validation, refusal policy, phân biệt `insufficient_evidence` và lỗi 403/429/5xx, provider timeout/rate limit, kiểm phiên bản request trong mã hiện có.
- `/internal/llm/generate` đã có Bearer auth: kiểm token sai/thiếu, không gọi provider; cải thiện xử lý lỗi và test đã có.
- **Lỗ hổng đã xác định:** `/api/v1/courses/{course_id}/chat` hiện dùng `X-Tenant-Id`/`X-User-Id` do client tự gửi hoặc mặc định anonymous. Được phép **đề xuất và, SAU APPROVED PLAN, vá fail-closed cho endpoint đã có** để không nhận identity không xác minh. Không được tự tạo nguồn xác thực giả/đánh dấu header là trusted. Nếu cần kết nối Auth/Tenant mới thì dừng ở phương án từ chối truy cập công khai, báo dependency cho đợt sau. Test cũ dựa vào spoof header cần được điều chỉnh minh bạch.
- Chỉ viết tests cho logic hiện có và documented mock retrieval/proxy, không giả định retrieval upstream đã vận hành.

### Tuyệt đối KHÔNG làm

- KHÔNG viết triển khai thật cho `verify_session_token` bằng cách tin header/client; KHÔNG thêm đường đăng nhập hoặc tích hợp Auth/Tenant thật khi chưa có approved cross-team plan.
- KHÔNG tạo collection, Mongo Chat repository, Chat history/feedback implementation, citations persistence, hay `personal-documents/chat` mới.
- KHÔNG viết Document retrieval endpoint, reranker service hoặc fine-tune model.
- KHÔNG chuyển SQLAlchemy/Alembic sang Mongo ngay trong R0; ghi gap riêng.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/chat-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p04-chat` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Header tenant/user giả không thể tạo tin cậy cho public chat; chưa có trusted auth thì fail-closed, không phải tự động "anonymous".
2. Bearer sai trên internal LLM trả 401 và không gọi provider.
3. Evidence rỗng/điểm thấp trả insufficient_evidence không gọi LLM; lỗi upstream trả lỗi kỹ thuật, citation không khớp bị loại.
4. Tests chỉ khẳng định phạm vi thật; không gắn nhãn end-to-end RAG đã xong.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
cd services/chat-service && python -m pytest tests/unit tests/contract tests/integration (nếu dependency đã cài); python -m pytest tests/evaluation
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P05-frontend-prompt-v1.0.md

# PROMPT P05 / v1.0 — Frontend React — cải thiện DEMO hiện có, không nối backend

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P05-frontend`  
**Độ ưu tiên:** `P1`  
**Người sở hữu:** Thành viên Frontend  
**Vùng sửa code ĐỘC QUYỀN:** `apps/web/**`  
**Nhịp tích hợp:** Song song, độc lập backend trong R0  
**Nhánh gợi ý:** `ai/p05-frontend-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Frontend React — cải thiện DEMO hiện có, không nối backend**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

apps/web/src/app/App.tsx; src/app/routes.ts; src/features/demo/adapters/demoData.ts; src/features/student/pages/StudentWorkspace.tsx; src/features/teacher/pages/TeacherWorkspace.tsx; src/features/auth/components/AuthPage.tsx; src/shared/api/apiClient.ts; apps/web/README.md

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Chỉ sửa UI đã có: login demo, phân vai admin/teacher/student, danh sách khóa học, documents demo, chat demo, feedback demo, đánh giá AI demo; khắc phục lỗi UX/accessibility, state inconsistency, navigation hoặc test được chứng minh.
- Bảo đảm UI không khẳng định file được upload thật/AI đã đọc file khi thực tế `demoOnly`; giữ nhãn demo, trạng thái không lưu sau refresh và synthetic citations.
- Gia cố logic hiển thị `answered`, `insufficient_evidence`, `error` hiện có; chú ý số liệu mock/dựng sẵn không được trình bày thành kết quả AI thực.
- Bổ sung Vitest/Playwright regression tests cho flows có sẵn; giữ thiết kế responsive và keyboard navigation.

### Tuyệt đối KHÔNG làm

- KHÔNG kết nối API Auth/Tenant/Document/Chat thật; không tạo React hooks gọi endpoint TO-BE, không đổi demo sang persistent session.
- KHÔNG giả lập chức năng upload OCR/reranking/AI thật; không xây màn mới cho Billing, Notification, personal-document indexing hay realtime.
- KHÔNG chỉnh files `services/**`, `contracts/**`, `infrastructure/**` hoặc `test/**` ở root.
- Không biến demo route-based role thành server-side authorization thực.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `apps/web/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p05-frontend` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Mọi màn demo đã có tiếp tục chạy, vai trò hiện có có đường dẫn đúng.
2. Mọi tương tác với tài liệu cá nhân vẫn minh bạch "chỉ metadata demo"; không nói AI đọc tệp.
3. Không phát sinh request tới backend business ngoài hành vi hiện có.
4. typecheck/build/unit/e2e ghi đúng PASS/FAIL/NOT RUN.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
npm run typecheck --prefix apps/web; npm run build --prefix apps/web; npm test --prefix apps/web -- --run; npm run test:e2e --prefix apps/web (nếu Playwright/browser sẵn)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P06-gateway-prompt-v1.0.md

# PROMPT P06 / v1.0 — Gateway Kong/OPA — củng cố deny-by-default hiện có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P06-gateway`  
**Độ ưu tiên:** `P0-SEC`  
**Người sở hữu:** Thành viên DevOps / Security  
**Vùng sửa code ĐỘC QUYỀN:** `infrastructure/gateway/**`  
**Nhịp tích hợp:** Song song, merge cần security review độc lập  
**Nhánh gợi ý:** `ai/p06-gateway-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Gateway Kong/OPA — củng cố deny-by-default hiện có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

infrastructure/gateway/kong/kong.yml; kong/plugins/opa-authorizer/handler.lua; kong/plugins/opa-authorizer/schema.lua; opa/policies/authz.rego; opa/policies/authz_test.rego; infrastructure/gateway/compose.yaml

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Rà các routes gateway hiện có (identity legacy, tenant, billing, notification) và plugin `opa-authorizer`: bảo toàn chính sách `default deny`.
- Sửa lỗi cấu hình, xử lý timeout/OPA outage để bảo đảm fail-closed; kiểm không forward identity headers do client tự khai thành bằng chứng xác thực.
- Thêm unit/policy tests cho những policy đang có (mặc định deny), kiểm admin Kong bind localhost theo cấu hình hiện tại, port/network không expose secret.
- Cập nhật README Gateway để nêu rõ route khai báo hiện có không đồng nghĩa API backend đã sẵn sàng; nêu mismatch route thay vì tự mở đường mới.

### Tuyệt đối KHÔNG làm

- KHÔNG mở public routes Auth/Document/Chat mới hoặc đổi policy `allow: true`.
- KHÔNG tạo gateway auth plugin, introspection integration, session translation, JWT verifier hay mTLS service mới.
- KHÔNG sửa `infrastructure/sandbox/**`, `services/**` hoặc các config production bên ngoài owner.
- KHÔNG coi client-supplied `x-authenticated-*` hay `X-User-Id` là nguồn đáng tin.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `infrastructure/gateway/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p06-gateway` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. OPA default deny cho request chưa xác thực; OPA timeout/5xx không dẫn đến bypass.
2. Kong admin không được mở công khai theo compose hiện có.
3. Tests policy/plugin (nếu môi trường hỗ trợ) đạt hoặc báo NOT RUN; không khai báo route public mới.
4. Tài liệu chỉ rõ khoảng cách với API thật, không nói gateway E2E hoàn chỉnh.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
Nếu có opa binary: opa test infrastructure/gateway/opa/policies -v; nếu có Docker: docker compose -f infrastructure/gateway/compose.yaml config --quiet (không in config có secret)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P07-shared-prompt-v1.0.md

# PROMPT P07 / v1.0 — Shared packages — hợp đồng kỹ thuật đã triển khai

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P07-shared`  
**Độ ưu tiên:** `P0`  
**Người sở hữu:** Thành viên Core / Contracts  
**Vùng sửa code ĐỘC QUYỀN:** `packages/common/**; packages/http/**; contracts/openapi/common.yaml`  
**Nhịp tích hợp:** CHẠY TRƯỚC các đội backend để giảm thay đổi chung  
**Nhánh gợi ý:** `ai/p07-shared-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Shared packages — hợp đồng kỹ thuật đã triển khai**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

packages/common/src/index.ts; packages/http/src/index.ts; packages/common/test/contracts.test.js; packages/http/test/http.test.js; contracts/openapi/common.yaml

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Rà `ApiResponse<T>` (successful/data/error), format timestamp ISO, `HttpError`, error mapping, HTTP helper và tests của code đã có.
- Sửa bug trong hàm thực sự được xuất và sử dụng; thêm regression tests tương ứng, bảo toàn chữ ký public của package nếu không có quyết định breaking change.
- Kiểm `contracts/openapi/common.yaml` chỉ định nghĩa envelope; chỉnh mô tả cho đúng **existing** shared contract nếu cần, không thêm path.
- Lập bảng lệch giữa envelope chung và response legacy Auth/Tenant/Chat nhưng **chỉ báo cáo**, không sửa controller của service khác.

### Tuyệt đối KHÔNG làm

- KHÔNG sửa `contracts/openapi/chat.yaml`, `document.v1.yaml`, `retrieval-evidence.yaml` hoặc thêm endpoint TO-BE.
- KHÔNG chỉnh bất kỳ `services/**`, `apps/web/**`, `test/**` root, API Gateway.
- KHÔNG thay đổi breaking response envelope/chữ ký API mà chưa được duyệt; nếu cần thì chỉ báo cáo.
- KHÔNG gộp business model hay repository vào shared packages.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `packages/common/**; packages/http/**; contracts/openapi/common.yaml`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p07-shared` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Build/typecheck/tests shared packages chạy hoặc báo chính xác blocker.
2. Thư viện chỉ chứa hạ tầng/chức năng chung đã tồn tại, không chứa dữ liệu domain.
3. Không có API paths mới trong `common.yaml`.
4. Một thay đổi shared có tiêu chí non-breaking và rollback rõ ràng.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
npm run build; npm run typecheck; node --test packages/common/test/contracts.test.js packages/http/test/http.test.js; npm test (nếu môi trường đầy đủ)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P08-sandbox-prompt-v1.0.md

# PROMPT P08 / v1.0 — Sandbox + integration tests — củng cố bằng chứng E2E UPLOAD đã có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P08-sandbox`  
**Độ ưu tiên:** `P1`  
**Người sở hữu:** Thành viên QA / Integration  
**Vùng sửa code ĐỘC QUYỀN:** `infrastructure/sandbox/**; scripts/sandbox.mjs; scripts/sandbox-fixtures.mjs; scripts/sandbox-smoke.mjs; scripts/sandbox-upload-e2e.mjs; test/sandbox-config.test.js; test/platform.integration.ts; test/services.test.js`  
**Nhịp tích hợp:** CHẠY SAU khi P01–P03 ổn định; không đổi code service  
**Nhánh gợi ý:** `ai/p08-sandbox-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Sandbox + integration tests — củng cố bằng chứng E2E UPLOAD đã có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

scripts/sandbox-upload-e2e.mjs; scripts/sandbox-fixtures.mjs; scripts/sandbox-smoke.mjs; infrastructure/sandbox/README.md; test/sandbox-config.test.js; test/platform.integration.ts; docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-review.md (CHỈ ĐỌC)

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Gia cố **các kịch bản test đã có** của Auth/Tenant/Document upload trực tiếp vào `QUEUED` (U1–U7), không sáng tác kết quả test.
- Khắc phục hai thiếu sót review ngày 2026-10-27: U1 cần fixture PDF cấu trúc hợp lệ có text; U6 phải dùng tenant thứ hai **có thật** trong sandbox, kiểm deny cross-tenant bằng course/scope thật, không chỉ `000...` giả.
- Cải thiện phân trang S3 list nếu cần, giới hạn/đọc event Redis theo mốc để bài test chạy lặp đáng tin; không đụng service code.
- Kiểm env sandbox riêng, localhost binding, không lộ credential; chỉ chạy các thao tác reset/stop ảnh hưởng sandbox cô lập sau khi được duyệt rõ.
- Nếu phát hiện lỗi code dịch vụ, tạo report cho P01/P02/P03, không tự sửa chúng.

### Tuyệt đối KHÔNG làm

- KHÔNG thêm ingestion worker, Mongo Document, vector/retrieval, Chat thật vào sandbox.
- KHÔNG đổi mục tiêu E2E thành "document READY"; kết quả chỉ tới `QUEUED`.
- KHÔNG sửa `services/**`, `apps/**`, `packages/**`, `infrastructure/gateway/**`.
- KHÔNG chạm tài nguyên production, volume/secret không thuộc sandbox; không dùng `down -v` hay xóa test data khi chưa có duyệt.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `infrastructure/sandbox/**; scripts/sandbox.mjs; scripts/sandbox-fixtures.mjs; scripts/sandbox-smoke.mjs; scripts/sandbox-upload-e2e.mjs; test/sandbox-config.test.js; test/platform.integration.ts; test/services.test.js`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p08-sandbox` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. U1 sử dụng PDF parser đọc được và có trang/text; phản hồi 202, metadata/S3/Redis khớp.
2. U6 có **hai tenant thật** và kiểm chặn chéo tenant/cross-course một cách đo được.
3. Retry idempotency, unauthorized và dependency unavailable vẫn được xác nhận bằng delta trước/sau.
4. Bằng chứng test nêu môi trường thực chạy, tránh thổi phồng E2E hoàn thiện RAG.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
node --test test/sandbox-config.test.js; npm run test:platform; npm run sandbox:check; npm run sandbox:up && npm run sandbox:fixtures && npm run sandbox:upload-e2e (chỉ khi môi trường test cô lập và được duyệt)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P09-skeletons-prompt-v1.0.md

# PROMPT P09 / v1.0 — Legacy skeletons — chỉ bảo trì health đã có

> **Cách dùng:** copy TOÀN BỘ nội dung file này vào AI được giao. Mặc định AI chỉ chạy `SCOUT`. Sau khi duyệt kết quả, gửi lại file và đổi `GIAI_DOAN` lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`. **COOK cần kế hoạch có `Status: APPROVED`.** Không bắt buộc một AI làm mọi stage; nên nhờ AI độc lập REVIEW.

**Mã nhiệm vụ:** `P09-skeletons`  
**Độ ưu tiên:** `P2-OPTIONAL`  
**Người sở hữu:** Thành viên Platform phụ trách legacy  
**Vùng sửa code ĐỘC QUYỀN:** `services/identity-service/**; services/billing-service/**; services/notification-service/**`  
**Nhịp tích hợp:** Không ưu tiên khi ít nhân lực; chỉ chạy nếu có lỗi health cụ thể  
**Nhánh gợi ý:** `ai/p09-skeletons-r0`

## 0. BỐI CẢNH CỐ ĐỊNH (ĐỌC TRƯỚC KHI LÀM)

Bạn là AI kỹ sư được phân công **MỘT phần việc** trên repo `https://github.com/doandinhlinh25/thanh-tam-tam-linh`. Tài liệu đích là **Thanh Tâm V4 — BRD + SAD hợp nhất** do nhóm cung cấp, thiết kế SaaS đa tenant, microservices, **mỗi microservice có một MongoDB database riêng**. Baseline được khảo sát: `main` tại `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`. **Repo tại thời điểm bạn làm có thể đã đổi**: kiểm tra `git status`, commit hiện tại, remote và mã nguồn THẬT, không mặc định main vẫn ở baseline.

**BẮT BUỘC** đọc `AGENTS.md`, `docs/workflow/README.md`, `docs/development/coding-conventions.md` (nếu liên quan), tài liệu V4 được chủ dự án cung cấp, cùng các mã nguồn và kiểm thử trong phạm vi nhiệm vụ. Nếu chưa được cấp file V4, dùng các nguyên tắc nêu ở prompt này, báo thiếu tài liệu và KHÔNG tự suy diễn nghiệp vụ mới. `AGENTS.md` có vài mô tả cũ rằng frontend chưa có; phải đối chiếu thư mục thực tế `apps/web/`.

### Chỉ sửa cái ĐÃ LÀM — quy tắc bất biến của đợt R0

1. Được **sửa bug hiện có, khắc phục vấn đề bảo mật trên endpoint hiện có khi có phê duyệt, cải thiện tính đúng đắn/khả kiểm thử, refactor nhỏ và thêm regression test cho hành vi đã triển khai**. Không nâng cấp kiến trúc bằng cách tự tạo khả năng chưa tồn tại.
2. **CẤM** triển khai nghiệp vụ mới: Document ingestion worker, PDF extraction, embeddings, vector search, `READY`/publish, retrieval API; Chat history/feedback persistence, API mới; frontend kết nối backend thật; Billing subscription/payment; Notification delivery engine; MongoDB migration của Document hoặc Chat; tạo DB runtime mới; đưa Auth/Document/Chat lên Kong public; bật allow policy OPA; bất kỳ endpoint nào còn ở dạng chỉ-thiết-kế.
3. Giữ nguyên hành vi nghiệp vụ/API hiện có, trừ sửa lỗ hổng/bug đã xác nhận và có kế hoạch phê duyệt. **Không tự đổi PostgreSQL trong Document sang MongoDB**, không biến SQLAlchemy Chat thành Mongo repository trong đợt này, không xóa code dở dang chỉ vì chưa dùng. Không cập nhật OpenAPI dự thảo thành "đã hoàn thành".
4. Không chạm dữ liệu/secret thật; không reset DB, xóa volume, `docker compose down -v`, triển khai, cài dịch vụ trả phí, dùng root MongoDB runtime hoặc biến môi trường production. Tránh xuất nội dung `.env`, cookie, JWT, token ra log/report.
5. **Không sửa file ngoài vùng sở hữu được liệt kê**. Tài liệu workflow (`docs/reports/`, `docs/plans/`, `docs/handoffs/`) được thêm **chỉ với mã nhiệm vụ riêng**, không sửa báo cáo của người khác. Nếu thay đổi cần sửa file chung hoặc service khác, DỪNG và báo điều phối viên. Không force push, không tự commit, push, merge, rebase hay mở PR nếu chủ dự án chưa cho phép.
6. Bảo toàn các thay đổi đang có trong working tree và file chưa track. Làm trên branch/worktree riêng; không ghi đè file đang có của người khác. Phân biệt `AS-IS` (đã chạy), `TO-BE` (thiết kế), `GAP` (chưa triển khai).
7. Điều kiện chất lượng: regression tests phản ánh hành vi thật; kiểm tenant/user scope, lỗi kỹ thuật khác thiếu evidence, idempotency, lỗi dependency theo đúng phạm vi; không tuyên bố “pass” nếu chưa chạy.

### Quy trình bắt buộc — 1 lần gửi prompt = 1 giai đoạn

`GIAI_DOAN = SCOUT` **(mặc định; người giao việc sửa dòng này lần lượt thành `PLAN`, `COOK`, `TEST`, `REVIEW`)**. Không tự chuyển giai đoạn.

- **SCOUT:** chỉ đọc và điều tra: cấu trúc thật, endpoint hiện có, test baseline, 3–6 lỗi/rủi ro đã thấy, các file được phép sửa; xuất báo cáo và dừng. Không sửa code.
- **PLAN:** dựa trên báo cáo SCOUT, viết kế hoạch nhỏ, mỗi bước gắn file owner + tiêu chí nghiệm thu + kiểm thử + rollback, đánh dấu `DRAFT`; dừng chờ chủ dự án ghi **APPROVED**. Không sửa code.
- **COOK:** chỉ khi kế hoạch của mã nhiệm vụ này đã được duyệt; triển khai **chính xác các bước đã duyệt**, trong vùng file được phép; không mở rộng phạm vi. Có thể chạy kiểm tra nhanh, nhưng không tự chuyển sang TEST.
- **TEST:** kiểm tra chức năng và hồi quy theo kế hoạch, chạy lệnh có thể chạy; nếu môi trường không hỗ trợ thì ghi `NOT RUN` kèm lý do; không tuyên bố kết quả giả. Không sửa code sản phẩm trong stage này (chỉ bổ sung/sửa test nếu được duyệt).
- **REVIEW:** chỉ đọc diff và đối chiếu scope, test, bảo mật, hợp đồng, rủi ro; trả `APPROVE` hoặc `REQUEST CHANGES`; không tự merge.

`BRAINSTORM` được chèn giữa SCOUT và PLAN **chỉ khi có nhiều lựa chọn thiết kế đáng cân nhắc**, và cũng là một lượt riêng. Theo `docs/workflow/README.md`, dùng `task-id = YYYY-MM-DD-<slug>` riêng cho nhiệm vụ và ghi reports/handoff/plan theo mẫu của repo. Nếu đang dùng Codex, đọc `.agents/skills/<stage>/SKILL.md` tương ứng.

### Kết quả BẮT BUỘC trả cho chủ dự án

- Mã nhiệm vụ, giai đoạn, branch/worktree, commit nền; file thay đổi và file KHÔNG thay đổi.
- **Đã tồn tại / sửa cái đã tồn tại / phát hiện nhưng để lại / nguy cơ tích hợp / phụ thuộc nhóm khác**.
- Bằng chứng test (lệnh thực chạy, số test, PASS/FAIL/NOT RUN), diff tóm tắt, rollback, đề nghị giai đoạn tiếp theo.
- **Dừng thực hiện** nếu không có quyền sửa, thiếu approved plan, gặp xung đột file, hoặc nhiệm vụ đòi xây chức năng mới.


## 1. NHIỆM VỤ CỦA BẠN

**Legacy skeletons — chỉ bảo trì health đã có**. Đây là đợt **R0 — hardening/refactor cái đã có**, không xây TO-BE mới.

### Điểm bắt đầu để đọc (kiểm tra lại path thực tế)

services/identity-service/index.ts; services/billing-service/index.ts; services/notification-service/index.ts; services/*/routes/health.route.ts (chỉ ba service được giao)

### Những việc ĐƯỢC phép làm (nếu code thực sự có & có lỗi/giá trị đo được)

- Chỉ rà/cải thiện health/live/ready, wiring/response/error của skeleton Express đã tạo; sửa bug có bằng chứng, tests cho hành vi có sẵn.
- Xác nhận `identity-service` là legacy và Auth là nguồn user thực tế, không có hai user store chạy song song.
- Nếu health hoạt động và không có lỗi: **kết luận NO-OP (không cần sửa)** là đầu ra đúng. Ghi backlog riêng cho future.

### Tuyệt đối KHÔNG làm

- KHÔNG thực hiện Billing subscription/payment, Notification email queue, identity provider mới, các collections DB mới.
- KHÔNG sửa Auth/Tenant/document/chat, shared packages hay gateway routes.
- KHÔNG xóa ba service skeleton dù V4 ưu tiên hoãn; xóa/deprecate là quyết định riêng.

### Phạm vi file và xung đột

Vùng sửa code duy nhất: `services/identity-service/**; services/billing-service/**; services/notification-service/**`. Không tự mở rộng whitelist. Các file chung `package.json` gốc, `package-lock.json` gốc, `test/**` gốc (trừ khi được ghi rõ trong whitelist), `contracts/**` (trừ khi được ghi rõ), `docs/architecture/**`, `AGENTS.md`, `.agents/**` do điều phối viên quản lý. Chỉ thêm artifact workflow có tên riêng `p09-skeletons` vào thư mục docs của stage theo quy định repo.

### Acceptance criteria / Definition of Done

1. Chỉ file thuộc ba skeleton bị sửa (nếu có); không mở endpoint nghiệp vụ.
2. Build/health không hồi quy, không route user/tenant mới.
3. Một service không có bug được phép không có thay đổi mã nguồn.

### Lệnh kiểm tra gợi ý (không giả nhận test pass)

```bash
npm run build; npm run typecheck; npm test (báo rõ test nào được chạy)
```

## 2. CÂU LỆNH CHẠY GIAI ĐOẠN

Trong tin nhắn giao việc, chủ dự án cung cấp dòng: `GIAI_DOAN = SCOUT | PLAN | COOK | TEST | REVIEW`. Nếu không có dòng này, **SCOUT**. Chỉ chạy đúng stage đó.

- **SCOUT:** xác minh repo/branch/worktree, lập bảng file và chức năng AS-IS; báo 3–6 điểm sửa được mà **không tạo nghiệp vụ mới**; đề xuất thứ tự, rủi ro, test. Dừng.
- **PLAN:** chỉ lập kế hoạch cho các lỗi đã được duyệt trong SCOUT, ghi mã AC, file, test, rollback và phụ thuộc; dừng chờ `Status: APPROVED`.
- **COOK:** kiểm approved plan, check `git diff`/scope, sửa **các mục approved** và viết regression test có phạm vi; ghi rõ nếu gặp yêu cầu khác service thì dừng. Không commit/push.
- **TEST:** đo độc lập và báo `PASS/FAIL/NOT RUN`; có thể ghi bug report cho owner, không sửa sản phẩm trực tiếp.
- **REVIEW:** đọc diff; tìm scope creep, migration trái phép, hành vi stub bị "giả hoàn tất", lộ secret, regression, broken tests; trả quyết định.

**Yêu cầu cuối:** trả lại bảng `File | Hành vi cũ | Thay đổi | Test | Tình trạng`, danh sách **chưa đụng tới** và đường dẫn artifact. Không được báo "đã chuyển hệ thống sang V4" chỉ vì hoàn tất prompt này.


---

# R0-on-dinh-hien-trang / P10-coordinator-readonly-v1.0.md

# PROMPT P10 / v1.0 — Điều phối và kiểm tra tích hợp (READ-ONLY)

Bạn là AI Tech Lead điều phối các nhánh P01..P09 trên `https://github.com/doandinhlinh25/thanh-tam-tam-linh`; baseline tham chiếu `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`, tài liệu đích Thanh Tâm V4. Mục tiêu **R0: chỉ gia cố code đã có, không xây chức năng mới**. Đọc `AGENTS.md`, `docs/workflow/README.md`, V4 và README bộ prompt.

**PHẠM VI:** READ-ONLY với code (không sửa `services/**`, `apps/**`, `packages/**`, `contracts/**`, `infrastructure/**`, `scripts/**`, `test/**`). Có thể tạo báo cáo review riêng `docs/reports/YYYY-MM-DD/....` nếu chủ dự án cho phép; không sửa plan/report của các AI khác.

**VIỆC CẦN LÀM:** (1) lấy reports/branches/diff của các AI; (2) kiểm ownership, không overlap; (3) kiểm stage SCOUT → PLAN (APPROVED) → COOK → TEST → REVIEW; (4) kiểm code sau merge từng nhánh, chạy kiểm thử tổng; (5) phân loại "đã làm/sửa / chưa làm"; (6) chỉ đề xuất merge, không tự merge nếu chưa được phép; (7) đặc biệt kiểm lỗi spoof header Chat, cross-tenant, test PDF U1/U6, OPA default deny.

**THỨ TỰ:** P07 trước; P01/P02/P03/P04/P05/P06 song song; P09 tùy chọn; P08 sau P01-P03; P10 review sau các đợt tích hợp. Mỗi nhánh một worktree riêng. Một file do một owner chỉnh. Nếu diff vượt whitelist, báo REQUEST CHANGES.

**DỪNG:** không tự tạo MongoDB Document/Chat, worker/retrieval, frontend API, gateway route, Billing/Notification real, production deploy. Không tự commit/push/merge. Đầu ra: bảng owner, branch, SHA, modified files, tests, conflict, blockers, go/no-go và các **task tương lai chưa được phép**.


---

# R1-chuyen-doi-phan-da-lam / M01-mongodb-quyen-db-auth-tenant-prompt-v1.1.md

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


---

# R1-chuyen-doi-phan-da-lam / M02-document-upload-mongo-prompt-v1.1.md

# PROMPT M02 / v1.1 — Chuyển lưu trữ metadata của chức năng upload Document đã có sang MongoDB

**Mã:** `M02-document-upload-mongo`  
**Chủ quyền file:** `services/document-service/**`  
**Nhánh gợi ý:** `ai/m02-document-upload-mongo-r1`  
**Điều kiện:** R0 đã ổn định, các dependency của M02 đã được phê duyệt, không tự bắt đầu COOK.

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

### Phần B — Nhiệm vụ M02: chuyển **upload PDF hiện hữu** từ JPA/PostgreSQL sang MongoDB

**Đây là chuyển đổi công nghệ của một tính năng ĐÃ CÓ**, không làm thêm tính năng khác. Hiện `services/document-service` Java 21/Spring Boot 3.5, endpoint `POST /api/v1/courses/{courseId}/documents` đã dùng Tenant authz → xác nhận MIME/magic PDF → S3 private → metadata/jobs PostgreSQL → Redis Stream → `202/QUEUED`. Tài liệu V4 yêu cầu `tt_document_db` và database-per-service.

**File chủ quyền:** chỉ `services/document-service/**`, gồm mã Java, `pom.xml`, unit tests và tài liệu/migration nằm bên trong service. Không sửa `infrastructure/sandbox/**`, scripts root, `contracts/**`, `services/tenant-service/**` hoặc `services/chat-service/**`. Thay đổi sandbox giao riêng M03 sau khi M02 được review.

**Chỉ được làm các bước (theo PLAN đã phê duyệt):**
- Lập bảng ánh xạ **hiện trạng**: SQL `documents`, `ingestion_jobs` ↔ collections MongoDB `documents`, `ingestion_jobs` trong database do Document sở hữu. Cần duy trì field/ID/JSON output, status `UPLOADED`/`QUEUED`, key uniqueness và indexed queries của upload hiện tại. `outbox` nếu chưa triển khai là **backlog**, không tự làm.
- Dùng Spring Data MongoDB/MongoDB Java driver để thay adapter JPA hiện có; giữ API/public DTO, Tenant authz cookie + service token, private S3, Redis event và idempotency. Không để Document đọc database Auth/Tenant.
- Index unique tương đương `(tenantId,courseId,uploaderUserId,idempotencyKey)` và `(documentId,documentVersion)` của job; chỉ truy vấn trong `tt_document_db`. Metadata checksum SHA-256 và storage key phải bảo toàn.
- Đặc biệt kiểm tra race khi 2 request cùng key, key khác bytes trả 409, duplicate upload chỉ tạo 1 document/job/event; các cửa sổ lỗi khi ghi S3 thành công nhưng DB/Redis thất bại, retry và cleanup; không thêm trạng thái mới nếu chưa phê duyệt.
- Không đoán "transaction xuyên Mongo-S3-Redis": đây không có transaction phân tán; phải tài liệu hóa chiến lược retry/compensation chỉ cho luồng đã có. Mongo transactions chỉ dùng khi thực sự cần và replica set sẵn.
- Giữ phiên bản mã PostgreSQL có thể rollback trong lịch sử Git; lập **kế hoạch** di trú dữ liệu hiện có (mapping ID, chỉ số, checksum S3, kiểm đếm metadata/jobs và rollback), nhưng **không chạy migration production** hay xóa SQL ngay khi chưa có phép. Nếu thay persistence làm đổi kết quả/hợp đồng, dừng để owner duyệt.
- Viết unit/component tests Mongo cho chỉ những hành vi upload hiện có; nếu chưa có Mongo runtime dùng mock/in-memory có cơ sở, không giả E2E.

**CẤM tuyệt đối:** worker, PDF text extraction, OCR, chunks, embeddings, vector search, retrieval, publish/READY/get/delete document, event mới, upload tài liệu cá nhân, email hoặc tích hợp Chat. Không tự sửa openapi/dto public theo mô hình TO-BE chưa hiện thực.

**Acceptance bắt buộc:**
1. Java build + tests đúng môi trường (ghi NOT RUN nếu thiếu). Upload vẫn 202 với người có quyền, 401/403 khi không có quyền; authorization diễn ra trước đọc file theo hành vi cũ.
2. Retry same key+same hash trả cùng document; khác hash trả 409; index unique bảo vệ concurrent requests.
3. Không sửa S3 object key `tenant/course/document/1.pdf`, Redis Stream name `document-ingestion` hay schema event v1 đang hoạt động.
4. Không có kết nối PostgreSQL runtime trong đường upload mới sau khi **được cutover và nghiệm thu**, nhưng mã migration/rollback không bị xóa bừa; test tích hợp môi trường mới giao M03.
5. Mọi collection Document nằm ở 1 DB chỉ Document credential truy cập; không ghi DB khác; có hướng di trú và rollback nhưng không chạy trên dữ liệu thật.

**Phụ thuộc:** R0 P03 hoàn tất và test baseline được chốt; M01 có thể song song; **M03 phải chạy sau** M02. Việc cắt sang DB mới chỉ được triển khai khi M03 pass và chủ dự án phê duyệt.

## Phần C — Lời nhắc đóng nhiệm vụ

Chỉ hoàn thành một giai đoạn, kết luận có bằng chứng, liệt kê cụ thể phần chưa làm và dừng. Không commit/push/merge.


---

# R1-chuyen-doi-phan-da-lam / M03-sandbox-mongodb-document-e2e-prompt-v1.1.md

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


---

# R1-chuyen-doi-phan-da-lam / M04-review-doc-architecture-status-prompt-v1.1.md

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

