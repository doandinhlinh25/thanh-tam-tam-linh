# THANH TÂM — BỘ PROMPT CHO NHIỀU AI / v1.1

**Dùng để:** phân công nhiều AI chỉnh sửa repo **theo tài liệu kiến trúc V4**, nhưng **CHỈ chạm phần đã được hiện thực hóa**. Không sinh tính năng mới từ TO-BE.  
**Repo:** https://github.com/doandinhlinh25/thanh-tam-tam-linh  
**Baseline khảo sát:** `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b` (phải kiểm tra lại trước khi sửa).  
**Mốc tài liệu đích:** `reference/Thanh-Tam-Tai-Lieu-Tong-Hop-BRD-Kien-Truc-V4.md`.

## CHỌN PHIÊN BẢN PROMPT

| Phiên bản/đợt | Ý nghĩa | Cách dùng |
|---|---|---|
| **R0 / v1.0** | Gia cố và kiểm thử chức năng **đang tồn tại** | Đọc `R0-on-dinh-hien-trang/`, chạy P07 trước, P01–P06 song song, P08 sau, P10 review |
| **R1 / v1.1** | Chuyển đổi kỹ thuật của chức năng **đang chạy** sang 1 MongoDB riêng/service | Chỉ mở khi R0 ổn, chạy M01 và M02 trên worktree riêng, M03 sau cả hai, M04 review |
| **R2+ (CHƯA SOẠN PROMPT)** | Worker/retrieval/Chat persistence/Frontend API/billing v.v. | **KHÓA**: không giao AI xây các phần này cho đến khi có yêu cầu riêng |

> **R0 không tự đổi Document từ PostgreSQL sang MongoDB.** R1 M02 là nhiệm vụ riêng, có kế hoạch, phê duyệt và rollback cho **luồng upload đã có**, không phải triển khai các chức năng Document chưa làm.

## 1. Danh sách AI và vùng code

| AI | Tệp prompt | Sở hữu code | Chạy khi nào |
|---|---|---|---|
| 0 | `R0-on-dinh-hien-trang/P07-shared-prompt-v1.0.md` | `packages/common/**`, `packages/http/**`, `contracts/openapi/common.yaml` | **Trước** backend khác |
| 1 | `R0-on-dinh-hien-trang/P01-auth-prompt-v1.0.md` | `services/auth-service/**` | Sau P07, song song P02–P06 |
| 2 | `R0-on-dinh-hien-trang/P02-tenant-prompt-v1.0.md` | `services/tenant-service/**` | Sau P07, song song |
| 3 | `R0-on-dinh-hien-trang/P03-document-prompt-v1.0.md` | `services/document-service/**` | Sau P07, song song |
| 4 | `R0-on-dinh-hien-trang/P04-chat-prompt-v1.0.md` | `services/chat-service/**` | Sau P07; cần security review |
| 5 | `R0-on-dinh-hien-trang/P05-frontend-prompt-v1.0.md` | `apps/web/**` | Sau P07, song song |
| 6 | `R0-on-dinh-hien-trang/P06-gateway-prompt-v1.0.md` | `infrastructure/gateway/**` | Sau P07, song song |
| 7 | `R0-on-dinh-hien-trang/P08-sandbox-prompt-v1.0.md` | `infrastructure/sandbox/**`, script/test E2E root đã liệt kê | **Sau** P01–P03; riêng worktree |
| 8 (tùy chọn) | `R0-on-dinh-hien-trang/P09-skeletons-prompt-v1.0.md` | `identity/billing/notification` skeletons | Chỉ lỗi health có thật; NO-OP là kết quả tốt |
| 9 | `R0-on-dinh-hien-trang/P10-coordinator-readonly-v1.0.md` | Không | Review toàn đợt |
| 10 | `R1-chuyen-doi-phan-da-lam/M01-mongodb-quyen-db-auth-tenant-prompt-v1.1.md` | Sandbox + `scripts/sandbox.mjs` + config test | R0 đã ổn, có duyệt riêng |
| 11 | `R1-chuyen-doi-phan-da-lam/M02-document-upload-mongo-prompt-v1.1.md` | Document Service | R0 đã ổn, song song M01 |
| 12 | `R1-chuyen-doi-phan-da-lam/M03-sandbox-mongodb-document-e2e-prompt-v1.1.md` | Sandbox/scripts E2E | **Sau** M01 & M02, không song song M01 |
| 13 | `R1-chuyen-doi-phan-da-lam/M04-review-doc-architecture-status-prompt-v1.1.md` | Không, chỉ review | Sau M03 |

**Quan trọng:** mỗi AI làm trên branch/worktree riêng. Ownership không overlap **trong cùng một đợt song song**. Đợt R1 được phép đụng các file đã dùng trong R0 vì chạy **SAU** khi R0 đã merge/được duyệt; M01 và M03 không chạy cùng lúc vì cùng sandbox.

## 2. Quy tắc dành cho người điều phối

1. Mọi AI phải đọc `AGENTS.md`, `docs/workflow/README.md`, V4 và file code/test liên quan. `AGENTS.md` cũ có phần nói `apps/web` rỗng; phải ưu tiên cây repo đang có.
2. Mỗi lần gọi chỉ **một stage**: `SCOUT → [BRAINSTORM] → PLAN → COOK → TEST → REVIEW`. Mặc định **SCOUT = chỉ đọc**. Chỉ cho COOK khi owner duyệt plan `Status: APPROVED`.
3. Mỗi AI chỉ được sửa file của mình. Có yêu cầu liên-service → ghi dependency, dừng và báo điều phối viên. Không tự commit/push/merge.
4. Với security (Chat, Auth, gateway) phải có review riêng. Không tin `X-Tenant-Id`, `X-User-Id` do user tự gửi; không mở OPA allow; nếu chưa có auth trusted thì fail-closed, không tạo giả identity.
5. Chỉ chấp nhận test với bằng chứng thực; phân biệt test unit, integration, sandbox, end-to-end. Không bảo rằng "toàn V4 đã có".
6. Không chạy migration dữ liệu production, destructive Docker commands hay quản lý secret thật nếu không có phê duyệt cụ thể.

## 3. Một câu lệnh giao việc mẫu — dán vào AI kèm file prompt tương ứng

```text
Hãy làm đúng một giai đoạn: GIAI_DOAN = SCOUT.
Repo: https://github.com/doandinhlinh25/thanh-tam-tam-linh
Tài liệu kiến trúc đích: reference/Thanh-Tam-Tai-Lieu-Tong-Hop-BRD-Kien-Truc-V4.md
Nhiệm vụ: P03-document (hoặc thay bằng mã AI của bạn).
Đọc toàn bộ file prompt được đính kèm và AGENTS.md.
Chỉ khảo sát phạm vi code đã hiện thực hóa. Không sửa code hoặc viết tính năng chưa làm.
Báo: AS-IS, đối chiếu V4, file whitelist, test, rủi ro, việc KHÔNG đụng.
Dừng sau SCOUT.
```

Khi AI trả SCOUT, người giao việc review rồi gửi một lệnh khác với `GIAI_DOAN = PLAN`; chỉ khi duyệt plan mới cấp `GIAI_DOAN = COOK` + đường dẫn kế hoạch. `TEST` và `REVIEW` cũng tách lượt.

## 4. Khái niệm ĐÃ LÀM và CHƯA LÀM

**Đã làm:** Express Auth login/JWT/CSRF/Mongo; Tenant membership/course/quota/Mongo; Java Document PDF upload/Tenant authz/Postgres/S3/Redis tới QUEUED; Python Chat pipeline + internal LLM bearer; React/Vite demo UI; Kong/OPA default-deny; Node shared contract và sandbox hiện có.

**Chưa làm/đóng băng:** xử lý PDF thành chunks/embeddings; vector search; worker ingestion; document READY/get/delete/retrieval; Chat trust session với Auth/Tenant; persistence conversation/feedback; frontend tích hợp API thật; billing thanh toán; notification; public gateway protected integration.

**Trường hợp đặc biệt:** M02 R1 **được phép chuyển backend lưu trữ cho upload PDF đang chạy từ PostgreSQL sang MongoDB** vì chỉ thay công nghệ thực hiện tính năng hiện có. Đây là một migration có rủi ro: phải có phê duyệt, kế hoạch bảo toàn dữ liệu/rollback và integration test M03. **Không được hiểu M02 cho phép tạo chức năng Document chưa có.**

## 5. Cổng nghiệm thu / thứ tự merge

- R0: P07 REVIEW → P01/P02/P03/P04/P05/P06 (parallel diff riêng) REVIEW → P08 TEST integration → P10 tổng review → owner quyết định merge.
- R1: M01 PLAN+approval và M02 PLAN+approval → sửa trên 2 worktree khác file → REVIEW riêng → tạo nhánh tích hợp đã được owner duyệt → M03 QA → M04 review → owner quyết định cutover DB/merge.
- Không tiến sang R1 nếu baseline test R0 đang thất bại mà chưa được ghi nhận/rà soát.
- Nếu một nhiệm vụ không tìm được lỗi hoặc không cần sửa thì kết quả hợp lệ là **NO-OP**, không ép AI viết code cho đủ số dòng.

## 6. Những gì bộ này KHÔNG làm

Không clone/modify GitHub repo, không tự mở PR, không thay đổi dữ liệu thực; chỉ cung cấp **prompt sẵn dùng** và bản tham chiếu V4. Toàn bộ hành vi sửa repo sau này cần chủ dự án cấp phép và điều phối.
