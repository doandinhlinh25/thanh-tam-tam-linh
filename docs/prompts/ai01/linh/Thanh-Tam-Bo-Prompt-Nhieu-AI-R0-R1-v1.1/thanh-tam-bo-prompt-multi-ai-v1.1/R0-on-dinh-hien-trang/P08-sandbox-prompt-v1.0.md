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
