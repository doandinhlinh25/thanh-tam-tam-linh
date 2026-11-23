# TÀI LIỆU TỔNG HỢP NGHIỆP VỤ & KIẾN TRÚC — THANH TÂM V4

**BRD + SAD hợp nhất | SaaS đa tenant | Microservices | MongoDB Database-per-Service | AI/RAG**

# PHẦN I — BẢN THIẾT KẾ HỢP NHẤT NGHIỆP VỤ & KIẾN TRÚC

## 0.1. Mục đích và cách sử dụng

**Thanh Tâm — Tài liệu thiết kế tổng hợp BRD + SAD, phiên bản 4.0 (đề xuất), ngày 30/10/2026.** Đây là tài liệu duy nhất liên kết **mục tiêu sản phẩm, quy tắc nghiệp vụ, thành phần microservice, mô hình MongoDB và điều kiện nghiệm thu**. Các chương ở Phần II giữ chi tiết nghiệp vụ từ BRD V1.0; Phần III giữ chi tiết kiến trúc V3.0. Phần I tạo cầu nối giữa hai nội dung, ưu tiên làm rõ việc nào đã có trong mã nguồn và việc nào cần phát triển.

**Repository tham chiếu:** `https://github.com/doandinhlinh25/thanh-tam-tam-linh`, nhánh `main`, commit `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b` (đây là baseline thiết kế, không phải phiên bản triển khai V4). **Chưa thay đổi mã nguồn trên GitHub.**

**Phân loại trạng thái:** `[AS-IS]` đã thấy trong code; `[TO-BE]` thiết kế đề xuất; `[MVP]` điều kiện cần trước pilot; `[LATER]` chưa ưu tiên; `[DECISION]` phải được chủ sản phẩm/nhóm duyệt; `[AC]` điều kiện nghiệm thu. Khi hiện trạng và đề xuất mâu thuẫn, phần **quyết định hợp nhất 0.4** là cơ sở thiết kế mục tiêu; không coi tài liệu TO-BE là tính năng đang chạy.

## 0.2. Tuyên bố kiến trúc và mục tiêu kinh doanh

**Định vị:** SaaS B2B/B2B2C cho tổ chức giáo dục; tổ chức vận hành môn học, giảng viên phát hành học liệu, sinh viên hỏi AI có bằng chứng và trích dẫn; người quản trị kiểm soát truy cập, chất lượng học liệu, hạn mức AI. Không coi đây là chatbot kiến thức công cộng.

**Chọn kiến trúc:** microservices theo miền nghiệp vụ + **database-per-service**. Mỗi service có **một MongoDB database sở hữu riêng, tên truy cập DB riêng**, không được đọc/ghi collection của service khác. Cùng một MongoDB replica set/cluster trong MVP được phép, vì ranh giới logic/credential khác ranh giới phần cứng. Document worker chia sẻ database Document vì là tiến trình cùng service; Redis Streams là hàng đợi, S3/MinIO là kho PDF private, không phải business DB thứ bảy.

| Service chủ | MongoDB database | Dữ liệu sở hữu | Vai trò trong sản phẩm |
|---|---|---|---|
| Auth | `tt_auth_db` | Accounts, auth sessions, token, security audit | Đăng nhập và danh tính |
| Tenant | `tt_tenant_db` | Tenants, memberships, courses, enrollments, assignments, quotas | Quyền theo lớp, vòng đời tổ chức |
| Document + worker | `tt_document_db` | Documents, versions, ingestion jobs, chunks, embeddings, outbox | Học liệu, chỉ mục vector, evidence ACL |
| Chat | `tt_chat_db` | Conversations, messages, citations, feedback, inference usage | Hỏi đáp, lưu lịch sử, feedback |
| Billing `[LATER]` | `tt_billing_db` | Subscriptions, invoices, payments | Thương mại hóa khi pilot chứng minh nhu cầu |
| Notification `[LATER]` | `tt_notification_db` | Templates, deliveries, delivery state | Email/thông báo và tác vụ nền |

![Sơ đồ tổng quan từ nghiệp vụ tới các microservices và database](assets/integrated/00-bridged-architecture.pdf)

## 0.3. Ma trận truy vết nghiệp vụ → thực thi kỹ thuật

Cột "Trạng thái" mô tả **khả năng thực thi end-to-end hiện tại**, không phải chỉ việc endpoint xuất hiện trong repository. Các mã `BR-*` và `AC-*` được giải thích trong Phần II.

| Luồng nghiệp vụ và quy tắc | Service và database chủ | API / event chủ đạo | Trạng thái |
|---|---|---|---|
| Đăng nhập, hồ sơ, reset mật khẩu (`BR-SEC-*`) | Auth — `tt_auth_db` | `/admin/account/login`, `/me`, `/internal/auth/introspect` | `[AS-IS]` có Auth backend; UI chưa nối thật |
| Tạo tổ chức, owner, gói/hạn mức (`BR-TEN-*`) | Tenant — `tt_tenant_db` | Tenant admin routes; tenant lifecycle | `[AS-IS]` phần lớn backend; cần hợp đồng công khai |
| Mời user, membership, phân lớp (`BR-MEM-*`) | Tenant — `tt_tenant_db`; Auth xác nhận danh tính | Invitation, assign, enrollment APIs | `[AS-IS]` phần lớn backend; UI demo |
| Tạo, kích hoạt và archive khóa học (`BR-COURSE-*`) | Tenant — `tt_tenant_db` | Course CRUD, authorization check | `[AS-IS]` backend; chính sách lifecycle cần chốt |
| Upload PDF và idempotency (`BR-DOC-01`–`04`) | Document — **TO-BE** `tt_document_db`; hiện tại PostgreSQL | `POST /api/v1/courses/{courseId}/documents`, 202 | `[AS-IS]` upload tới `QUEUED`, **chưa di trú DB** |
| Worker, phiên bản và xuất bản học liệu (`BR-DOC-05`–`09`) | Document + worker — `tt_document_db` | `document.ingest.requested.v1`, publish/unpublish | `[TO-BE]` worker/READY/retrieval chưa hoàn chỉnh |
| Hỏi AI có evidence & trích dẫn (`BR-CHAT-*`) | Chat — `tt_chat_db`; Document retrieval; Tenant ACL | `/api/v1/courses/{courseId}/chat`, internal retrieval | `[TO-BE]` có pipeline nhưng chưa đủ auth/retrieval thật |
| Lịch sử chat, citation snapshot và feedback (`BR-HIS-*`) | Chat — `tt_chat_db` | History và feedback APIs | `[TO-BE]` controller và persistence chưa đủ |
| Giới hạn AI và đo tiêu thụ (Nghiệp vụ H) | Tenant: định mức; Chat: inference usage | `/internal/quota/chat/consume`, usage events | `[AS-IS]` quota backend; cần tích hợp & đối soát |
| Báo cáo câu hỏi chưa đủ bằng chứng (Nghiệp vụ K) | Chat: kết quả; Tenant: phạm vi xem | Aggregated read model / API báo cáo | `[TO-BE]` ưu tiên pilot |
| Billing / gói trả phí (`BR-BILL-*`) | Billing — `tt_billing_db` | Subscription / entitlement event | `[LATER]` định nghĩa contract trước khi kích hoạt |
| Notification (mời, READY, quota) (Nghiệp vụ J) | Notification — `tt_notification_db` | Versioned events; delivery retry | `[LATER]` hoặc adapter gửi tối thiểu cho MVP |

## 0.4. Các quyết định chung cần áp dụng để hai tài liệu không mâu thuẫn

| Chủ đề | Quy tắc hợp nhất cho TO-BE | Lý do và hành động |
|---|---|---|
| Danh tính | Một nguồn danh tính là **Auth**; Tenant chỉ lưu `userId` tham chiếu và role của tenant | Không tạo user/password thứ hai tại identity legacy hoặc Tenant |
| Phân quyền | Tenant là owner quyền tổ chức/môn; Document luôn xác minh course/document ACL trước retrieval; Chat phải xác thực session thật | Chặn vượt quyền qua header giả hoặc prompt |
| Kho dữ liệu | 6 database **logic** độc lập; mỗi DB một runtime principal; Document worker là process, không có DB riêng | Không có shared collection, `$lookup` hoặc transaction xuyên domain |
| PDF gốc | File ở S3/MinIO private; metadata, chunks, embedding ở Document MongoDB | Không nhồi PDF vào database; có idempotency và bù trừ khi lỗi object store |
| Trạng thái tài liệu | **Hai trục:** processing (`UPLOADED/QUEUED/PROCESSING/READY/FAILED`) và publication (`DRAFT/PUBLISHED/UNPUBLISHED/DELETING/DELETED`) | Chỉ retrieval khi **READY + PUBLISHED + version/index active + ACL**; schema 2 trục là thay đổi TO-BE |
| Chat | Chỉ trả `answered` khi citations được kiểm tra từ evidence snapshot; không đủ nguồn là `insufficient_evidence`; lỗi kỹ thuật trả mã lỗi riêng | Không biến timeout/403/503 thành câu trả lời từ chối giả |
| Quota và tiền | Tenant kiểm entitlement & quota; Chat lưu usage/tokens; Billing nếu bật sở hữu invoice/payment | Không ghi đôi số lượt qua retry; thống nhất event `requestId` |
| Tính nhất quán | Transaction **chỉ trong DB service**; qua service dùng HTTP/event, outbox, saga/compensation, idempotency | Không hứa atomic MongoDB–Redis–S3 hoặc giữa hai service |
| Vector Search | MongoDB Vector Search chỉ nằm trong Document DB; **cần kiểm tra cấu hình/search runtime** trước khi pilot | MongoDB replica set cơ bản không mặc nhiên chạy Vector Search |
| Billing/Notification | Có contract và DB riêng nhưng không phải điều kiện hoàn thành RAG MVP | Ưu tiên giá trị đầu tiên, giảm vận hành service rỗng |
| Version và naming | Endpoint đang có được gắn `[AS-IS]`; alias `/api/v1` mới gắn `[TO-BE]`; contract OpenAPI có phiên bản và test | Tránh tài liệu marketing biến thành API giả định đã chạy |

## 0.5. Hành trình nghiệp vụ chuẩn nối với kiến trúc

**Scenario: Trung tâm An Học mở môn Lập trình hướng đối tượng.** Đây là kịch bản giả định dùng làm mẫu kiểm thử.

1. **Onboard tổ chức:** Platform Admin tạo tenant, thêm owner trong một transaction của `tt_tenant_db`; Auth lưu tài khoản trong `tt_auth_db`; việc xác minh người sở hữu diễn ra qua API/service credential, không qua cross-DB query.
2. **Tổ chức lớp:** Tenant lưu `membership`, `course`, `lecturer_assignment`, `enrollment`, kiểm role theo user hiện hành; từ chối tenant bị đình chỉ, học viên chưa ghi danh và giảng viên chưa được phân công.
3. **Giảng viên upload:** Browser gửi cookie session qua Gateway đến Document, Document gọi Tenant kiểm `document:upload`; sau khi được cấp phép mới tiếp nhận và xác minh file PDF; lưu bản gốc private; ghi metadata, `ingestion_jobs` và outbox vào `tt_document_db`.
4. **Ingestion:** Publisher đưa event lên Redis Streams; Document worker nhận xử lý at-least-once, trích trang, chunk, embedding rồi xây index; chỉ sau khi READY và được giảng viên xuất bản thì tài liệu mới sẵn sàng cho Chat.
5. **Sinh viên hỏi:** Chat nhận câu hỏi, xác minh session, Tenant kiểm `chat:ask` và quota; Chat gọi API retrieval của Document; Document áp tenant/course/owner/publication ACL trước vector search.
6. **AI tạo câu trả lời:** Chat kiểm evidence gate; nếu thiếu nguồn thì từ chối hợp lệ không gọi LLM; nếu có nguồn thì dùng LLM và kiểm citations; ghi message/citation snapshot vào `tt_chat_db`.
7. **Vòng phản hồi:** Sinh viên phản hồi; Chat lưu feedback. Giảng viên chỉ nhận số liệu **tổng hợp được cấp quyền**, bổ sung học liệu. Owner đo mức dùng so với gói; không mặc định được đọc hội thoại riêng.

**Không kết nối end-to-end trước khi hoàn tất bước 3–6.** HTTP 202 từ Document chỉ xác nhận upload/queue, không chứng minh một tài liệu đã có thể truy vấn hoặc AI có câu trả lời thật.

## 0.6. Mức ưu tiên triển khai và cổng nghiệm thu

| Gate | Hạng mục phải hoàn thành | Bằng chứng để qua cổng |
|---|---|---|
| **G0 — Security** | Chat xác thực session, Tenant ACL, quyền MongoDB tách biệt; Kong chính xác | Kiểm 401/403; forged tenant/user headers vô hiệu; cross-database credentials deny |
| **G1 — Knowledge** | Document chuyển persistence an toàn sang MongoDB; worker, vector index, publish/unpublish | PDF text hợp lệ trở thành READY; ID/version/index chính xác; delete/unpublish loại trừ ngay khỏi retrieval |
| **G2 — Product MVP** | Frontend thật, chat citation, lịch sử, feedback, quota | Một tenant tạo môn, giảng viên upload, sinh viên hỏi có dẫn nguồn thật; negative tests đủ |
| **G3 — SaaS pilot** | Metrics, logging, dashboard chất lượng, backup/restore, tenancy tests | Pilot 1–2 tổ chức giả lập/được đồng ý; theo dõi chi phí & độ tin cậy; khôi phục từ backup |
| **G4 — Commercial** | Billing / subscription / notification khi cần | Điều khoản, billing ledger, retry/payment reconciliation, entitlement versioned |

**Điều kiện dừng:** Nếu không kiểm soát được truy xuất chéo tenant, mất khả năng từ chối khi thiếu bằng chứng hoặc không phục hồi được dữ liệu, chưa phát hành cho khách hàng trả phí.

## 0.7. Ranh giới trách nhiệm và truy vết kiểm thử

Mỗi yêu cầu phát triển nên mang bộ tham chiếu **Use Case → Business Rule → API/event → Service chủ → Collection/index → Test case → Metric**. Ví dụ: Use Case `UC-CHAT-01` liên kết với `BR-CHAT` và `BR-SEC`; sử dụng Chat, Document và Tenant; lưu `messages` ở Chat, truy xuất `chunks` ở Document; cần contract test, multi-tenant E2E và đo citation validity. Chủ sở hữu domain chịu trách nhiệm lưu dữ liệu, quyền truy cập và tính nhất quán ngay cả khi có Gateway.

Một pull request chỉ được chấp nhận khi (1) có contract version phù hợp; (2) không bổ sung cross-db credential; (3) có test happy path và negative permission; (4) nêu thay đổi migration/index; (5) có rollback/reconciliation cho event/outbox; (6) duy trì hành vi `insufficient_evidence` khác lỗi kỹ thuật.

---

# PHẦN II — LOGIC NGHIỆP VỤ THỰC TẾ (BRD V1.0)

*Nội dung nghiệp vụ đầy đủ, giữ mã quy tắc và tiêu chí nghiệm thu của tài liệu gốc. Cần đối chiếu Phần I mục 0.4 khi áp dụng sang kiến trúc V4.*

## 1. TÓM TẮT QUYẾT ĐỊNH SẢN PHẨM

**Không xây một chatbot chung trả lời mọi chủ đề.** Thanh Tâm là **SaaS trợ giảng dựa trên học liệu do tổ chức kiểm soát**. Giá trị mà khách hàng trả tiền là: giảm câu hỏi lặp lại cho giảng viên, hỗ trợ sinh viên tự học 24/7, câu trả lời có căn cứ kiểm tra được, và quản lý nhiều lớp/giảng viên/sinh viên mà không lộ dữ liệu giữa tổ chức.

**Khách hàng mua (buyer):** trường học, khoa, trung tâm đào tạo, doanh nghiệp đào tạo nội bộ. **Người dùng chính (users):** quản trị tổ chức, giảng viên, sinh viên. **Bên trả tiền (payer):** tổ chức hoặc quản trị tenant; không đồng nhất với người trực tiếp đặt câu hỏi.

**Định vị triển khai ban đầu:** sản phẩm B2B/B2B2C cho trung tâm và khoa nhỏ–vừa, vì chủ tài liệu và quyền lớp học rõ ràng hơn mô hình cộng đồng mở. Nên thử nghiệm với 1–2 tổ chức thí điểm trước khi xây billing tự động.

**Bốn vòng giá trị:** (1) Tạo tổ chức/lớp → (2) Chuẩn bị học liệu có thể tra cứu → (3) Sinh viên hỏi đáp có trích dẫn → (4) Phân tích câu hỏi chưa được trả lời để bổ sung học liệu.

### 1.1. Những việc chủ động KHÔNG làm trong MVP

- Không huấn luyện hoặc fine-tune mô hình LLM riêng cho mỗi tenant.
- Không cho AI tự đưa ra điểm thi chính thức, quyết định kỷ luật, hoặc chứng nhận năng lực.
- Không mở tài liệu của tổ chức khác để làm câu trả lời, dù cùng tên môn học.
- Không dùng tài liệu cá nhân của sinh viên làm tri thức chung của lớp nếu chưa có bước chia sẻ/phê duyệt rõ ràng.
- Không bắt đầu bằng nhiều gói thanh toán, coupon, hóa đơn phức tạp hoặc tích hợp ERP/SIS.
- Không coi UI demo, kết quả unit test, hay một lần upload PDF 202 là bằng chứng MVP hoàn chỉnh.

## 2. VẤN ĐỀ THỰC TẾ, GIẢ THUYẾT VÀ THƯỚC ĐO

| Vấn đề quan sát ở một cơ sở đào tạo | Chức năng giải quyết | Chỉ số để kiểm chứng |
|---|---|---|
| Sinh viên hỏi lặp lại kiến thức đã nằm trong bài giảng | Chat theo môn, câu trả lời gắn nguồn | Tỷ lệ câu hỏi có trích dẫn được người dùng mở kiểm tra |
| Không biết học liệu nào đã đủ để hỗ trợ tự học | Trạng thái tài liệu, báo cáo câu hỏi không đủ bằng chứng | Tỷ lệ câu hỏi bị từ chối theo môn/chủ đề |
| Tài liệu bị phân tán giữa giảng viên và lớp | Kho học liệu theo tenant/course | Tỷ lệ môn có ít nhất một tài liệu `READY` |
| Quản lý nhiều lớp, học viên, vai trò tốn công | Tenant, enrollment, invitation, lecturer assignment | Thời gian tạo tổ chức + môn + phân quyền |
| Sợ lộ tài liệu hoặc dùng AI vượt chi phí | ACL từng cấp, quota, token budget | Số sự cố truy cập chéo tenant (= 0), chi phí/câu hỏi |
| Không biết câu trả lời AI có đúng tài liệu | Citation click-through, đánh giá và phản hồi | Citation validity và phản hồi hữu ích |

**Giả thuyết cần kiểm chứng:** học liệu môn học có chất lượng đủ để RAG mang lại giá trị; người dùng thực sự mở nguồn; giảng viên sẵn lòng bổ sung tài liệu từ các câu hỏi bị từ chối; chi phí suy luận nằm trong ngân sách của một tenant. Không giả định các giả thuyết trên đã đúng.

## 3. KHÁCH HÀNG VÀ KỊCH BẢN TRIỂN KHAI

**Ví dụ minh họa (không phải khách hàng có thật):** Trung tâm An Học có 3 giảng viên, 5 môn học, 250 sinh viên, mỗi môn có 10–30 PDF. Trung tâm tạo tenant `ANHOC`, mời giảng viên, nhập danh sách học viên, giảng viên tải bài giảng, sinh viên hỏi về nội dung đã xuất bản. Cuối tuần trưởng bộ môn xem các câu hỏi bị từ chối để bổ sung một bài giải thích hoặc sửa tài liệu cũ. Quản trị viên xem tổng lượt hỏi và kho lưu trữ nhằm quyết định có nâng gói dịch vụ hay không.

**Điểm tạo doanh thu tiềm năng:** đăng ký thuê bao theo tổ chức với hạn mức người dùng, số môn, dung lượng học liệu và ngân sách AI; gói trả theo mức sử dụng tăng thêm sau khi có dữ liệu chi phí thực. **Không bán dữ liệu câu hỏi hoặc tài liệu của người học.**

![Hành trình nghiệp vụ từ tổ chức đến cải tiến học liệu](assets/business/01-business-journey.pdf)

## 4. VAI TRÒ, DANH TÍNH VÀ PHẠM VI QUYỀN

| Vai trò | Được làm | Không được tự động làm |
|---|---|---|
| `platform_admin` | Quản lý vận hành nền tảng, tình trạng tenant, hỗ trợ có kiểm soát | Đọc tài liệu hoặc chat của mọi tenant mặc định |
| `tenant_owner` | Quản lý tenant, gói sử dụng, phân quyền quản trị, mọi môn trong tenant theo chính sách | Tự động truy cập tenant khác |
| `tenant_admin` | Mời thành viên, cấu hình môn, phân giảng viên, xem số liệu tenant | Xem dữ liệu tenant khác; sửa hóa đơn của Billing |
| `lecturer` | Quản lý nội dung môn được phân công, upload/xóa tài liệu, xem phản hồi tổng hợp | Quản lý môn chưa được phân công; đọc chat riêng của sinh viên mặc định |
| `student` | Xem môn đã ghi danh, hỏi đáp, xem nguồn được phép, gửi feedback | Upload tài liệu chính thức của lớp; xem tài liệu riêng người khác |
| `support_operator` [LATER] | Hỗ trợ kỹ thuật theo phiên ủy quyền có ghi audit | Tự ý giả danh tenant owner hoặc đọc nội dung nhạy cảm |

**Phân biệt:** một tài khoản có thể là giảng viên ở tenant A nhưng sinh viên ở tenant B; `platformRole` là trục nền tảng, `tenantRole` là trục tổ chức, `courseAssignment/enrollment` là trục môn học. Không nhân bản mật khẩu sang Tenant DB.

### 4.1. Ma trận quyền theo hành động

| Hành động | Owner/Admin tenant | Lecturer được phân | Student ghi danh | Khác tenant |
|---|---|---|---|---|
| Tạo, sửa môn | Cho phép theo role | Không mặc định | Không | Từ chối |
| Xem tài liệu môn | Cho phép | Cho phép | Cho phép nếu `PUBLISHED/READY` | Từ chối |
| Upload tài liệu CHÍNH THỨC | Cho phép | Cho phép | Từ chối | Từ chối |
| Xóa/rút xuất bản tài liệu | Cho phép | Cho phép theo chính sách tác giả | Không | Từ chối |
| Hỏi Chat môn | Cho phép nếu được cấp course | Cho phép nếu được cấp course | Cho phép khi enrollment active | Từ chối |
| Xem lịch sử hội thoại | Chỉ hội thoại của mình | Chỉ hội thoại của mình | Chỉ hội thoại của mình | Từ chối |
| Xem thống kê tổng hợp | Cho phép | Chỉ môn được phân | Không | Từ chối |

**[BR-SEC-01]** Mọi quyết định truy cập phải dựa trên user đã xác minh, tenant membership đang active và quyền course hiện hành. Không coi `X-Tenant-Id`, `X-User-Id`, `role` trong request body là bằng chứng.

**[BR-SEC-02]** Quyền đọc tài liệu được kiểm tra **trước retrieval**: không để chunk trái quyền lọt vào tập ứng viên của LLM rồi mới lọc sau.

## 5. MÔ HÌNH DOMAIN VÀ RANH GIỚI DỮ LIỆU

![Các miền nghiệp vụ và database sở hữu](assets/business/02-domain-ownership.pdf)

| Service | MongoDB database riêng | Aggregate/domain sở hữu | Nguồn tham chiếu bên ngoài |
|---|---|---|---|
| `auth-service` | `tt_auth_db` | Account, action token, security event | Không đọc tenant collections |
| `tenant-service` | `tt_tenant_db` | Tenant, membership, invitation, course, enrollment, assignment, quota | `userId` từ Auth; entitlement từ Billing khi kích hoạt |
| `document-service` + worker | `tt_document_db` | Document, version, ingestion job, chunk, embedding, evidence policy, outbox | `tenantId`, `courseId`, `uploaderUserId` dạng logical reference |
| `chat-service` | `tt_chat_db` | Conversation, message, citation snapshot, feedback, request consumption | `tenantId`, `courseId`, `documentId` dạng snapshot/reference |
| `billing-service` [LATER] | `tt_billing_db` | Subscription, plan, invoice, payment, entitlement version | `tenantId` |
| `notification-service` [LATER] | `tt_notification_db` | Template, delivery, preference, retry | `userId`, địa chỉ nhận tối thiểu |

**[BR-DATA-01]** Một service không đọc/ghi collection thuộc database của service khác; không dùng `$lookup` xuyên DB để thay API. DB user `tt_<domain>_app` chỉ có quyền `readWrite` trên DB của mình. Worker Document sử dụng **cùng database của Document**, không tạo DB thứ bảy.

**[BR-DATA-02]** Mỗi record tenant-scoped phải có `tenantId` (và `courseId`/`ownerUserId` khi thích hợp); unique index phải bao gồm tenant scope ở nơi cần. Ngoại lệ: account toàn nền tảng và danh mục public chung do domain rõ ràng sở hữu.

**[BR-DATA-03]** Mỗi DB có backup, migration, audit, index plan riêng. “Sáu DB” không bắt buộc sáu MongoDB server vật lý; giai đoạn đầu có thể đặt cùng replica set nếu ACL bảo đảm.

## 6. NGHIỆP VỤ A — ĐĂNG KÝ, KÍCH HOẠT VÀ QUẢN LÝ TENANT

**Actor:** platform admin (pilot), tenant owner, tenant admin. **Mục tiêu:** trong một phiên thao tác tạo được tổ chức hợp lệ, xác định owner và bắt đầu tạo môn.

**Happy path:** (1) Người đăng ký có account đã xác minh → (2) gửi tên tổ chức, mã, thông tin liên hệ → (3) hệ thống kiểm tra mã trùng và giới hạn theo chính sách → (4) tạo tenant `PENDING_ACTIVATION`/`ACTIVE` tùy cơ chế duyệt → (5) tạo membership `tenant_owner` trong cùng transaction Tenant DB → (6) ghi audit → (7) thông báo kết quả và hiển thị dashboard thiết lập môn.

**Chọn MVP:** admin nền tảng duyệt/tạo tenant thủ công để kiểm soát chất lượng pilot; self-service signup và trial chỉ sau khi đã đo abuse. Có thể tận dụng route quản trị tenant hiện có, nhưng phải làm rõ session và API contract trước khi nối UI.

| Mã quy tắc | Business rule thực thi | Hệ quả khi vi phạm |
|---|---|---|
| BR-TEN-01 | Mã tenant chuẩn hóa, duy nhất toàn nền tảng; tenant bị xóa mềm không được tái dùng tự động | 409 `TENANT_CODE_EXISTS` |
| BR-TEN-02 | Tenant mới phải có ít nhất 1 owner active | Rollback transaction, không tạo tenant mồ côi |
| BR-TEN-03 | Không thể hạ vai trò/thu hồi owner cuối cùng | 409 `LAST_OWNER_REQUIRED` |
| BR-TEN-04 | Tenant `SUSPENDED` chặn upload và chat phát sinh chi phí; cho owner xem trạng thái và hướng dẫn khôi phục | 403 `TENANT_SUSPENDED` |
| BR-TEN-05 | Tenant `DELETING` đóng yêu cầu mới, tạo tác vụ xóa dữ liệu theo chính sách retention | 409 hoặc 423; không xóa cứng ngay |
| BR-TEN-06 | Plan/hạn mức là entitlement phiên bản; thay đổi quota phải có audit | Không tự ý cập nhật không nguồn gốc |

**Ngoại lệ thực tế:** owner quên mật khẩu → Auth reset; tenant trùng tên nhưng khác mã → cho phép theo policy; tạo owner thất bại → rollback tenant; email thông báo thất bại → tenant vẫn hợp lệ, Notification retry; owner đổi email → không đổi userId.

**[AC-A-01]** Tạo tenant thành công có đúng 1 membership owner, database Tenant không có account password; 2 request cùng mã không tạo 2 tenant; owner cuối không bị thu hồi.

## 7. NGHIỆP VỤ B — MỜI NGƯỜI DÙNG, THÀNH VIÊN, PHÂN LỚP

**Actor:** tenant owner/admin; lecturer; student. **Mục tiêu:** một người dùng duy nhất tham gia nhiều tổ chức/môn đúng vai trò và không thấy tài nguyên ngoài phạm vi.

**Quy trình mời:** (1) Admin nhập email, tenant role → (2) tenant-service tạo invitation token ngẫu nhiên, chỉ lưu hash + expiry → (3) thông báo gửi link → (4) người nhận đăng nhập/đăng ký Auth → (5) Tenant xác thực token chưa dùng, email gắn đúng người và còn quota → (6) ghi membership active và đánh dấu lời mời consumed trong transaction → (7) phát sự kiện cập nhật danh sách.

**Chọn MVP:** thêm trực tiếp account đã tồn tại hoặc mời email; import CSV [LATER]. Lecturer phải được **assign** vào course; student phải được **enroll** vào course. Membership của tenant **không tự động** tương đương quyền vào tất cả môn.

| Mã | Quy tắc |
|---|---|
| BR-MEM-01 | Mỗi `(tenantId,userId)` có tối đa một membership active; upsert/retry idempotent. |
| BR-MEM-02 | Lời mời hết hạn hoặc đã chấp nhận không thể dùng lại; không đưa plaintext token vào log. |
| BR-MEM-03 | `student` không thể tự nâng lên `lecturer` qua request. |
| BR-MEM-04 | Thu hồi membership phải vô hiệu khả năng chat/retrieval ngay khi authorization được hỏi lại; không đợi event eventual-consistency. |
| BR-MEM-05 | Enrollment chỉ hợp lệ khi membership active; không cho user chéo tenant ghi danh. |
| BR-MEM-06 | Course archived giữ lịch sử nhưng không cho upload/chat mới, trừ chính sách read-only được phê duyệt. |

**[AC-B-01]** Hai tenant chứa cùng một userId vẫn phân quyền độc lập; lecturer chưa assign course trả 403; sinh viên chưa enroll trả 403; revoke user thì request tiếp theo không thể truy xuất bằng chứng.

## 8. NGHIỆP VỤ C — TẠO MÔN, KHÓA HỌC VÀ CHU KỲ HỌC

**Mô hình đề xuất:** Tenant → Course → Term/Cohort [LATER] → Lecturer Assignment / Enrollment → Official Documents → Chat. Trong MVP `course` tương ứng một lớp/môn có danh sách người học rõ ràng; chưa tách nhiều học kỳ phức tạp.

**Trạng thái course:** `DRAFT` (chuẩn bị) → `ACTIVE` (được sử dụng) → `ARCHIVED` (lưu lịch sử, ngưng chat/upload) hoặc `DELETED` (xóa mềm). Chuyển từ `ARCHIVED` về `ACTIVE` chỉ owner/admin được làm và phải kiểm tra quota.

| Mã | Quy tắc |
|---|---|
| BR-COURSE-01 | `course.code` duy nhất trong từng tenant, không nhất thiết duy nhất toàn nền tảng. |
| BR-COURSE-02 | Mỗi course có `tenantId`; Tenant luôn kiểm tra course và membership cùng tenant. |
| BR-COURSE-03 | Lecturer chỉ quản lý nội dung môn được phân công. |
| BR-COURSE-04 | Student chỉ hỏi AI khi course `ACTIVE`, enrollment `ACTIVE`, tenant `ACTIVE`. |
| BR-COURSE-05 | Xóa mềm course sẽ phát tác vụ thu hồi quyền retrieval tức thì; xóa vật lý tài liệu theo retention sau. |
| BR-COURSE-06 | Chuyển giáo viên giữa môn không làm lộ lịch sử chat riêng tư. |

**[AC-C-01]** Truy vấn courses cho user A trong tenant X không trả môn tenant Y; đổi tenant trong URL mà giữ cookie không vượt qua xác minh.

## 9. NGHIỆP VỤ D — QUẢN LÝ HỌC LIỆU CHÍNH THỨC

**Giá trị:** giảng viên có quyền tải PDF vào course; một file chỉ sử dụng trong hỏi đáp khi đã được trích xuất, lập chỉ mục và xuất bản thành công.

**Chính sách MVP:** chỉ PDF có lớp văn bản, dung lượng cấu hình, bắt buộc xác nhận quyền sử dụng nội dung; không cho sinh viên tải vào thư viện chung; file private ở S3/MinIO, MongoDB chỉ chứa metadata và tri thức đã tách.

**Đề xuất tách hai trục trạng thái:**

- **Processing:** `UPLOADED → QUEUED → PROCESSING → READY` hoặc `FAILED`/`QUARANTINED`.
- **Publication:** `DRAFT → PUBLISHED → UNPUBLISHED → DELETING → DELETED`.

Chỉ khi **processing=READY và publication=PUBLISHED** (cộng version/index active và ACL hợp lệ), document mới được retrieval. Hai trục này ngăn trường hợp file vừa upload đã tự thành tài liệu có thể dùng, trong khi giáo viên chưa phê duyệt.

![Vòng đời tài liệu chính thức và điều kiện dùng cho RAG](assets/business/03-document-lifecycle.pdf)

| Mã | Quy tắc |
|---|---|
| BR-DOC-01 | Upload kiểm session + `document:upload` qua Tenant **trước khi đọc multipart**. |
| BR-DOC-02 | Kiểm extension, MIME, magic `%PDF-`, giới hạn byte và **parser đọc PDF hợp lệ**; có virus scan nếu vận hành public. |
| BR-DOC-03 | `Idempotency-Key` cùng actor/course và cùng bytes trả tài liệu đã tạo; cùng key khác bytes = 409. |
| BR-DOC-04 | Mỗi phiên bản có `checksumSHA256`, `storageKey`, `documentVersion`, `indexVersion`; trạng thái không đi lùi tùy tiện. |
| BR-DOC-05 | Worker at-least-once phải idempotent theo `(documentId,documentVersion,indexVersion)`; retry giới hạn, DLQ khi poison message. |
| BR-DOC-06 | PDF ảnh không có chữ trả mã cần OCR hoặc `PDF_TEXT_NOT_FOUND`; không im lặng tạo index rỗng. |
| BR-DOC-07 | Đổi PDF tạo **version mới**, bản cũ vẫn truy xuất đến khi version mới READY và được kích hoạt nguyên tử. |
| BR-DOC-08 | Unpublish/delete làm tài liệu **biến mất khỏi retrieval ngay**, dọn file/chunks/vector sau bằng job. |
| BR-DOC-09 | Học liệu cá nhân không trở thành OFFICIAL nếu chưa có actor có quyền phê duyệt. |
| BR-DOC-10 | Không dùng file dữ liệu khách hàng để fine-tune provider bên ngoài nếu chưa có hợp đồng và đồng ý phù hợp. |

**Phương án nạp file:** controller tạo metadata `UPLOADED` + outbox, lưu private object, xác minh checksum; publisher đẩy event; worker trích trang, chia chunk, tạo embedding, upsert vector, health-check index, chuyển `READY`. Nếu lỗi lưu object hoặc DB, áp dụng compensation và tác vụ đối soát; **không giả định transaction xuyên MongoDB + S3 + Redis**.

**[AC-D-01]** File bị lỗi cú pháp không thể đến `READY`; upload cùng key không nhân đôi job; xóa file làm retrieval không còn trả chunk từ tài liệu đó trong yêu cầu kế tiếp; có test tải PDF hợp lệ đọc được.

## 10. NGHIỆP VỤ E — THƯ VIỆN TÀI LIỆU CÁ NHÂN

**Trạng thái:** `[LATER]`, trừ khi pilot chứng minh cần và nhóm đã có thời gian xử lý ACL. Sinh viên có thể tải tài liệu của mình lên kho riêng, nhưng dữ liệu đó **chỉ thuộc user**, không thuộc tài liệu chính thức của course.

**Quy tắc:** `ownerUserId` là bắt buộc; `scope=PERSONAL`, chỉ owner xem; có thể gắn course để tổ chức giao diện nhưng không thừa kế quyền chia sẻ từ course; Chat `course_only`, `personal_only`, `combined` phải lọc đúng nguồn. Nếu giảng viên muốn sử dụng tài liệu cá nhân, cần thao tác **đề xuất chia sẻ → xác minh quyền → phê duyệt → tạo bản sao/phiên bản official** với audit, không đổi ACL ngầm.

**[AC-E-01]** Sinh viên S1 không đọc được file cá nhân S2, kể cả biết documentId, kể cả hai người học cùng môn. Lệnh xóa cá nhân xóa quyền truy xuất trước khi xóa vật lý.

## 11. NGHIỆP VỤ F — HỎI ĐÁP AI DỰA TRÊN BẰNG CHỨNG

**Nhiệm vụ:** trả lời đúng phạm vi môn học, có trích dẫn và chịu được tình huống dữ liệu ít, mô hình lỗi hoặc người dùng mất quyền giữa chừng. Đây là **luồng kiếm tiền và tạo giá trị chính**.

**Happy path:**

1. Sinh viên đăng nhập, chọn tenant và course hợp lệ, nhập câu hỏi. Browser gửi `question`, `courseId`, `clientRequestId`, nhưng **không gửi userId/tenantId làm nguồn tin cậy**.
2. Gateway nhận request; Chat xác thực session qua Auth, gọi Tenant để kiểm tra `chat:ask` tại course và trạng thái tenant/course/enrollment.
3. Tenant **reserve quota** theo `requestId` và giới hạn token/cost; nếu không đủ ngân sách trả 429/limit code, không gọi LLM.
4. Chat gọi Document retrieval nội bộ với service credential và trusted actor context; Document **kiểm quyền lại** qua Tenant hoặc authorization token ngắn hạn có audience/action/scope chặt chẽ.
5. Document query các chunk có `tenantId`,`courseId`,`isActive`,`PUBLISHED`,`READY`,`documentVersion` hiện hành; với personal source thêm `ownerUserId`. Chạy vector search trong **tt_document_db**, không ở Chat DB.
6. Chat dùng relevance/evidence gate. Không có bằng chứng hợp lệ thì trả `insufficient_evidence`, không gọi LLM; nếu đủ thì tạo context có hạn mức và gọi provider.
7. Chat xác thực câu trả lời, đối chiếu citation với evidence snapshot server-side. Nếu sai nguồn/không có citation: retry bounded một lần hoặc từ chối có lý do; không dùng citation do LLM bịa ra.
8. Chat lưu conversation, message, verified citations, usage snapshot trong **tt_chat_db** và phát metering event; Tenant `commit/release` quota theo kết quả có ghi nhận thời hạn/idempotency. Client hiển thị answer và liên kết tài liệu + trang tương ứng.

![Luồng hỏi đáp AI có xác thực, quota và bằng chứng](assets/business/04-chat-sequence.pdf)

**Ba loại kết quả khác nhau:** `ANSWERED` (có citation hợp lệ); `INSUFFICIENT_EVIDENCE` (không có bằng chứng, trả câu từ chối, citations rỗng); `TECHNICAL_ERROR` (thiếu quyền, quota, retrieval outage, provider timeout, database, vi phạm SLA). Không đổi lỗi kỹ thuật thành “tài liệu không đủ thông tin”.

| Mã | Quy tắc |
|---|---|
| BR-CHAT-01 | Một câu hỏi chỉ lấy tri thức trong source scope đã được cho phép tại thời điểm truy vấn. |
| BR-CHAT-02 | Kết quả `ANSWERED` phải có ít nhất 1 citation gắn `documentId`, `version`, `pageFrom`, `pageTo`, `evidenceId`. |
| BR-CHAT-03 | Kết quả `INSUFFICIENT_EVIDENCE` không có citation và không gọi LLM nếu evidence gate fail. |
| BR-CHAT-04 | Không tiết lộ tên chunk hoặc nội dung các tài liệu trái quyền trong response, error, debug log hoặc prompt. |
| BR-CHAT-05 | Lịch sử cuộc trò chuyện chỉ owner xem; admin/lecturer chỉ được xem thống kê tổng hợp, không đọc chat riêng mặc định. |
| BR-CHAT-06 | Câu hỏi được gửi lại cùng `clientRequestId` không tạo hai lần tính phí; trả kết quả cũ hoặc trạng thái processing. |
| BR-CHAT-07 | Nếu revoke quyền giữa lúc tạo câu trả lời, trước khi trả citation phải kiểm tra visibility của nguồn một lần nữa hoặc có lease/policy chứng minh an toàn. |
| BR-CHAT-08 | Tài liệu/embedding version phải thống nhất trong một evidence snapshot. |
| BR-CHAT-09 | Dữ liệu retrieval được coi là nội dung không tin cậy đối với prompt injection; không thực thi chỉ thị trong tài liệu. |
| BR-CHAT-10 | Giới hạn độ dài câu hỏi, max output tokens, candidateK, timeout, concurrency theo cấu hình tenant/plan. |

**[AC-F-01]** Kiểm thử 2 tenant thật và 2 sinh viên thật: tenant A không thể lấy câu trả lời trích nguồn tenant B; câu không có evidence không gọi provider; câu có citation giả bị từ chối; provider timeout là lỗi 504/503 có requestId; request retry không trừ quota gấp đôi.

## 12. NGHIỆP VỤ G — LƯU HỘI THOẠI, TRÍCH DẪN, FEEDBACK

**Sử dụng thật:** sinh viên mở lại các phiên học trước, biết câu trả lời nào từng dựa trên bản tài liệu nào; giảng viên nhận thống kê câu hỏi thiếu tài liệu để cải tiến khóa học mà không xâm phạm riêng tư.

**Luồng:** Chat tạo conversation khi câu hỏi đầu tiên được chấp nhận; ghi user message + assistant result + metadata (provider, prompt version, retrieval version, cost, latency, citations). Khi user bấm “hữu ích/không hữu ích”, Chat upsert feedback cho `(userId,messageId)`; nếu có phản hồi “nguồn sai” đánh dấu `needs_review` cho dashboard giảng viên theo thống kê. Không sửa câu trả lời lịch sử bằng nội dung mới của PDF.

**[BR-HIS-01]** Chỉ user sở hữu conversation được đọc/xóa; endpoint dùng owner scope và có thể trả 404 thay vì để lộ ID tồn tại. **[BR-HIS-02]** Xóa conversation là yêu cầu xóa Chat-owned data; các bản audit an toàn, bản sao lưu và legal hold cần retention policy riêng. **[BR-HIS-03]** Citation snapshot lưu ID nguồn/phiên bản/trang tại thời điểm trả lời; click citation vẫn phải kiểm tra quyền đọc hiện tại, nếu đã thu hồi thì hiển thị “nguồn không còn khả dụng”.

**[AC-G-01]** User khác đoán được UUID cuộc chat nhưng không xem được; feedback một người cho cùng message không nhân đôi; tài liệu bị xóa không còn được download từ citation cũ.

## 13. NGHIỆP VỤ H — QUẢN LÝ QUOTA, CHI PHÍ AI, METERING

**Vấn đề kinh doanh:** mỗi lần gọi LLM và embedding phát sinh chi phí biến thiên. Nếu không kiểm tra ngân sách và tính lũy kế, một tenant có thể tạo chi phí vượt mức thanh toán dự kiến.

**Chủ sở hữu phân biệt:** Tenant Service thực thi quota theo tenant/course cho MVP; Chat ghi usage chi tiết của inference; Document ghi usage xử lý/indexing; Billing Service [LATER] là source of truth cho **subscription/entitlement thương mại**, và Tenant nhận projection event có phiên bản để thi hành hạn mức. Không để hai service cùng làm nguồn chân lý của subscription.

**Đề xuất thuật toán:** với mỗi `requestId` gọi `reserve` ngân sách trước khi retrieval/LLM, nhận `reservationId`; hoàn tất sẽ `commit(actualTokens,actualCost)` hoặc `release(reason)` nếu không dùng; TTL và reconciliation dọn reservation treo. Ở MVP có thể khởi đầu đơn giản bằng quota câu hỏi theo ngày đã có trong Tenant, nhưng nên giữ contract có khả năng chuyển sang reserve/commit. Không buộc triển khai distributed transaction.

| Điều kiện | Hành động |
|---|---|
| Đã dùng hết số câu hỏi/ngày | Không gọi retrieval/LLM, trả lỗi quota rõ ràng |
| Đã vượt ngân sách chi phí tenant | Hard stop, thông báo owner; không có khoản phí âm thầm |
| Duplicate requestId + cùng nội dung | Trả lại kết quả cũ/đang xử lý, không charge hai lần |
| Duplicate requestId + nội dung khác | 409 `IDEMPOTENCY_CONFLICT` |
| LLM timeout trước khi nhận usage | Ghi estimate + đối soát theo provider log nếu có, không nhân đôi quota khi retry |
| Ingestion file thất bại | Không đánh dấu vector READY; trừ hoặc hoàn hạn mức xử lý theo chính sách công bố |

**Gợi ý pricing [LATER]:** Trial giới hạn, Standard theo số active learners/courses và AI budget, Enterprise theo hợp đồng. Không chốt giá tiền trước khi đo `gross margin`, `cost per successful grounded answer`, retention. Tránh giới hạn token khó hiểu với giáo viên; hiển thị “lượt hỏi còn lại” và “mức sử dụng tháng”.

![Cơ chế quota và ghi nhận chi phí không tính trùng](assets/business/05-quota-metering.pdf)

## 14. NGHIỆP VỤ I — THANH TOÁN VÀ VÒNG ĐỜI GÓI DỊCH VỤ

**MVP:** quản trị viên nền tảng tạo/cấp plan thủ công, lưu quota trong Tenant theo cấu hình có audit; Billing Service có thể giữ ở trạng thái skeleton. **[LATER]** Khi có khách trả tiền và quy trình thương mại rõ, kích hoạt Billing với database `tt_billing_db` riêng.

**Vòng đời subscription đề xuất:** `TRIAL → ACTIVE → PAST_DUE → SUSPENDED → CANCELED` (một số chuyển trạng thái tùy provider và chính sách). Khi webhook thanh toán đến, Billing phải xác thực chữ ký và idempotency event; ghi payment và subscription trong transaction riêng DB Billing; phát `entitlement.changed.v1`; Tenant cập nhật `effectiveEntitlements` theo `version` tăng dần. Tenant luôn kiểm quyền course/user, Billing không tham gia kiểm ACL từng câu hỏi.

**[BR-BILL-01]** Không gọi provider thanh toán trực tiếp từ trình duyệt với private secret. **[BR-BILL-02]** Webhook có thể đến nhiều lần/lệch thứ tự; dùng external event ID duy nhất và subscription revision. **[BR-BILL-03]** Chuyển `PAST_DUE` cần grace period minh bạch, không tự xóa dữ liệu khách hàng; quá grace thì khóa thao tác tiêu tốn chi phí theo policy. **[BR-BILL-04]** Trả lời hóa đơn, hoàn tiền và dữ liệu pháp lý phải được thiết kế theo nhà cung cấp/quốc gia kinh doanh cụ thể khi chốt tích hợp; tài liệu này chưa chọn payment gateway.

## 15. NGHIỆP VỤ J — THÔNG BÁO VÀ TÁC VỤ NỀN

**MVP:** gửi lời mời/thông báo thủ công hoặc adapter cơ bản; không cho lỗi gửi email làm rollback membership hoặc upload đã commit. **[LATER]** Notification Service sở hữu `tt_notification_db` cho templates, preferences, deliveries, provider receipts, retry log.

**Sự kiện ví dụ:** `tenant.invitation.created.v1`, `document.ready.v1`, `document.failed.v1`, `quota.threshold.reached.v1`, `subscription.past_due.v1`. Notification lấy địa chỉ nhận bằng API có quyền và tránh lưu dữ liệu cá nhân dư thừa. Người dùng opt-out nội dung không bắt buộc; email bảo mật cần bảo đảm được nhận nhưng không lộ token trong log.

## 16. NGHIỆP VỤ K — GIÁO VIÊN QUẢN LÝ CHẤT LƯỢNG TRI THỨC

**Ý tưởng có thể tạo khác biệt:** thay vì chỉ báo số lượt hỏi, dashboard “lỗ hổng học liệu” giúp giảng viên thấy: (a) câu hỏi thường bị từ chối; (b) bài giảng thiếu nội dung; (c) câu trả lời bị đánh giá nguồn sai; (d) tài liệu chưa lập chỉ mục.

**Quy trình cải tiến:** thống kê ẩn danh/giảm nhận dạng câu hỏi theo cụm chủ đề → giảng viên xem các chủ đề bị thiếu → bổ sung hoặc thay bản PDF → công bố phiên bản mới → chạy evaluation dataset cố định → đo mức cải thiện grounded answer rate trước/sau. Không hiển thị nguyên văn câu hỏi riêng tư với định danh cho giảng viên nếu chưa có chính sách minh bạch và cơ sở pháp lý phù hợp.

| Metric | Cách đo đề xuất | Lưu ý |
|---|---|---|
| `grounded_answer_rate` | `ANSWERED` có citation hợp lệ / tổng câu hỏi đã xử lý hợp lệ | Không tính request lỗi 403/5xx vào mẫu số này |
| `insufficient_evidence_rate` | Số `INSUFFICIENT_EVIDENCE` / số câu hỏi đủ quyền | Chỉ phản ánh độ phủ theo query, không phải đúng sai toàn diện |
| `citation_open_rate` | Số click nguồn / số câu trả lời có nguồn | Chỉ đo khi có consent/telemetry phù hợp |
| `helpful_rate` | Feedback tích cực / tổng feedback | Có thiên lệch chọn mẫu |
| `cost_per_answered` | Chi phí provider đã đối soát / số kết quả `ANSWERED` | Phải theo tenant/time window |
| `time_to_ready` | P95 từ upload accepted đến `READY` | Loại trừ file lỗi không thể xử lý và báo riêng |

**[AC-K-01]** Dashboard của lecturer chỉ có aggregate cho các course họ được phân công; không chứa `userId`, nội dung chat riêng của sinh viên theo mặc định.

## 17. LUỒNG CÔNG VIỆC TỔNG HỢP: MỘT LỚP HỌC THỰC TẾ

**Ngày 1 — onboarding:** quản trị nền tảng tạo tenant cho trung tâm An Học; mời owner. Owner tạo môn `DB101`, mời giảng viên và sinh viên; lecturer được assign, sinh viên được enroll. Kiểm tra quyền giữa các môn và tenant bằng tài khoản thử.

**Ngày 2 — chuẩn bị học liệu:** giảng viên tải PDF “Bài 1 — Cơ sở dữ liệu”; hệ thống lưu private, hiển thị `QUEUED`, worker chuyển `READY`; giảng viên xem preview nguồn và bấm `PUBLISH`. Một PDF lỗi chuyển `FAILED`, giáo viên sửa và upload phiên bản khác. Không tự công bố bản lỗi.

**Ngày 3 — tự học:** sinh viên hỏi “Khóa chính khác khóa ngoại thế nào?” Chat kiểm course/quota, retrieval trong bài 1, LLM trả câu có `[1]`; sinh viên bấm nguồn và thấy đúng trang. Câu “Nội dung môn khác?” không có evidence thì trả từ chối, không bịa tài liệu ngoài môn.

**Ngày 7 — cải tiến:** giảng viên xem nhóm câu hỏi “chuẩn hóa 3NF” bị từ chối, bổ sung bài 2, publish; chạy lại câu hỏi kiểm thử; owner xem quota và usage để lựa chọn duy trì gói.

**Người sử dụng nhìn thấy một sản phẩm thống nhất; phía sau các service phối hợp qua API/event và mỗi service chỉ lưu dữ liệu trong DB của mình.**

## 18. HỢP ĐỒNG GIAO TIẾP & EVENT PHỤC VỤ NGHIỆP VỤ

**Quy ước:** public `api/v1` qua Gateway, internal `/internal` chỉ service-to-service có xác thực; dữ liệu client dùng `camelCase` để thống nhất theo API Document/Node, hoặc công bố schema chuyển đổi nhất quán khi dùng Python `snake_case` (cần ra ADR). Shared `ApiResponse` cho business success/failure; lỗi kỹ thuật có HTTP status và `requestId`. Các tên phía dưới là **TO-BE đề xuất**; không khẳng định toàn bộ đã có trong repo.

| API/hành động | Owner | Điều kiện quyền | Tác động nghiệp vụ |
|---|---|---|---|
| `POST /api/v1/tenants` | Tenant | Platform admin / onboarding policy | Tạo tenant + owner |
| `POST /api/v1/tenants/{id}/invitations` | Tenant | Owner/admin | Tạo lời mời (hash token) |
| `POST /api/v1/tenants/{id}/courses` | Tenant | Owner/admin | Tạo course |
| `POST /api/v1/courses/{id}/enrollments` | Tenant | Owner/admin | Ghi danh, kiểm quota |
| `POST /api/v1/courses/{id}/documents` | Document | Lecturer assigned hoặc admin | Nhận file, trả 202 + documentId |
| `GET /api/v1/documents/{id}` | Document | ACL document/course | Xem metadata, trạng thái |
| `POST /api/v1/documents/{id}/publish` | Document | Lecturer/admin có quyền | Cho tài liệu READY vào retrieval |
| `POST /api/v1/courses/{id}/chat` | Chat | Active membership/enrollment, quota | Câu trả lời AI + citations |
| `GET /api/v1/conversations` | Chat | Owner của cuộc chat | Danh sách lịch sử |
| `POST /api/v1/messages/{id}/feedback` | Chat | Owner message | Lưu đánh giá |
| `POST /internal/authorization/check` | Tenant | Service credential + trusted session | Quyết định course/action |
| `POST /internal/retrieval/search` | Document | Chat credential + actor context có thể xác minh | Evidence có filter ACL |

**Event schema tối thiểu:** `eventId`, `eventType`, `eventVersion`, `occurredAt`, `producer`, `tenantId` (nếu scoped), `aggregateId`, `aggregateVersion`, `requestId`, `payload`, `traceId`. Consumer giữ bảng/collection inbox dedupe `(consumer,eventId)`. Sự kiện có PII chỉ chứa ID hoặc metadata tối thiểu; không gửi nguyên câu chat/PDF qua stream.

| Event | Publisher → Consumer | Khi nào / lưu ý |
|---|---|---|
| `tenant.member.revoked.v1` | Tenant → Chat/Document cache invalidation | ACL read path vẫn kiểm hiện trạng, event chỉ để làm mới cache |
| `document.ingest.requested.v1` | Document → Document worker | Job idempotent, không truy cập DB service khác |
| `document.ready.v1` | Document → Notification/analytics | Worker đã xác minh index active |
| `document.unpublished.v1` | Document → Chat/cache invalidation | Retrieval loại ngay theo metadata, sau đó dọn vectors |
| `chat.request.completed.v1` | Chat → usage analytics/Billing [LATER] | Event có requestId chống double-count |
| `entitlement.changed.v1` | Billing [LATER] → Tenant | Consumer áp dụng phiên bản cao hơn, không ghi đè ngược |

## 19. RANH GIỚI TÍNH NHẤT QUÁN VÀ THẤT BẠI

**Cần mạnh (strong consistency) trong cùng DB:** tạo tenant + membership owner; đổi quyền một membership và xóa assignment; ghi quota reservation với idempotency; metadata Document với ingestion outbox; message Chat với citations snapshot. Dùng MongoDB replica set/transaction nơi cần thiết và cùng DB của chủ domain.

**Có thể eventual consistency giữa services:** gửi email, hiển thị usage báo cáo, cập nhật projection entitlement, indexing tài liệu, thống kê dashboard. Không dùng eventual event cache làm cơ chế **duy nhất** để quyết định quyền truy xuất nhạy cảm.

| Sự cố | Hành vi chuẩn |
|---|---|
| Auth tạm không khả dụng | Fail closed cho yêu cầu cần xác thực; không dùng header giả làm fallback |
| Tenant authorization tạm không khả dụng | Chặn upload/retrieval/chat, trả lỗi dependency, không gọi LLM |
| Redis ngắt sau khi lưu Document metadata | Outbox giữ event chưa publish; worker chưa chạy, giao diện hiển thị pending |
| S3 upload thành công nhưng Mongo commit fail | Job reconciliation dọn object mồ côi / retry có kiểm soát |
| Worker crash sau khi tạo một phần chunks | Re-run idempotent theo version/index, chỉ READY sau kiểm tra toàn vẹn |
| Vector index chưa sẵn sàng | Trả retrieval unavailable 503; không tạo answer giả |
| LLM timeout/rate limit | 504/503 hoặc 429 tùy lỗi; giải phóng/đối soát quota, lưu audit |
| Người dùng bị revoke khi đang hỏi | Không trả nguồn còn nhạy cảm; chặn truy xuất theo quyền hiện tại |
| Billing webhook trùng thứ tự | Dedupe eventId, version check, không thay đổi quyền lặp/đảo |

## 20. QUY TẮC BẢO MẬT, RIÊNG TƯ VÀ QUẢN TRỊ DỮ LIỆU

**Security by design:** cookie HttpOnly/Secure/SameSite thích hợp, CSRF cho cookie session, Origin/CORS allowlist, rate limit login/upload/chat; mật khẩu băm; reset token một lần; service credentials độc lập và xoay vòng; TLS; secrets qua secret manager; least privilege cho MongoDB. Internal service token **không phải** bằng chứng actor có quyền — cần actor đã xác thực + domain authorization.

**Data governance:** file PDF ở bucket private, URL tải về phải ngắn hạn và kiểm ACL trước khi cấp; storage encryption; log không có password, JWT, prompt chứa PII, attachment bytes; lưu `requestId` và mã lỗi; chính sách retention riêng cho chat, audit, tài liệu, billing; cơ chế export/xóa tenant và sao lưu/restore diễn tập.

**AI safety:** prompt injection trong PDF không thay đổi chính sách system; evidence whitelist, citation validation; tách provider adapter; không gửi PII không cần thiết; công bố AI có thể sai, khuyến khích người học xem nguồn; không sử dụng chatbot để chấm điểm có hậu quả lớn khi chưa có human review.

**[AC-SEC-01]** Kiểm thử chức năng bằng hai tenant, hai khóa học, ba vai trò, hai tài liệu cá nhân để xác minh IDOR, broken object authorization, revoke; kiểm chứng principal MongoDB của `tt_chat_app` bị MongoDB từ chối đọc `tt_document_db`.

## 21. CÁC CHỈ SỐ SẢN PHẨM VÀ GỢI Ý NGƯỠNG PILOT

| Chỉ tiêu (đề xuất) | Ý nghĩa và cách đánh giá | Chốt khi nào |
|---|---|---|
| Activation | Tỷ lệ tenant có >=1 course active và >=1 tài liệu READY/PUBLISHED | Sau pilot 2–4 tuần |
| First value | Thời gian từ owner nhận lời mời đến câu trả lời grounded đầu tiên | Sau thử nghiệm usability |
| Grounded answer rate | Số `ANSWERED` có citation đúng / câu hỏi đủ điều kiện | Sau khi lập bộ câu hỏi chuẩn |
| Retrieval recall@k | % câu hỏi có chunk đáp án nằm trong k ứng viên | Từ dataset gán nhãn thủ công |
| Citation precision | % citation được xác nhận thật sự hỗ trợ phát biểu | Review human + tự động hỗ trợ |
| Cost / grounded answer | Tổng chi phí LLM + embedding phân bổ / grounded answers | Sau có usage & cost ledger |
| Weekly active learners | Số sinh viên có ít nhất 1 session học hữu ích/tuần | Đo với privacy policy |
| Support burden | Số ticket / 100 tenant-months | Sau hoạt động thương mại |
| Tenant data isolation | Số ca cross-tenant access thành công | **Mục tiêu bắt buộc = 0** |

**Ngưỡng pilot gợi ý (không phải SLA cam kết):** 100% đáp án answered có citation cấu trúc hợp lệ; zero known tenant isolation defect; 95% upload PDF text hợp lệ đi đến READY trong thời gian thử nghiệm cấu hình; chưa chọn p95 latency chính thức nếu chưa đo hệ thống thật.

## 22. USER STORIES VÀ ACCEPTANCE CRITERIA CHI TIẾT

| ID / Ưu tiên | User story | Điều kiện nghiệm thu Given–When–Then |
|---|---|---|
| US-01 / P0 | Là owner, tôi muốn tạo tổ chức | Given account hợp lệ; When tạo tenant; Then có tenant + owner active nguyên tử |
| US-02 / P0 | Là admin, tôi muốn mời giảng viên | Given quyền quản trị; When tạo invite; Then token chỉ dùng một lần, hết hạn |
| US-03 / P0 | Là admin, tôi muốn tạo môn và phân lớp | Given course active; When enroll/assign; Then chỉ đúng user được truy cập |
| US-04 / P0 | Là lecturer, tôi muốn tải PDF | Given course permission; When upload PDF hợp lệ; Then 202, metadata/S3/job một lần |
| US-05 / P0 | Là lecturer, tôi muốn công bố tài liệu | Given document READY; When publish; Then retrieval đọc được đúng version |
| US-06 / P0 | Là student, tôi muốn hỏi AI theo môn | Given enrollment active; When hỏi; Then có answer+citation hoặc refusal đúng loại |
| US-07 / P0 | Là student, tôi muốn mở nguồn gốc | Given citation hợp lệ; When click; Then PDF đúng tài liệu/trang nếu vẫn còn quyền |
| US-08 / P0 | Là student, tôi muốn xem chat cũ | Given cuộc chat của mình; When mở history; Then thấy đúng data; người khác bị từ chối |
| US-09 / P0 | Là owner, tôi muốn giới hạn AI cost | Given quota hết; When hỏi; Then 429 trước LLM, không phát sinh usage mới |
| US-10 / P0 | Là admin, tôi muốn thu hồi thành viên | Given user đang active; When revoke; Then yêu cầu retrieval kế tiếp bị 403 |
| US-11 / P1 | Là lecturer, tôi muốn thấy câu hỏi thiếu nguồn | Given đã có analytics; When xem môn; Then có aggregate không lộ chat cá nhân |
| US-12 / P1 | Là student, tôi muốn gửi feedback | Given answer thuộc về mình; When vote; Then lưu/upsert một feedback |
| US-13 / P2 | Là owner, tôi muốn nâng gói | Given Billing active; When payment success; Then entitlement version được cập nhật |
| US-14 / P2 | Là student, tôi muốn tài liệu cá nhân | Given file cá nhân READY; When hỏi personal_only; Then không lộ cho user khác |

### 22.1. Gherkin cụ thể: cô lập dữ liệu đa tenant

```gherkin
Feature: Tenant isolation during RAG
  Scenario: Student of tenant A cannot retrieve document from tenant B
    Given tenant A and tenant B exist and both are active
    And user UA is an active student enrolled in course CA of tenant A
    And document DB has READY PUBLISHED documents in both tenants
    When UA asks a question in course CA using a forged tenant B header
    Then Chat derives actor and tenant scope from trusted authorization
    And Document retrieval returns candidates only from tenant A course CA
    And no response, citation, log or provider prompt contains tenant B content
```

### 22.2. Gherkin cụ thể: nguồn yếu và lỗi provider

```gherkin
Feature: Evidence-aware answers
  Scenario: No sufficient evidence
    Given a student is authorized for an active course
    And retrieval returns no relevant authorized chunk
    When the student asks a question
    Then result_state is insufficient_evidence
    And citations are empty
    And the LLM provider has not been called

  Scenario: LLM provider times out
    Given retrieval returns sufficient authorized chunks
    When the LLM provider times out
    Then the API returns a technical error with requestId
    And the API does not disguise the timeout as insufficient_evidence
    And quota reservation is released or reconciled
```

### 22.3. Gherkin cụ thể: không xử lý trùng upload

```gherkin
Feature: Idempotent document ingestion
  Scenario: Retry the same PDF
    Given an authorized lecturer uploaded document bytes B using key K
    When the same lecturer uploads B again to the same course using K
    Then the response returns the same documentId
    And only one document version, one job and one object exist

  Scenario: Reuse the key with different bytes
    Given an upload of bytes B with key K was accepted
    When the lecturer uploads bytes C with the same key K
    Then the response is 409 DOCUMENT_IDEMPOTENCY_CONFLICT
    And no new metadata or object is created
```

## 23. ĐỀ XUẤT GIAO DIỆN THEO TÁC VỤ THỰC

| Persona | Màn hình quan trọng | Hành động phải hoàn thành |
|---|---|---|
| Platform admin | Tenant directory, suspension, health/audit | Tạo/kích hoạt tenant; hỗ trợ đúng quyền |
| Tenant owner | Onboarding checklist, Course & Members, Usage & Plan | Cấu hình tổ chức trong một phiên |
| Tenant admin | Invitation center, user/course assignment | Mời và phân lớp không nhầm vai trò |
| Lecturer | Course materials, upload progress, publish, knowledge gaps | Nạp tài liệu đến READY rồi công bố |
| Student | My courses, Chat with citations, history, feedback | Hỏi, mở nguồn, tiếp tục học |

**Tương tác quan trọng:** upload nên thể hiện rõ `uploading/queued/processing/ready/failed` và hướng sửa lỗi; Chat hiển thị **“không tìm thấy bằng chứng”** khác **“dịch vụ tạm lỗi”**; nút “Xem trang nguồn” hoạt động với tài liệu và version chính xác; không dùng dữ liệu demo để mô phỏng kết quả thật mà không có nhãn DEMO.

## 24. LỘ TRÌNH TRIỂN KHAI TỪ MÃ NGUỒN HIỆN TẠI

![Lộ trình sản phẩm và logic nghiệp vụ theo các mốc nghiệm thu](assets/business/06-roadmap.pdf)

| Giai đoạn | Mục tiêu | Deliverables cần chạy thật | Gate để qua giai đoạn |
|---|---|---|---|
| **P0 — Trust & data ownership** | Vá bảo mật và khóa DB riêng | Chat verified session, Tenant authz, Mongo principals, 2-tenant test, gateway route mapping | Không còn đường đi bypass ACL; test unauthorized pass |
| **P1 — Real knowledge** | Học liệu thực dùng được | Document Mongo migration, valid PDF parser, outbox/worker, chunks, embeddings, Vector Search, publish/unpublish | Upload → READY → retrieval có trang, retry và delete đúng |
| **P2 — Real learning MVP** | Sinh viên học bằng AI thật | Frontend API integrations, Chat RAG, citation click, history, feedback, quota, teacher dashboard tối thiểu | End-to-end 2 tenants, evaluation dataset, cost metrics |
| **P3 — SaaS commercialization** | Vận hành trả tiền | Billing DB, payment webhooks, entitlements, notification DB, analytics, tenant lifecycle, backup drills | Audit, idempotency, invoice reconciliation, SLO đo được |

**Không triển khai toàn bộ P0–P3 cùng lúc.** Mỗi PR có migration, contract, test, rollback, documentation. Giữ service và runtime hiện tại nếu không có lý do thay; document-service chuyển từ PostgreSQL sang MongoDB phải có phase migration/dual-read verification và cutover, **không xóa PostgreSQL ngay**.

## 25. BACKLOG PHÂN RÃ CỤ THỂ THEO SERVICE

| Work package | Service | Việc lập trình cụ thể | Test tối thiểu |
|---|---|---|---|
| WP-AUTH-01 | Auth | Session introspection đã xác minh, cookie/CSRF/API standard | Expired, revoked, wrong issuer |
| WP-TEN-01 | Tenant | Tenant onboarding/owner invariant, course authorization | Last owner, foreign tenant, suspended |
| WP-TEN-02 | Tenant | Reserve/commit/release quota idempotent hoặc giai đoạn đầu consume quota | Retry same requestId, over-limit |
| WP-DOC-01 | Document | Mongo repository + schema/index migration từ JPA | Transaction, unique idempotency, data compare |
| WP-DOC-02 | Document worker | Valid PDF extraction, chunking, embedding, outbox | Worker crash/retry, bad PDF, version overlap |
| WP-DOC-03 | Document | Vector Search + ACL filtering, citation metadata | Filter tenant/course/owner/status trước candidate |
| WP-CHAT-01 | Chat | Verified identity; loại client-trusted headers | 401/403, spoofing, session outage |
| WP-CHAT-02 | Chat | Retrieval → evidence gate → LLM → citation snapshot | No evidence, invalid cite, provider failure |
| WP-CHAT-03 | Chat | Mongo repository chat/history/feedback | Ownership, delete, retention |
| WP-WEB-01 | Web | Auth/Course/Documents/Chat API hooks + real loading/error | Browser E2E role & retry |
| WP-PLAT-01 | Platform | Kong/OPA protected route map; traces/metrics | Gateway E2E, no exposed internal routes |
| WP-BILL-01 [LATER] | Billing | Subscription ledger + entitlement events | Webhook duplication/reorder |
| WP-NOTI-01 [LATER] | Notification | Email delivery outbox/retry | Provider outage/no duplicated business op |

## 26. CÁC QUYẾT ĐỊNH NGHIỆP VỤ CẦN OWNER CHỐT

| Quyết định | Đề xuất mặc định | Rủi ro nếu không chốt |
|---|---|---|
| Ai có thể tạo tenant? | Platform admin trong pilot | Abuse/signup không kiểm soát |
| Tài liệu `READY` có tự published không? | **Không**; giảng viên publish sau preview | Lộ file draft hoặc file sai |
| Student được upload official không? | Không | Không kiểm soát học liệu lớp |
| Chat được dùng kiến thức Internet ngoài tài liệu không? | Không ở MVP | Khó giải thích citation và kiểm chứng |
| Lecturer được xem nội dung chat cá nhân không? | Không mặc định; chỉ aggregate | Rủi ro riêng tư người học |
| Course archived có cho đọc không? | Read-only metadata; chat disabled | Chi phí và chính sách không nhất quán |
| Giữ lịch sử Chat bao lâu? | Chọn theo hợp đồng/consent trước khi pilot | Không đáp ứng kỳ vọng xóa dữ liệu |
| AI cost limit hiện như thế nào? | Daily questions + monthly budget guard | Chi phí bị vượt âm thầm |
| Có xây Billing sớm không? | Không; cấp gói thủ công pilot | Phân tán nguồn lực khỏi giá trị cốt lõi |
| Có tính personal document vào MVP? | Không mặc định | Tăng gấp đôi bề mặt ACL và ingestion |
| Có fine-tune reranker ngay không? | Chỉ sau baseline/evaluation | Tốn thời gian trước khi có dữ liệu thực |
| Có dùng một Mongo cluster? | Có cho MVP với 6 DB + principal tách biệt | Hiểu nhầm database-per-service với cluster-per-service |

## 27. RỦI RO CẤP SẢN PHẨM VÀ CÁCH GIẢM THIỂU

| Rủi ro | Mức | Giảm thiểu ưu tiên |
|---|---|---|
| Lộ dữ liệu chéo tenant/course/personal | Critical | Server-trusted identity, authorization trước retrieval, test 2 tenants |
| Hallucination/citation sai | High | Evidence gate, server citation snapshot, human evaluation set |
| PDF lỗi/scanned không có chữ | High | Parser validation, OCR policy, trạng thái rõ ràng, retry/feedback |
| LLM bill shock | High | Hard budget, rate limit, token cap, usage ledger, idempotency |
| Chat/history không bảo vệ owner | High | owner-scoped repository, UUID guessing tests |
| Document Mongo migration mất dữ liệu | High | backup, mapping, dual-read comparison, rollback cutover |
| Sự kiện lặp/khác thứ tự | Medium | Outbox/inbox, dedupe key, monotonic version |
| Thiếu nhu cầu thực, giảng viên không upload | High | Pilot, onboarding hướng dẫn, đo activation/first value |
| Giao diện demo bị hiểu là sản phẩm live | Medium | Disable demo in production và UX trạng thái thật |
| Quá nhiều service quá sớm | Medium | Chỉ bật 4 lõi; Billing/Notification khi có use case được tài trợ |

## 28. KỊCH BẢN DEMO NGHIỆM THU CUỐI CÙNG

**Demo bắt buộc trước khi công bố “MVP thật”:**

1. Tạo 2 tenant A/B; tạo account user cùng tham gia A/B với role khác nhau; hai tenant có course và PDF khác nhau.
2. Owner A mời lecturer A và student A, gán đúng course; outsider và student B bị từ chối.
3. Lecturer A upload PDF text hợp lệ → thấy 202 → QUEUED → PROCESSING → READY → preview → PUBLISH.
4. Student A hỏi một câu có đáp án nằm ở trang xác định; câu trả lời hiển thị citation đúng file/version/trang, click nguồn có ACL.
5. Student A hỏi câu không có trong học liệu: nhận `INSUFFICIENT_EVIDENCE`, provider không bị gọi.
6. Giả mạo header hoặc đổi course/tenant/document ID để lấy B: mọi trường hợp bị chặn, không lộ chunk trong log hoặc LLM request.
7. Thu hồi enrollment student A; câu hỏi mới và truy xuất citation không còn hợp lệ; download nguồn bị chặn.
8. Gửi lại request cùng idempotency key/requestId; tài liệu và quota không bị tính trùng.
9. Provider timeout và Redis/Mongo/S3 outage được mô phỏng; trạng thái lỗi rõ ràng, không tạo answer giả hoặc dữ liệu mồ côi không được đối soát.
10. Owner A mở báo cáo: tài liệu READY, lượt hỏi, lỗi và budget usage trong phạm vi tenant A; không thể thấy tenant B.

**Định nghĩa Done:** pass end-to-end browser + gateway + service + Mongo + S3 + Redis + LLM provider thử nghiệm; có log/correlation/metrics và bằng chứng kết quả; không dùng fixtures UI để thay hệ thống thật.

## 29. PHÂN BIỆT HIỆN TRẠNG VÀ Ý TƯỞNG MỚI

| Thành phần | Hiện trạng [AS-IS] theo commit đối chiếu | Ý tưởng/nghiệp vụ [TO-BE] |
|---|---|---|
| Web | React/Vite demo, không lưu upload thực, chat demo | UI gọi API thật, tenant-aware và citations click-through |
| Auth | Express/Mongoose, cookie JWT `tokenAdmin`, CSRF | Chuẩn hóa hợp đồng, gateway và session downstream |
| Tenant | Express/Mongoose, membership/course/enrollment, quota consume | Onboarding owner invariant, trạng thái tenant, reserve/commit quota |
| Document | Java/Spring Boot dùng PostgreSQL; upload PDF private S3, Redis queue | Mongo DB riêng, worker, index, publish/unpublish, versioned ACL retrieval |
| Chat | FastAPI pipeline nhưng identity header chưa đáng tin; history/feedback chưa đầy đủ | Verified session, Mongo DB riêng, citation snapshot, history, cost reconciliation |
| Billing/Notification | Phần lớn skeleton | Chỉ mở rộng khi có usage/subscription/email thực |
| Gateway | Kong/OPA default deny, route chưa đồng bộ | Toàn bộ public entry thống nhất và internal routes private |

**Bằng chứng hạn chế:** Review E2E trong repo kết luận `REQUEST CHANGES`: fixture PDF upload trước đó không phải PDF đọc được, ca giả mạo tenant thiếu tenant thứ hai thật. Vì vậy không coi những bài test này đã chứng minh toàn bộ sản phẩm an toàn hoặc RAG end-to-end đã chạy.

## 30. KẾT LUẬN VÀ KHUYẾN NGHỊ

**Ưu tiên kinh doanh số 1:** đưa một **môn học thật của một tổ chức thật** từ onboarding đến PDF READY/PUBLISHED rồi hỏi đáp có nguồn và đo mức hữu ích. Chỉ sau khi có hành vi sử dụng thực và dữ liệu chi phí mới triển khai Billing/Notification toàn diện.

**Ưu tiên kỹ thuật số 1:** vá danh tính Chat và tenant/course authorization trước retrieval. **Ưu tiên thứ 2:** Document ingestion và MongoDB Vector Search để có tri thức thật. **Ưu tiên thứ 3:** Chat history, citation/feedback, usage và frontend thật. **Nguyên tắc không đổi:** mỗi microservice một MongoDB database riêng, service credentials riêng; mọi trao đổi chéo domain qua API/event, không dùng shared DB.

**Đầu ra đủ để khởi tạo backlog:** Product Vision, actors, RBAC, state machines, 10 nhóm nghiệp vụ chính, 40+ quy tắc, failure modes, API/event inventory, Gherkin, 14 user stories, 4 giai đoạn và demo nghiệm thu. Nhóm cần phê duyệt các quyết định mục 26 và gán owner/ước lượng trước khi code.

### Phụ lục A — Bảng thuật ngữ

| Thuật ngữ | Giải thích |
|---|---|
| Tenant | Tổ chức khách hàng với phạm vi quyền và dữ liệu riêng |
| Bounded context | Miền nghiệp vụ có ownership và ngôn ngữ riêng |
| Database-per-Service | Mỗi service sở hữu DB, principal và schema riêng |
| RAG | Retrieval Augmented Generation, sinh câu trả lời dựa tài liệu tìm được |
| Evidence | Đoạn tài liệu đã lọc ACL, gắn nguồn/phiên bản/trang |
| Citation snapshot | Bản ghi nguồn được server xác thực tại thời điểm answer |
| Idempotency | Gửi lại cùng yêu cầu mà không tạo tác dụng phụ trùng |
| Outbox/Inbox | Cơ chế gửi/nhận event đáng tin, xử lý duplicate |
| Entitlement | Quyền dùng và giới hạn từ gói dịch vụ |
| AS-IS / TO-BE | Hiện trạng / trạng thái mục tiêu được đề xuất |

### Phụ lục B — Nguồn nội bộ đối chiếu

- `apps/web/README.md` và `apps/web/src/features/student/pages/StudentWorkspace.tsx` — giao diện demo.
- `services/auth-service/app.ts`, `services/auth-service/controllers/admin/account.controller.ts` — Auth và cookie.
- `services/tenant-service/services/course.service.ts`, `services/tenant-service/services/quota.service.ts` — quyền course, quota.
- `services/document-service/README.md`, `services/document-service/database/migrations/001_document_upload.sql` — upload hiện tại.
- `services/chat-service/app/api/controllers/chat_controller.py`, `app/core/security.py` — khoảng trống xác thực.
- `infrastructure/gateway/kong/kong.yml`, `infrastructure/gateway/opa/policies/authz.rego` — gateway hiện tại.
- `docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-review.md` — các giới hạn bằng chứng upload E2E.
- Tài liệu đầu vào V3 trong hội thoại: `Kien-truc-SaaS-V3-Moi-Service-Mot-MongoDB.md`.

**Lưu ý tài liệu:** đây là kế hoạch nghiệp vụ và thiết kế TO-BE; không phải tuyên bố chức năng đã chạy production. Các endpoint, trạng thái, error codes và event chưa có phải được đưa qua ADR/OpenAPI/schema, được phê duyệt và kiểm thử trước khi coi là contract chính thức.

# PHẦN III — KIẾN TRÚC SAAS MICROSERVICES DATABASE-PER-SERVICE (SAD V3.0)

*Thiết kế kỹ thuật chi tiết, các sơ đồ và lộ trình di trú. Đây là TO-BE; trạng thái AS-IS được nêu riêng trong từng chương.*

## 1. Tóm tắt điều hành và kết luận thiết kế

**Chọn 4 service cốt lõi:** `auth-service`, `tenant-service`, `document-service`, `chat-service`. Đối với mã nguồn hiện có, tiếp tục dùng Express/TypeScript cho Auth và Tenant, Spring Boot/Java cho Document, FastAPI/Python cho Chat. **Không viết lại toàn bộ framework chỉ để đổi database.** `billing-service` và `notification-service` được giữ như các service dự kiến, chỉ kích hoạt khi có nghiệp vụ thật; khi kích hoạt phải có database riêng từ đầu. `identity-service` hiện là khung legacy: hợp nhất trách nhiệm xác thực vào Auth, đánh dấu deprecated; không xây thêm một kho user cạnh tranh.

Bốn luồng cần kết nối thành sản phẩm thật: **đăng nhập** → **kiểm quyền theo tenant/course** → **giảng viên tải PDF và worker tạo chỉ mục** → **sinh viên Chat/RAG có trích dẫn và lưu lịch sử**. S3/MinIO lưu file PDF gốc; Redis Streams truyền sự kiện xử lý nền; MongoDB lưu dữ liệu nghiệp vụ, chunks và vector. Tầng Gateway Kong + OPA quản lý entry point; các service nghiệp vụ vẫn phải tự kiểm quyền tại trust boundary.

**Không chuyển ngay toàn bộ Document/PostgreSQL bằng cách thay kết nối DB:** cần chuyển JPA entity, repository, transaction/outbox, chỉ mục và test sang MongoDB; Chat cần bỏ persistence SQLAlchemy hiện là skeleton và thay bằng MongoDB repository. Quy trình này cần vận hành song song và rollback rõ ràng.

### 1.1. Kiến trúc được chọn và không được chọn

| Hạng mục | Chọn ở V3 | Không chọn ở MVP |
|---|---|---|
| Mẫu tích hợp | Microservices theo bounded context, API + events | Shared database, gọi chéo collection |
| Kiểu cách ly service | 1 MongoDB database + principal riêng / service | 1 database chung với prefix collection |
| Kiểu cách ly tenant | Pooled tenant records với `tenantId` & ACL | 1 database / tenant từ ngày đầu |
| Triển khai MongoDB | Replica set/managed cluster, database riêng cho từng service | Tự động 1 cluster vật lý / service khi chưa có nhu cầu |
| RAG vector | MongoDB Vector Search trong `document_db` | Chat truy cập thẳng Document DB; pgvector |
| Xử lý file | S3/MinIO private, ingest worker thuộc Document | Nhét byte PDF vào MongoDB documents |
| Giao tiếp đồng bộ | HTTP nội bộ, service credentials, timeout rõ | Gọi database service khác |
| Bất đồng bộ | Mongo outbox + Redis Streams + idempotent consumers | Phân tán transaction giữa services |
| Frontend | React/Vite tích hợp qua Gateway/BFF nhẹ khi cần | Tái sử dụng demo personas như cơ chế phân quyền |

### 1.2. Bảy điều kiện bất biến

1. Mỗi request tới collection chứa dữ liệu tenant phải có **tenant scope do server xác minh**, không sao chép trực tiếp header `X-Tenant-Id` hoặc `X-User-Id` từ client.
2. Mọi thao tác MongoDB của service chỉ dùng principal của service đó, `readWrite` trên **đúng** một database nghiệp vụ; tài khoản migration/deploy có vòng đời tách biệt.
3. Không dùng `populate`, `$lookup`, transaction hay change stream xuyên database của **hai service khác nhau**, dù MongoDB về mặt kỹ thuật có thể hỗ trợ truy cập xuyên DB với quyền cao.
4. Không dùng ID tham chiếu ngoài như foreign key có tính bảo đảm nguyên tử. Các ID bên ngoài chỉ là **logical reference**; domain owner xác nhận qua API/event.
5. Không truy vấn vector trong `chat_db`. `document-service` là **chủ duy nhất** của chunks, embeddings, vector index và quyền truy xuất bằng chứng.
6. Không trộn `insufficient_evidence` với lỗi kỹ thuật như timeout, 503, thiếu quyền hoặc quota.
7. Không mở public gateway cho Chat/Document khi chưa qua test hai tenant thật, session giả, course ACL, xóa tài liệu và giới hạn chi phí.

## 2. AS-IS: đánh giá hiện trạng so với đích

| Thành phần | AS-IS (đã kiểm tra từ repository) | Khoảng cách đến V3 |
|---|---|---|
| `auth-service` | Express, Mongoose, `tokenAdmin` HttpOnly, JWT/CSRF, Mongo URI | Khóa chặt role một DB, gateway và chuẩn session; giữ code |
| `tenant-service` | Express/Mongoose, tenant/member/course/enrollment/quota, Mongo URI riêng trong sandbox | Rà quyền course, kiểm thử 2 tenant, event khi phân quyền thay đổi |
| `document-service` | Java 21/Spring Boot, PostgreSQL JPA, private S3, Redis Stream; upload trả 202 | **Phải đổi persistence** sang `document_db`, worker, chunks, vector, outbox |
| `chat-service` | FastAPI + RAG pipeline; Python SQLAlchemy dependencies/skeleton | **Phải đổi persistence** sang `chat_db`, xác thực thật, quota/history/feedback |
| `billing-service` | Service nền tảng/health chủ yếu | Chỉ kích hoạt cùng `billing_db` khi có nghiệp vụ |
| `notification-service` | Service nền tảng/health chủ yếu | Chỉ kích hoạt cùng `notification_db` khi có nghiệp vụ |
| `identity-service` | Khung service legacy song song với Auth | Deprecate, không tạo danh tính thứ hai |
| Frontend | React/Vite, dữ liệu mock, không gọi API thật | Tích hợp gateway và generated client |
| Kong + OPA | OPA default deny, route Kong chưa khớp API Auth/Document/Chat | Lập route inventory và chính sách theo endpoint thật |
| Sandbox | Mongo replica set cho Auth/Tenant, PostgreSQL cho Document, Redis, MinIO | Thêm `document_db`, `chat_db`, principals, môi trường vector search |

**Rủi ro AS-IS phải xử lý P0:** `chat_controller.py` lấy tenant/user từ header của request và có fallback giả; `app/core/security.py` chứa `NotImplementedError`. Đây là chỗ cần vá trước khi nối frontend vào Chat. Các ca upload E2E trước đây chỉ chứng minh upload đến `QUEUED`; review trong repository ghi **REQUEST CHANGES** do PDF fixture không đọc được và bài giả mạo chéo tenant thiếu tenant thứ hai thực sự. Không coi kết quả ấy là production-ready.

![Sơ đồ AS-IS và điểm cần chuyển đổi](assets/architecture/01-as-is.pdf)

## 3. TO-BE: sơ đồ tổng thể microservices

![TO-BE — Sáu service, sáu database độc lập](assets/architecture/02-target-six-databases.pdf)

### 3.1. Đường đi yêu cầu

- Browser/React → HTTPS → **Kong** (rate limit, route, correlation) → Auth/Tenant/Document/Chat. OPA hỗ trợ quyết định quyền ở edge với ngữ cảnh đáng tin; không thay thế kiểm quyền domain.
- `tenant-service` tra cứu phiên qua `auth-service` và quản lý tenant/course roles. `document-service`, `chat-service` dùng endpoint authorization nội bộ của Tenant, không kết nối MongoDB của Tenant.
- Document upload → S3 private + `document_db` metadata/outbox → Redis Streams → Document worker → chunks/embeddings trong **cùng** `document_db` → index vector.
- Chat → Tenant course authorization/quota → Document retrieval HTTP nội bộ → evidence gate / optional reranker → LLM → citation verification → `chat_db`.
- Billing/Notification được tiêu thụ thông qua API/event, không đọc `tenant_db` hoặc `auth_db` trực tiếp.

### 3.2. Quy tắc 1 service : 1 database (không nhập nhằng)

| Service nghiệp vụ | MongoDB database duy nhất | Principal chỉ được cấp trên DB đó | Chủ sở hữu dữ liệu |
|---|---|---|---|
| Auth | `tt_auth_db` | `tt_auth_app` | User, credential, session/authVersion, action tokens |
| Tenant | `tt_tenant_db` | `tt_tenant_app` | Tenant, member, course, enrollment, quota |
| Document | `tt_document_db` | `tt_document_app` | Document metadata, ingestion, chunks, vectors, evidence |
| Chat | `tt_chat_db` | `tt_chat_app` | Conversation, messages, citations snapshot, feedback |
| Billing (khi kích hoạt) | `tt_billing_db` | `tt_billing_app` | Plan, subscription, invoices, payments, usage ledger |
| Notification (khi kích hoạt) | `tt_notification_db` | `tt_notification_app` | Templates, deliveries, preferences, retry/receipts |

Các principal có thể xác thực qua `authSource` bằng database tương ứng; dùng mật khẩu/secret khác nhau. Tạo database thực bằng migration/seed có quyền, không cho ứng dụng dùng tài khoản `root`. Không gán `readAnyDatabase`, `readWriteAnyDatabase`, `dbOwner` hoặc quyền admin cho app runtime. Nếu dùng Atlas, quản lý database user theo console/API của Atlas thay vì chạy `db.createUser` trực tiếp.

**Quy tắc độc lập vật lý:** trong MVP, `tt_*_db` cùng cluster là đủ để thực thi ranh giới logic/ủy quyền. Khi một service cần SLO, backup, lưu trú dữ liệu hoặc tài nguyên khác biệt, chỉ chuyển **database của service đó** sang cluster khác mà không đổi contract. Cùng cluster vẫn có nguy cơ cạnh tranh CPU/IO, chi phí, lỗi hạ tầng chung; không tuyên bố đây là cách ly vật lý hoàn toàn.

![Ranh giới database và credentials](assets/architecture/03-data-ownership.pdf)

## 4. Phân rã trách nhiệm và quy tắc sở hữu

### 4.1. Auth Service — danh tính duy nhất

**Sở hữu:** account, mật khẩu băm, trạng thái account, refresh/revoke session policy, reset token, audit đăng nhập. **Không sở hữu:** tenant role, course assignment, subscription. Giao diện đề xuất: `/api/v1/auth/login`, `/me`, `/logout`, `/csrf` (giữ alias legacy `/admin/account/*` trong thời gian chuyển đổi); `/internal/auth/introspect` chỉ qua mạng nội bộ. Session cookie `tokenAdmin` là thực tế hiện tại: chỉ đổi tên theo ADR, không tự ý dùng placeholder `saas_session` trong frontend.

`tenant-service` chỉ giữ `userId` là reference; nếu cần email/name hiển thị thì đồng bộ projection từ event versioned (chấp nhận eventual consistency), không query Auth DB.

### 4.2. Tenant Service — authorization và tổ chức

**Sở hữu:** tenant, membership, course, lecturer assignment, student enrollment, quota definitions, quota consumption. **Không sở hữu:** nội dung PDF, text chunk, hội thoại. Là nơi đánh giá quyền chuẩn theo `tenantId + userId + courseId + action`. API nội bộ hiện có gồm `/internal/authorization/course`, `/internal/authorization/check`, `/internal/quota/chat/consume`; thay đổi schema phải qua contract tests. Platform admin được quản lý lifecycle tenant nhưng **không mặc nhiên** được đọc nội dung course.

### 4.3. Document Service — tài liệu và vector

**Sở hữu:** metadata, idempotency, upload state, ingestion jobs, outbox, chunked text, vector index và retrieval ACL. Ingestion worker là **một deployment process** thuộc Document Service, tái sử dụng `tt_document_db` và secret được cấp cho Document; đây không phải một service nghiệp vụ độc lập có database riêng. Thao tác S3 phải được phối hợp bằng trạng thái/outbox/compensation, không hứa atomic với MongoDB.

### 4.4. Chat Service — trải nghiệm hỏi đáp

**Sở hữu:** conversation, messages, citation snapshots, feedback, pipeline version, LLM usage đã phát sinh. **Không lưu** bản sao đầy đủ chunks hoặc vector, không dùng MongoDB driver kết nối `tt_document_db`. Chỉ nhận evidence qua API của Document; citation lưu snapshot tối thiểu để giữ tính giải thích tại thời điểm trả lời và hỗ trợ xử lý khi tài liệu bị xóa/thu hồi quyền.

### 4.5. Billing và Notification — tùy chọn, nhưng DB riêng

Billing chỉ có quyền ghi kế toán/usage ledger của chính nó. Dữ liệu usage được nhận qua events/metering API, không đọc `tenant_db`. Notification dùng event `invitation.created`, `document.ready`, `subscription.changed`; lưu delivery state trong database riêng. **Chưa nên bật các service** này trước khi luồng học liệu + chat hoạt động.

### 4.6. Identity Service legacy

`identity-service` cũ có skeleton nhưng Auth Service đã là nguồn xác thực thực tế. **Phương án:** giữ code tại repo để dễ chuyển tiếp, không route traffic mới; sau khi kiểm tra không còn client phụ thuộc, deprecate/xóa bằng PR riêng. Nếu nhóm quyết định khôi phục thành service nghiệp vụ độc lập, nó phải được cấp database riêng, loại bỏ account ownership khỏi Auth và có kế hoạch di trú rõ ràng; tuyệt đối không duy trì hai nguồn user.

## 5. Thiết kế collection: tt_auth_db

| Collection | Nội dung/chỉ trường tiêu biểu | Chỉ mục hoặc tính toàn vẹn |
|---|---|---|
| `accounts` | `_id`, `emailNormalized`, `passwordHash`, `status`, `platformRole`, `authVersion`, `deletedAt` | `emailNormalized` unique có lọc phù hợp account active |
| `action_tokens` | `userId`, `tokenHash`, `purpose`, `expiresAt`, `consumedAt` | `tokenHash` unique; TTL `expiresAt`; token dùng một lần |
| `rate_limits` | `key`, `count`, `expiresAt` | unique `key`, TTL `expiresAt` |
| `auth_audit` | `actorUserId`, `action`, `requestId`, `occurredAt`, `ipHash` | `actorUserId + occurredAt` |
| `outbox_events` | `eventId`, `type`, `aggregateId`, `version`, `payload`, `publishedAt` | `eventId` unique, index `publishedAt + occurredAt` |

Nên duy trì tên collection hiện hành của Auth nếu tránh migration không cần thiết; bảng trên mô tả schema đích và cần map với `accounts-admin` của mã nguồn. Không log cookie/token/raw password; chỉ lưu token hash cho reset/action token. Khi user bị vô hiệu hóa, Auth phát event idempotent; Tenant xử lý revoke membership theo business rule.

## 6. Thiết kế collection: tt_tenant_db

| Collection | Trường quan trọng | Chỉ mục/ranh giới |
|---|---|---|
| `tenants` | `_id`, `code`, `status`, `plan`, `quotas`, `revision` | `code` unique, soft-delete strategy |
| `tenant_memberships` | `tenantId`, `userId`, `role`, `status` | unique `(tenantId, userId)` |
| `tenant_invitations` | `tenantId`, `email`, `tokenHash`, `expiresAt`, `status` | index TTL/partial theo chính sách; unique tokenHash |
| `courses` | `tenantId`, `code`, `name`, `status`, `deletedAt` | unique `(tenantId, code)` |
| `course_enrollments` | `tenantId`, `courseId`, `userId`, `status` | unique `(courseId,userId)` và index tenant |
| `lecturer_assignments` | `tenantId`, `courseId`, `userId` | unique `(courseId,userId)` |
| `daily_usage` | `tenantId`, `dateUTC`, `chatCount` | unique `(tenantId,dateUTC)` |
| `quota_requests` | `tenantId`, `requestId`, `userId`, `courseId` | unique `(tenantId,requestId)`; retry không trừ hai lần |
| `outbox_events` | `eventId`, `type`, `tenantId`, `aggregateVersion`, `payload` | eventId unique |

Nội bộ một DB, `CourseService.canAccessCourse` dùng membership + assignment/enrollment trong cùng service. `chat-service` không query những collections này, kể cả khi cluster vật lý giống nhau. Hành động `document:read`, `document:upload`, `chat:ask`, `course:read`, `feedback:write` phải được kiểm với vai trò và trạng thái tenant/course.

## 7. Thiết kế collection: tt_document_db

| Collection | Trường tiêu biểu | Index/ghi chú |
|---|---|---|
| `documents` | `_id`, `tenantId`, `courseId`, `ownerUserId`, `accessScope`, `status`, `version`, `storageKey`, `checksum`, `idempotencyKey` | unique `(tenantId,courseId,ownerUserId,idempotencyKey)`; index `(tenantId,courseId,status)` |
| `document_versions` | `documentId`, `version`, `storageKey`, `pageCount`, `parserVersion`, `indexVersion` | unique `(documentId,version)` |
| `ingestion_jobs` | `jobId`, `documentId`, `version`, `status`, `attemptCount`, `nextRetryAt`, `leaseUntil` | unique `(documentId,version)`; job state index |
| `chunks` | `tenantId`, `courseId`, `documentId`, `documentVersion`, `chunkIndex`, `pageFrom`, `pageTo`, `text`, `vector`, `embeddingModel`, `indexVersion`, `status`, `accessScope`, `ownerUserId` | unique `(documentId,documentVersion,chunkIndex,indexVersion)`; vector-search index với prefilter |
| `outbox_events` | `eventId`, `aggregateId`, `eventType`, `payload`, `createdAt`, `publishedAt`, `attempts` | eventId unique; publisher scan index |
| `document_access_grants` (nếu cần) | `tenantId`, `documentId`, `granteeUserId`, `scope` | unique `(documentId,granteeUserId)` |

**Không sao chép thành một collection “Document records” trong Tenant DB.** Các bản ghi document dùng `tenantId/courseId` là foreign logical IDs, không có foreign key xuyên database. Quota storage do Tenant quyết định, nhưng Document lưu byte size chính xác và phát `document.uploaded`/`document.deleted` để metering; cần reconciliation nếu event bị trễ.

**Giới hạn document BSON:** chunks nên nhỏ có kiểm soát (ví dụ 400–1.000 token/chunk là *khoảng để thử nghiệm*, không phải kết quả tối ưu), không để một document MongoDB vượt giới hạn BSON; embedding nằm trong chunk record hoặc collection embeddings riêng **vẫn cùng `tt_document_db`**, tùy benchmark. Kho S3 lưu PDF gốc, không lưu PDF như binary trong collection. Với personal documents, bắt buộc `ownerUserId` và `scope=PERSONAL`, không ghép dữ liệu học viên khác vào retrieval.

## 8. Thiết kế collection: tt_chat_db

| Collection | Trường tiêu biểu | Chỉ mục/giới hạn |
|---|---|---|
| `conversations` | `_id`, `tenantId`, `ownerUserId`, `courseId`, `title`, `lastMessageAt`, `status` | `(tenantId,ownerUserId,lastMessageAt)` |
| `messages` | `_id`, `tenantId`, `ownerUserId`, `conversationId`, `role`, `content`, `resultState`, `requestId`, `createdAt` | `(tenantId,conversationId,createdAt)`; unique requestId scope phù hợp |
| `citation_snapshots` | `messageId`, `tenantId`, `evidenceId`, `documentId`, `documentVersion`, `pageFrom`, `pageTo`, `snippet`, `sourceType` | `(tenantId,messageId)`; dữ liệu minimal và retention |
| `feedback` | `tenantId`, `messageId`, `userId`, `rating`, `comment`, `createdAt` | unique `(tenantId,messageId,userId)` |
| `model_usage` | `tenantId`, `requestId`, `model`, `inputTokens`, `outputTokens`, `costEstimate`, `createdAt` | unique `(tenantId,requestId)` |
| `outbox_events` | `eventId`, `type`, `tenantId`, `payload`, `publishedAt` | eventId unique |

Conversation lookup luôn giới hạn **tenantId + ownerUserId**, trả 404 khi không thấy hoặc không có quyền. Feedback chỉ dành cho message mà user được phép xem. Không lưu API key, prompt hệ thống chứa bí mật hoặc toàn bộ nội dung PDF trong Chat DB. TTL/retention phải dựa trên chính sách dữ liệu đã phê duyệt, không đặt TTL bừa cho records cần audit.

## 9. Thiết kế collection: billing_db và notification_db

| Service | Collection gợi ý khi kích hoạt | Nguyên tắc |
|---|---|---|
| Billing | `subscriptions`, `plans`, `invoices`, `payment_attempts`, `usage_ledger`, `outbox_events` | Webhook signature + dedup, ledger bất biến; không lưu PAN/CVV thẻ |
| Notification | `templates`, `notification_preferences`, `deliveries`, `delivery_attempts`, `outbox_events` | Dedupe theo eventId/template/channel; retry và dead-letter |

Billing là nguồn sự thật subscription/payment; Tenant chỉ nhận projection `tenant.plan.changed` và thực thi quota. Khi chưa có billing thực, Tenant quản lý plan/quota cấu hình thủ công, không cần kích hoạt `billing_db` lúc chạy MVP.

## 10. Kết nối MongoDB, quyền hạn và cấu hình hạ tầng

### 10.1. Quy ước URIs và phân quyền theo DB

Ví dụ dành cho MongoDB Community/self-managed trong **môi trường dev**, không nhúng mật khẩu thật vào repository. Tạo user trên chính DB đích, với `readWrite` chỉ trên một DB. Với managed MongoDB Atlas, dùng database access management của Atlas. Lệnh dưới đây **không** chạy bằng tài khoản ứng dụng.

```javascript
// Chạy dưới tài khoản provisioning có quyền createUser; không đưa vào image app.
const services = [
  ["tt_auth_db", "tt_auth_app"],
  ["tt_tenant_db", "tt_tenant_app"],
  ["tt_document_db", "tt_document_app"],
  ["tt_chat_db", "tt_chat_app"],
  ["tt_billing_db", "tt_billing_app"],
  ["tt_notification_db", "tt_notification_app"]
];
// Mỗi user phải có mật khẩu khác nhau từ secret manager.
// Lặp cho từng service (minh họa một DB):
const target = db.getSiblingDB("tt_document_db");
target.createUser({
  user: "tt_document_app", pwd: passwordPrompt(),
  roles: [{ role: "readWrite", db: "tt_document_db" }]
});
```

**Runtime URI theo service:**

```dotenv
# Không commit mật khẩu; các ${...} sau là ký hiệu của hệ thống inject secret.
AUTH_MONGODB_URI=mongodb://tt_auth_app:${AUTH_DB_PASSWORD}@mongo-1:27017,mongo-2:27017,mongo-3:27017/tt_auth_db?replicaSet=rs0&authSource=tt_auth_db&tls=true
TENANT_MONGODB_URI=mongodb://tt_tenant_app:${TENANT_DB_PASSWORD}@mongo-1:27017,mongo-2:27017,mongo-3:27017/tt_tenant_db?replicaSet=rs0&authSource=tt_tenant_db&tls=true
DOCUMENT_MONGODB_URI=mongodb://tt_document_app:${DOCUMENT_DB_PASSWORD}@mongo-1:27017,mongo-2:27017,mongo-3:27017/tt_document_db?replicaSet=rs0&authSource=tt_document_db&tls=true
CHAT_MONGODB_URI=mongodb://tt_chat_app:${CHAT_DB_PASSWORD}@mongo-1:27017,mongo-2:27017,mongo-3:27017/tt_chat_db?replicaSet=rs0&authSource=tt_chat_db&tls=true
```

*Lưu ý:* hostname, TLS, replica set name, credential và connection string là **minh họa**, phải phù hợp deployment thật. Trong dev/sandbox local có thể dùng TLS khác tùy môi trường được cô lập; production bắt buộc TLS, secret manager, ACL mạng, rotate key. Hai service không chia sẻ username/password, kể cả dùng cùng replica set.

**Tách quyền runtime với quyền migration:** app `readWrite` chỉ CRUD cần thiết; migration/ops dùng principal riêng có quyền tạo index, validator hoặc quản trị DB trong thời gian giới hạn. Không cấp quyền migration cho runtime vì dễ vượt least privilege. Nếu startup hiện gọi `model.init()` tự tạo index, phải tách bước đó ra job migration và xác nhận quyền yêu cầu trước khi khóa principal production.

### 10.2. Quy tắc kiểm thử chéo database

**AC-DB-01:** `tt_chat_app` đọc `tt_document_db.chunks` → lỗi `Unauthorized`; `tt_document_app` đọc `tt_tenant_db.tenant_memberships` → lỗi tương tự.  
**AC-DB-02:** dừng `tt_chat_db` hoặc revoke credential Chat không làm mất khả năng đăng nhập và liệt kê khóa học; chỉ tính năng chat suy giảm.  
**AC-DB-03:** backup/restore thử riêng từng DB với khóa nhất quán và bản ghi kiểm tra; không cho phép service A khôi phục DB của service B.  
**AC-DB-04:** service code scan không còn URI hoặc collection được phép của service khác (dùng allowlist).  
**AC-DB-05:** khi MongoDB shared cluster gặp lỗi, các service cùng lỗi là rủi ro hạ tầng **được ghi nhận**, không thể coi như độc lập vật lý.

### 10.3. Sơ đồ lựa chọn triển khai

![So sánh cluster dùng chung và cluster cách ly](assets/architecture/04-deployment-topologies.pdf)

**MVP đề xuất:** một managed replica set/cluster hỗ trợ transactions và MongoDB Vector Search; 4 database vận hành trước, 2 database bổ sung khi billing/notification thật sự hoạt động. **Scale-up:** có thể chuyển `tt_document_db` sang cluster/search nodes riêng do có workload embedding/vector và chi phí khác biệt. Không shard sớm nếu chưa có cardinality, throughput, index benchmarks.

## 11. MongoDB Vector Search: không để phá vỡ ranh giới DB

`tt_document_db.chunks` chứa text, vector và các trường ACL cần cho **pre-filter**. Index vector thuộc Document database; chỉ Document Service truy cập driver/query. `chat-service` gửi query đã được xác minh qua retrieval API và nhận về evidence đã qua kiểm quyền.

Ví dụ cấu hình index theo kiểu **vector tự cung cấp**, không dùng cơ chế `autoEmbed`; số chiều `1024` chỉ là *minh họa*, phải khớp đúng model embedding được nhóm chốt.

```json
{
  "name": "course_chunks_vector_v1",
  "type": "vectorSearch",
  "definition": {
    "fields": [
      {"type": "vector", "path": "vector", "numDimensions": 1024,
       "similarity": "cosine"},
      {"type": "filter", "path": "tenantId"},
      {"type": "filter", "path": "courseId"},
      {"type": "filter", "path": "accessScope"},
      {"type": "filter", "path": "ownerUserId"},
      {"type": "filter", "path": "status"},
      {"type": "filter", "path": "indexVersion"}
    ]
  }
}
```

Pseudocode truy xuất (cú pháp client/triển khai cần kiểm trên phiên bản MongoDB thực dùng):

```javascript
// Chỉ chạy trong Document Service, sau khi Tenant authorization thành công.
const allowedFilter = {
  tenantId: trusted.tenantId,
  courseId: trusted.courseId,
  status: "READY",
  indexVersion: trusted.activeIndexVersion,
  accessScope: "COURSE"
};
const stages = [
  { $vectorSearch: {
    index: "course_chunks_vector_v1",
    path: "vector",
    queryVector: questionEmbedding,
    numCandidates: 160,
    limit: 20,
    filter: allowedFilter
  }},
  { $project: {
    tenantId: 1, courseId: 1, documentId: 1,
    documentVersion: 1, chunkIndex: 1, pageFrom: 1,
    pageTo: 1, text: 1, retrievalScore: { $meta: "vectorSearchScore" }
  }}
];
```

**Tại sao không chỉ `tenantId` filter?** Vì user thuộc tenant vẫn có thể không được phép đọc course, tài liệu cá nhân hoặc tài liệu `DELETING`. API phải đánh giá course authorization trước và pre-filter theo tenant/course/scope/status/indexVersion. Với `RESTRICTED`, cần kiểm danh sách quyền và/hoặc lọc document IDs cho người gọi; không dùng filter quá rộng rồi mong Chat tự loại bỏ. Nếu `accessScope=PERSONAL`, yêu cầu `ownerUserId == trusted.userId` và không trả lại tài liệu cá nhân của user khác. Tài liệu bị thu hồi quyền/xóa phải bị loại ngay tại truy xuất và kiểm tra lại trước khi phát hành evidence nếu có race condition quan trọng.

**Khả năng triển khai:** MongoDB Vector Search yêu cầu deployment/index phù hợp, không tự có chỉ vì chạy `mongo:7.0` thường trong sandbox. Tài liệu MongoDB hiện hành liệt kê các deployment tương thích cho `$vectorSearch`, bao gồm Atlas và một số bản Community/Enterprise đời mới; phải chốt chính xác version, capability, chi phí và quy trình chạy index theo ADR. Nếu môi trường dev không có vector index, dùng **adapter thử nghiệm có ghi rõ** chứ không giả nhận MongoDB mặc định hỗ trợ vector search.

### 11.1. Chọn retrieval engine

| Chế độ | Phạm vi | Yêu cầu thực thi |
|---|---|---|
| Dense (A) | MongoDB Vector Search, ACL pre-filter | Nền tảng bắt buộc cho MVP |
| Baseline reranker (B) | Rerank danh sách evidence đã được Document cấp | Có test so với A và timeout budget |
| Fine-tuned reranker (C) | Rerank bằng model fine-tuned có version | Chỉ bật khi dataset/eval chứng minh lợi ích |
| Hybrid keyword + vector | Tuỳ chọn | Cần đo recall; không bắt buộc MVP |

Không so sánh raw score giữa embedding/reranker khác model như cùng thang; đặt phiên bản model, index, tokenizer, chunker trong evidence metadata. Citation luôn xây từ **snapshot evidence server-side**.

## 12. Sequence 1 — Login, xác thực và kiểm quyền

![Luồng xác thực và quyền giữa các service](assets/architecture/05-auth-authorization.pdf)

1. Browser login → Auth; Auth đối chiếu password (bcrypt/Argon2 tương thích AS-IS), phát JWT session vào cookie HttpOnly, `Secure` với HTTPS, `SameSite` phù hợp topology đã chốt; gửi CSRF token cho thao tác ghi.
2. Request qua Kong được route đến Tenant/Document/Chat. Không coi client `X-User-Id`/`X-Tenant-Id` là danh tính. Loại bỏ các header nhạy cảm tại edge và xây trusted context sau xác thực.
3. Tenant kiểm phiên với Auth qua internal introspection, xác minh tài khoản hiện hành, `authVersion`, rồi xác định membership/course/action. Auth chỉ là source of truth identity; Tenant là owner authorization.
4. Document/Chat gửi **service credential riêng** và user session/trusted context để Tenant kiểm quyền. Không được dùng credential Document gọi quota Chat; scope service credential theo tuyến API.
5. Khi quyền đổi, dữ liệu cũ trong Chat không tự nhiên cấp phép trở lại; mọi lần đọc/chia sẻ lại citations phải kiểm quyền theo thời điểm mới.

**Không dùng shared JWT signing secret giữa tất cả service** chỉ để tránh gọi Auth. Với kiến trúc hiện hành HS256, Auth giữ bí mật ký; service khác introspect qua mạng nội bộ. Nếu sau này nâng lên asymmetric JWT/JWKS, làm ADR về key rotation và revocation semantics. Edge OPA có thể hỗ trợ kiểm quyền chung nhưng quyết định cuối cùng vẫn nằm ở domain owner.

## 13. Sequence 2 — Upload PDF, outbox, worker và vector indexing

![Luồng upload bất đồng bộ với database riêng](assets/architecture/06-document-ingestion.pdf)

**Sơ đồ trạng thái:** `RECEIVED → UPLOADED → QUEUED → PROCESSING → READY`, lỗi có thể `FAILED`/`RETRY_WAIT`; xóa qua `DELETING → DELETED`. Không đưa `READY` vào response upload. Upload thành công trả `202 Accepted` với `documentId`, `version`, `status` và endpoint xem trạng thái.

1. Browser gửi `multipart/form-data` + `Idempotency-Key` + session; Document gọi Tenant authorize `document:upload` theo course.
2. Kiểm MIME, magic bytes **và cấu trúc PDF bằng parser**, kích thước, SHA-256, malware policy nếu có. Tạo storage key `tenantId/courseId/documentId/version.pdf` trong bucket private S3.
3. Ghi metadata tài liệu + ingestion job + outbox event **trong một transaction nội bộ `tt_document_db`** (replica set). File S3 bên ngoài transaction: nếu DB commit lỗi sau upload, tổ chức quét file mồ côi để xóa; nếu upload S3 lỗi thì không tạo trạng thái hoàn thành.
4. Outbox relay đọc events chưa publish, `XADD` Redis Stream, đánh dấu đã phát; relay có thể phát lại, vì vậy consumer phải idempotent theo `(documentId,version)`/`jobId`.
5. Worker nhận event, lấy metadata hiện hành, kiểm `version`, state, tenant/status trước khi xử lý; lấy PDF từ S3, parse, chunk, embed, lưu chunks. Các bước phải checkpoint để có thể resume mà không nhân đôi chunk/vector.
6. Sau khi xác nhận index/query khả dụng và đúng indexVersion, worker chuyển `READY`, phát `document.ready`; nếu tài liệu đã `DELETING`, không được chuyển lại `READY`.
7. Khi delete, Document loại tài liệu khỏi retrieval **ngay**, sau đó dọn S3/chunks/index async. Conversation citation snapshots không được tự động cho phép truy cập tài liệu đã thu hồi.

**Outbox không bảo đảm “exactly once delivery”** qua Redis/S3; nó cung cấp tối đa atomicity metadata + ý định publish trong cùng DB và phối hợp at-least-once delivery/idempotency. Event phải mang `eventId`, `aggregateId`, `version`, `tenantId`, `occurredAt`, `correlationId`, `schemaVersion`. Consumer dedup theo `eventId` trong **DB của chính consumer**. Với Notification/Billing, nếu event chưa có consumer thì dịch vụ đó không được giả là đã xử lý.

## 14. Sequence 3 — Chat/RAG và mô hình chi phí AI

![Luồng Chat, quota và retrieval không đọc chéo database](assets/architecture/07-chat-rag.pdf)

1. Browser gửi `POST /api/v1/courses/{courseId}/chat` qua Gateway với session thật. Chat xác thực user và hỏi Tenant quyền `chat:ask`.
2. Chat tạo `requestId`; Tenant kiểm quota idempotent theo `(tenantId,requestId)`. Cần quyết định khi nào trừ quota: lúc request được chấp nhận, hoàn tiền cho lỗi upstream hoặc ghi usage thực tế; không âm thầm trừ hai lần khi retry.
3. Chat gửi `POST /internal/v1/retrieval/search` đến Document, kèm service credential, context đã xác thực và query. Document **tự kiểm Tenant authorization**, không dựa mù quáng vào lời Chat.
4. Document vector search pre-filter ACL → trả `evidenceId`, `documentId`, version, trang và text. Không trả bằng chứng từ document chưa `READY`, đã xóa, sai tenant/course.
5. Chat evidence gate; nếu thiếu bằng chứng → `insufficient_evidence`, `citations=[]`, không cần gọi LLM. Lỗi retrieval/403/timeout → lỗi kỹ thuật riêng, không được chuyển thành “không đủ bằng chứng”.
6. Nếu đủ bằng chứng, Chat dựng prompt giới hạn theo evidence, gọi LLM provider có timeout/retry-budget. Kiểm nội dung và chỉ chấp nhận citations mapping với snapshot evidence đã cấp.
7. Chat ghi conversation/message/citation snapshots/usage vào **`tt_chat_db`** bằng transaction/atomic writes phù hợp. Xử lý trường hợp LLM đã tốn token nhưng ghi Chat DB thất bại: requestId, retry semantics, usage reconciliation.
8. Trả kết quả cho Browser theo response envelope thống nhất, kèm `traceId`, `resultState`, citations; frontend phân biệt answered, insufficient_evidence và technical error.

**Security AI:** mọi text trích xuất từ PDF là dữ liệu *không đáng tin* và phải phân ranh với system instructions; test prompt injection, exfiltration, accidental cross-tenant retrieval, hallucination, citation spoofing. Không cho model tự khai tài liệu hay trang mà client tin trực tiếp. Việc đo faithfulness/citation accuracy phải dựa test set có câu không thể trả lời và nguồn được thu hồi.

## 15. Giao tiếp xuyên service: synchronous vs asynchronous

| Từ → Đến | Kênh | Quyền xác thực | Lý do |
|---|---|---|---|
| Tenant → Auth | `/internal/auth/introspect` HTTP | `AUTH_TENANT_TOKEN` + cookie user | Validate identity, không đụng Auth DB |
| Document → Tenant | `/internal/authorization/course` | `DOCUMENT_SERVICE_TOKEN` + session | upload/management access |
| Chat → Tenant | `/internal/authorization/check` | `CHAT_SERVICE_TOKEN` + session | course chat permission |
| Chat → Tenant | `/internal/quota/chat/consume` | `CHAT_SERVICE_TOKEN` + session | trừ quota idempotent |
| Chat → Document | `/internal/v1/retrieval/search` | service credential scope retrieval, user context trusted | lấy evidence đã ACL-filter |
| Document → Redis | `document.ingest.requested.v1` | Redis principal riêng cho publisher | worker queue; không truyền DB handle |
| Document → Notification | `document.ready.v1` qua event bus | eventID + service policy | gửi thông báo khi Notification bật |
| Billing → Tenant | `subscription.changed.v1` | event signature + version | cập nhật plan entitlement projection |
| Auth → Tenant | `user.disabled.v1` | event versioned | bất hoạt quyền hội viên; eventual consistency |

**Không xây sync call chain không giới hạn:** timeout ngắn cho authorization, bounded retry + circuit breaker với lỗi mạng, propagate `X-Request-ID`/trace context. Đối với các thao tác cần tính đúng mạnh (upload/retrieval ACL), **fail closed** khi không xác minh được quyền. Không dùng Redis cache để thay thế nguồn sự thật của quyền nếu không có chiến lược revoke/invalidation được kiểm chứng.

## 16. Mẫu DTO/API contracts V3

**Response envelope chọn thống nhất** (có trong `packages/common`/`contracts/openapi/common.yaml`):

```json
{"successful": true, "data": {"documentId": "...", "status": "QUEUED"}, "error": null}
```

```json
{"successful": false, "data": null,
 "error": {"errorCode": "DOCUMENT_ACCESS_DENIED", "errorMessage": "Forbidden", "fieldErrors": {}}}
```

Một số endpoint dưới đây đang có thật ở AS-IS; endpoint mới/chuẩn hóa là **TO-BE** và cần cập nhật OpenAPI trước triển khai.

| API | Trạng thái | Chủ service | Chú ý |
|---|---|---|---|
| `POST /admin/account/login` | AS-IS | Auth | session cookie `tokenAdmin`; cần alias `/api/v1/auth/login` nếu đổi route |
| `GET /admin/account/me` | AS-IS | Auth | danh tính đã xác minh |
| `POST /internal/auth/introspect` | AS-IS | Auth | chỉ Tenant gọi |
| `POST /internal/authorization/course` | AS-IS | Tenant | Document upload auth |
| `POST /internal/authorization/check` | AS-IS | Tenant | Chat course ACL |
| `POST /internal/quota/chat/consume` | AS-IS | Tenant | Chat quota |
| `POST /api/v1/courses/{courseId}/documents` | AS-IS / upload | Document | cần chuyển backing DB, giữ 202 semantics |
| `GET /api/v1/courses/{courseId}/documents/{documentId}` | TO-BE | Document | trạng thái/ACL |
| `DELETE /api/v1/courses/{courseId}/documents/{documentId}` | TO-BE | Document | soft delete ngay, cleanup async |
| `POST /internal/v1/retrieval/search` | TO-BE | Document | private; evidence ACL |
| `POST /api/v1/courses/{courseId}/chat` | AS-IS route / TO-BE security | Chat | endpoint có nhưng chưa auth an toàn |
| `GET /api/v1/conversations` | TO-BE | Chat | owner scope |
| `POST /api/v1/messages/{messageId}/feedback` | TO-BE | Chat | owner access |

**Phiên bản hóa:** public `/api/v1/*`; nội bộ `/internal/v1/*` khi nâng cấp; events `name.v1`; không thay breaking schema trong một lần deploy mà không có consumer compatibility. Tài liệu OpenAPI cũ có path/field mismatch với code — chọn source of truth bằng contract tests và generated typed client cho frontend. Có thể duy trì alias legacy trong deprecation window rồi cắt theo telemetry.

## 17. Tính nhất quán dữ liệu và saga giữa databases

Vì mỗi service một database, **không có transaction nghiệp vụ xuyên các DB**. Tuy MongoDB hỗ trợ transaction nhiều database về mặt kỹ thuật, kiến trúc này **cấm** sử dụng để tránh ràng buộc dữ liệu và deployment. Bất biến chỉ được atomic trong DB của service sở hữu; các nghiệp vụ kéo qua service dùng saga/compensation, event idempotency và reconciliation.

| Tình huống | Owner thao tác | Cách xử lý đúng |
|---|---|---|
| Tạo tenant rồi phát invitation | Tenant → Notification | Tenant commit + outbox; Notification eventual |
| User bị disabled | Auth → Tenant | Auth commit + event; Tenant revoke memberships; auth introspection fail closed trong thời gian trễ |
| Xóa course có tài liệu | Tenant → Document | Tenant đánh dấu trạng thái, phát `course.archived`; Document khóa retrieval và cleanup; có reconcile |
| Upload thành công S3 nhưng ghi MongoDB thất bại | Document | Bù trừ xóa object mồ côi; idempotency key cố định |
| Chunk đã embed nhưng worker crash | Document | checkpoint/unique index `(document,version,chunk,indexVersion)`, retry an toàn |
| Chat LLM trả lời nhưng lưu message thất bại | Chat | requestId + ghi idempotent + ledger phí; không gọi LLM lại vô hạn |
| Payment xác nhận nhưng Tenant chưa đổi plan | Billing → Tenant | Billing event outbox, retry + reconciliation; không lấy plan trực tiếp từ Billing DB |

**CQRS chỉ ở mức projection tối thiểu:** mỗi service có thể cache snapshot user/tenant trong **database riêng** nếu có lý do nghiệp vụ. Projection có `sourceVersion`, `updatedAt`, `tenantId`; không xem projection là nguồn quyền cao hơn owner. Những request nhạy cảm vẫn introspect/authorize thời gian thực.

## 18. Docker, deploy và quan sát hệ thống

### 18.1. Triển khai đề xuất cho giai đoạn MVP

**Container/workloads tối thiểu cho slice có AI:** `web`, `kong`, `opa`, `auth`, `tenant`, `document-api`, `document-worker`, `chat`, `mongo-replica-set`, `redis`, `minio` và một **MongoDB Vector Search-capable deployment** (Atlas hoặc self-managed tương thích đã xác minh). `document-worker` là process của Document, dùng **cùng database** và cùng data ownership; Redis là message transport, không có business tables. `billing`/`notification` có thể không triển khai ở MVP dù DB đã định danh trong thiết kế.

- **Development:** Docker Compose; DB paths và principal khác nhau; MongoDB phải là replica set để test transaction. Không mặc định MongoDB container cũ hỗ trợ `$vectorSearch`.
- **Staging:** cấu hình gần production: HTTPS, IAM, TLS, indexes, worker, backup và secrets; chạy E2E với ít nhất hai tenant.
- **Production:** managed MongoDB có backup/PITR tương ứng gói dịch vụ; object storage private; TLS/mTLS nội bộ theo mức bảo vệ đã chốt; service autoscaling dựa trên CPU/IO và queue lag. Kubernetes chỉ khi có năng lực vận hành phù hợp.
- **DB migration:** một job riêng mỗi service; schema/index evolution theo expand → migrate → contract, không tự ý chạy index build khi mỗi pod khởi động.
- **Kết nối DB:** health `/health/ready` của mỗi service chỉ kiểm database của nó và các dependency **tối quan trọng** theo SLA; `/health/live` không phụ thuộc dịch vụ ngoài để tránh restart storm.

### 18.2. Observability bắt buộc

| Lớp | Metric/trace tối thiểu | Alert đề nghị |
|---|---|---|
| Gateway | HTTP 4xx/5xx, p95 latency, rate-limit, correlationId | 5xx tăng, route thiếu, OPA deny bất thường |
| MongoDB theo service DB | connections, slow queries, disk/index, replication lag | cạn connections, index không sẵn sàng, storage high |
| Document | upload latency, `QUEUED` age, retry, parser failure, outbox lag | job kẹt, outbox backlog, READY rate giảm |
| Vector retrieval | ACL deny, candidates count, p95, recall eval, index freshness | vector index unavailable, cross-tenant violation |
| Chat/LLM | latency p95, refusal, failed citation, token usage, 429, cost | high error/cost, citation validation failure |
| Redis & S3 | stream pending entries, S3 errors, orphan count | queue stalled, private bucket exposure |

Đặt `traceId`, `requestId`, `tenantId` ở nhãn log có kiểm soát; **không dùng email/nội dung PDF/query thô làm nhãn metric** dễ lộ dữ liệu và tăng cardinality. Log không chứa JWT/API key. Tạo dashboard theo service và tenant tổng hợp; expose raw per-user trace chỉ theo quyền hỗ trợ điều tra đã phê duyệt.

### 18.3. Sao lưu và khôi phục từng service

- Tạo chính sách backup, retention, RPO/RTO theo criticality **từng database**, mặc dù MongoDB cluster có thể backup ở mức cluster. Khả năng restore *một DB* cụ thể phụ thuộc tính năng công cụ/managed service; test thật quy trình restore/copy namespace trước khi cam kết.
- `tt_auth_db`: ưu tiên integrity/revocation; `tt_tenant_db`: cấu hình quyền/quota; `tt_document_db`: phải phối hợp dữ liệu S3 + chunk index và khả năng rebuild embeddings; `tt_chat_db`: bảo vệ hội thoại và citation snapshots; Billing cần integrity ledger cao.
- Khi restore chỉ một service DB về mốc cũ, **eventual consistency với service khác có thể vỡ** (ID, quyền, event replay). Sau restore phải chạy reconciliation, outbox replay có dedup và kiểm tra tenant isolation. Không coi backup độc lập là consistency xuyên hệ thống.
- Luyện tập restore định kỳ trên môi trường không production, scrub thông tin nhạy cảm trong test fixtures.

## 19. Bảo mật SaaS, tenant isolation và kiểm soát truy cập

### 19.1. Threat model rút gọn

| Mối đe dọa | Điểm vào | Kiểm soát bắt buộc |
|---|---|---|
| Mạo danh tenant/user | Headers public, body JSON | identity qua verified session; loại spoofed headers |
| Truy cập DB service khác | Shared MongoDB cluster | principal per-DB, network policy, negative permission tests |
| Người trong tenant đọc course khác | Retrieval/Document API | course ACL + document scope prefilter, test negative |
| Truy xuất PDF đã xóa | stale vector index/cache | tombstone/status filter, kiểm lại authz, cleanup worker |
| Prompt injection | Nội dung PDF do người dùng tải lên | trust boundary, prompt validation, citation grounding |
| Replay event | Redis at-least-once | eventId dedup và optimistic aggregateVersion |
| Lộ dữ liệu qua logging | Logs/observability | redact cookie/keys/text, retention và least privilege |
| API flood & cost burn | Chat endpoint | per-user/tenant rate limit, quotas, retry/time budget |
| Hỏng/giả upload | PDF upload endpoint | file signature + parse, size limit, antivirus policy, scan SSRF nếu fetch URL |
| Secret leak | Config/CI | secret manager, TLS, rotation, không commit env |

### 19.2. Ma trận quyền theo role (chính sách đề xuất cần xác nhận)

| Tác vụ | Platform admin | Tenant owner/admin | Lecturer được phân công | Student enrolled |
|---|---|---|---|---|
| Quản lý vòng đời tenant | Có theo quyền platform | Chỉ trong tenant mình | Không | Không |
| Quản lý thành viên/course | Không mặc định có quyền nội dung | Có theo role | Hạn chế trong course | Không |
| Upload tài liệu course | Không mặc định | Có | Có | Không |
| Xem tài liệu course | Không mặc định | Có | Có | Có |
| Chat dựa trên tài liệu course | Không mặc định | Có | Có | Có |
| Đọc tài liệu PERSONAL của user khác | Không | Không | Không | Không |
| Đọc lịch sử chat người khác | Không | Không, trừ quy trình hỗ trợ được phép | Không | Không |

**Mấu chốt:** `platform_admin` không tự động bypass mọi tài liệu. Xác thực danh tính và cấp quyền tài liệu là hai việc độc lập; quyền cần được định nghĩa theo action chứ không suy diễn từ tên role ở frontend.

## 20. CI/CD, automated tests và điều kiện go/no-go

### 20.1. Pipeline tối thiểu cho mỗi PR

1. Lint/format, typecheck/compile, static analysis và secret scan theo từng workspace/language.
2. MongoDB model/index contract tests cho **đúng database của service** và negative auth tests với principal của service khác.
3. OpenAPI schema lint, pact/consumer contract tests cho Auth - Tenant, Chat - Document, Chat - Tenant.
4. Unit tests domain (membership, quotas, idempotency, evidence gate) + integration tests thật trên Mongo replica set/Redis/S3.
5. E2E hai tenant: user A không xem upload/embedding/conversation B; test được cả tài liệu `PERSONAL` khác chủ.
6. SCA/dependency audit, image scan, migration plan, release notes và rollback evidence.
7. Staging smoke + synthetic load/benchmark; bật feature flag/canary khi dữ liệu hai DB cần di trú.

### 20.2. Ma trận acceptance bắt buộc

| ID | Test | Kết quả chấp nhận |
|---|---|---|
| DB-01 | Runtime principal A query DB B | Denied/unauthorized |
| DB-02 | Revoke secret Document | Document lỗi có kiểm soát; Auth/Tenant không mất dữ liệu |
| TEN-01 | A gọi API cho tenant B bằng header giả | 403/404 và không có side effect |
| TEN-02 | Student chưa enrolled đọc course khác cùng tenant | Denied; không lộ chunks |
| DOC-01 | Upload PDF cấu trúc hợp lệ, 2 tenant thật | 202; đúng ownership, S3 object, outbox, QUEUED |
| DOC-02 | Retry cùng idempotency key/content | Cùng documentId, không tạo bản ghi/trích vector trùng |
| DOC-03 | Retry cùng key nhưng byte khác | 409, không tạo side effects |
| DOC-04 | Redis outage sau DB commit | Outbox còn pending; relay retry; không mất job |
| DOC-05 | Xóa tài liệu khi worker đang chạy | Không chuyển READY lại, retrieval loại ngay |
| RAG-01 | Chat giả `X-Tenant-Id`/`X-User-Id` | Không thay đổi danh tính thực |
| RAG-02 | Không có evidence phù hợp | `insufficient_evidence`, không citation/LLM nếu policy chọn |
| RAG-03 | Citation sai hoặc không map evidence | Trả refusal/error policy, không phát nguồn giả |
| RAG-04 | Retrieval 503/timeout | Technical 5xx, không giả thành insufficient evidence |
| RAG-05 | Đọc conversation của user khác | 404/403, không lộ text |
| OPS-01 | Restore một database + S3 snapshot/rebuild | Reconciliation và outbox replay đúng |
| OPS-02 | Tắt Document vector service | Chat lỗi kỹ thuật; Auth/Tenant còn hoạt động |

### 20.3. SLO mục tiêu để thảo luận, không phải cam kết

- Login/Auth ready p95: mục tiêu nhóm chốt sau khi đo, không gán số cụ thể khi chưa có dữ liệu.
- Document upload: HTTP 202 sau validate + persist metadata (không chờ embed); độ trễ đến READY báo riêng theo kích thước/tải.
- Chat: đo riêng retrieval latency, LLM latency, total latency, token cost, refusal rate và citation quality.
- Security: **zero confirmed cross-tenant data exposure** là điều kiện release gate, không phải metric trung bình có thể đánh đổi.
- Reliability: mỗi service có chính sách retry/timeout/circuit breaker, dashboard và runbook trước go-live.

## 21. Lộ trình di trú AS-IS → V3 (theo vertical slices)

![Lộ trình chuyển đổi theo giai đoạn](assets/architecture/08-roadmap.pdf)

**Không xóa PostgreSQL AS-IS, không bật production cutover một bước.** Di trú có thể làm theo P0–P4, với mốc nghiệm thu độc lập và rollback.

| Pha | Thực hiện | Đầu ra/tiêu chí đóng |
|---|---|---|
| P0 — Chốt boundary | ADR V3, inventory DB connections, secret/user per-DB, khóa Chat spoof, gateway routes | DB-01, TEN-01, OpenAPI contracts qua review |
| P1 — Provision MongoDB | Mongo replica set, 4 DB runtime, app credentials, migration principals, metrics/backup | Database deny tests + smoke backup/restore |
| P2 — Document migration | Spring Data Mongo repositories, document/index models, worker/outbox, vector search index | DOC-01..05; shadow read/backfill; AC vector retrieval |
| P3 — Chat migration | MongoDB repository thay skeleton SQLAlchemy, trusted auth, history, feedback, RAG evidence | RAG-01..05 + E2E browser; không header spoof |
| P4 — SaaS hardening | plan/usage ledger, notification, per-service DB khi bật, ops/DR/cost | audit, security, restore, rate-limit, multi-tenant E2E |

### 21.1. Checklist chi tiết cho Document/PostgreSQL → MongoDB

1. **Chuẩn bị:** đóng băng contract upload; ghi lại schema PostgreSQL `documents`, `ingestion_jobs`, idempotency index; thiết kế mapping ObjectId/string nhất quán (`documentId` giữ ID ổn định để tránh mất reference).
2. **Provision `tt_document_db`:** tạo app principal readWrite chỉ DB này; tạo indexes, validators và vector index qua migration principal; test boot trên replica set.
3. **Lớp repository adapter:** Spring Data MongoDB thay JPA/PostgreSQL, tránh thay đổi domain services/API cùng lúc; test idempotency transactional và JSON response parity.
4. **Backfill:** snapshot PostgreSQL tại mốc; chuyển metadata/jobs sang MongoDB, checksum/key mapping; kiểm document counts, SHA-256, unique constraints, ownership tenant/course; S3 vẫn là nguồn file gốc.
5. **Outbox/worker:** tạo Mongo outbox; relay Redis Streams, idempotent consumer. Với record `UPLOADED` cũ chưa có event, tạo outbox re-drive có dedup để tránh mất ingestion.
6. **Shadow read:** đọc Mongo ở shadow và so sánh kết quả với PostgreSQL trên sample có kiểm quyền, không để endpoint public chọn nguồn dữ liệu theo client.
7. **Cutover:** tạm dừng ghi hoặc dùng kế hoạch dual-write/backfill cẩn thận; mọi thay đổi trong giai đoạn migrate có reconciliation; bật Document Mongo bằng feature flag; quan sát 202/409/403, outbox lag, S3 consistency.
8. **Rollback:** duy trì PostgreSQL read-only snapshot, kế hoạch khôi phục dữ liệu mới sau cutover; nếu rollback phải replay/migrate ngược phần ghi mới hoặc chỉ đảo về bản deploy trước khi chấp nhận traffic mới. Không hứa rollback tự động khi đã có ghi Mongo chỉ một chiều.
9. **Decommission:** chỉ xóa PostgreSQL khi hoàn tất thời gian quan sát, backup verified, E2E hai tenant và phê duyệt của owner dữ liệu.

### 21.2. Checklist Chat/SQLAlchemy → MongoDB

- Hiện repo có SQLAlchemy entities và conversation/feedback controller stub; cần inventory **dữ liệu thực** trước khi gọi là migration. Nếu chưa phát sinh production data thì triển khai Mongo repository mới và bỏ SQL dependencies, không tự đặt công việc backfill giả.
- Chuẩn hóa `conversationId`/`messageId` dạng ổn định; tạo unique indexes và owner scope; thực thi idempotent request.
- Viết integration test với Mongo replica set và truy cập Chat database độc lập; đưa `userId`/`tenantId` qua auth verified, không headers công khai.
- Chỉ bật UI Chat sau khi retrieval có ACL, citation validation, quota và lưu lịch sử đúng owner.

## 22. Cấu trúc repository nên thay đổi

```text
services/
  auth-service/            # Node / Express -> tt_auth_db
    models/  services/  routes/  migrations/
  tenant-service/          # Node / Express -> tt_tenant_db
    models/  services/  routes/  migrations/
  document-service/        # Java / Spring Boot -> tt_document_db
    src/main/.../repository/mongo/
    src/main/.../ingestion/   # worker trong cùng bounded context
    database/mongo-migrations/
  chat-service/            # Python / FastAPI -> tt_chat_db
    app/repositories/mongo/
    app/ai/  app/services/
    migrations/mongo/
  billing-service/         # bật khi cần -> tt_billing_db
  notification-service/    # bật khi cần -> tt_notification_db
contracts/
  openapi/                 # tách contract public/internal
  events/                  # JSON Schemas versioned
infrastructure/
  gateway/                 # Kong/OPA
  sandbox/                 # compose, seed 2 tenants, test DB principals
  mongo/                   # provisioning roles, indexes, backup runbooks
  observability/
docs/architecture/
  V3-database-per-service.md
  adrs/
```

**Không chuyển code Auth/Tenant đang chạy sang repository mới hoặc framework mới trong đợt đổi database.** Thay đổi phải có PR theo service owner, contract-first, review migration, test, feature flag; không push trực tiếp main. Chỉ giữ source đã xác minh, không dùng code demo frontend làm bằng chứng production.

## 23. ADR: các quyết định cần ký duyệt

| ADR | Quyết định đề xuất | Người xác nhận |
|---|---|---|
| ADR-001 | 1 DB MongoDB/service, 1 principal readWrite/service, 1 migration principal riêng | Tech lead / DevOps |
| ADR-002 | Pooled tenant trên từng DB, tenantId + server ACL | Security / Tenant owner |
| ADR-003 | Auth là duy nhất, identity skeleton deprecated | Platform owner |
| ADR-004 | Document owns vector index; Chat chỉ truy xuất HTTP | AI / Document owners |
| ADR-005 | Mongo Vector Search deployment: Atlas vs self-managed tương thích, chi phí/version | DevOps / AI |
| ADR-006 | Mongo outbox + Redis Streams và worker cùng Document DB | Backend / Platform |
| ADR-007 | Session `tokenAdmin` hay tên mới; CSRF/CORS/OPA; service credentials | Security / Frontend |
| ADR-008 | S3 storage, retention, deletion, privacy, backup alignment | Product / Legal / DevOps |
| ADR-009 | Quota khi LLM lỗi, usage reconciliation và billing activation | Product / Billing |
| ADR-010 | Kế hoạch migration/cutover/rollback Document và Chat | Service owners / QA |

## 24. Rủi ro, giả định và phương án thay thế

| Rủi ro/đánh đổi | Tác động | Giảm thiểu |
|---|---|---|
| Sáu database trên một cluster vẫn chung failure domain | lỗi hạ tầng tác động nhiều service | backup/replica set, move workload nóng sang cluster riêng |
| Secrets/roles tạo sai dẫn tới readWrite chéo DB | mất isolation | automated negative permission test + secret rotation |
| MongoDB Vector Search không có ở bản deployment | RAG không thực chạy | ADR Atlas/self-managed version, capability smoke trước code |
| Outbox relay trùng events | side effect lặp | event ID + consumer dedup, retry/backoff |
| Cross-service saga mất đồng bộ | status/quota sai | reconciliation, versioned events, alert drift |
| Read-only mapping dùng dữ liệu cũ | cấp quyền sai | fail closed, authorize real time cho sensitive flows |
| Migration PostgreSQL mất idempotency/history | upload nhân đôi | backfill unique keys, shadow compare, rollback plan |
| Java/Python MongoDB drivers tăng chi phí bảo trì | chất lượng không đồng đều | adapter interface, lint/test, docs theo runtime |
| Workload vector cạnh tranh CPU với Auth | p95 và availability cùng giảm | search nodes/resource isolation, scale Document DB cluster |
| Pooled multi-tenant rò dữ liệu do thiếu filter | rủi ro an toàn cao | policy-in-code, tests hai tenant thật, audit queries |

**Alternative A — Một database Mongo chung cho tất cả service:** từ chối vì trái quyết định ownership, khó hạn chế quyền/di trú/rollback.  
**Alternative B — Một Mongo cluster vật lý riêng cho mỗi service:** hợp lệ về isolation mạnh hơn nhưng chi phí/ops cao, chỉ ưu tiên theo SLA, quy định hoặc workload đo được.  
**Alternative C — Database-per-Tenant:** không áp dụng mặc định vì nhân số tenant vào chi phí migration/backup/connections; phù hợp enterprise yêu cầu riêng, xử lý thông qua data residency/tenant placement ADR.

## 25. Phân công và Definition of Done

**Frontend:** không dùng demo fixtures cho business; generated client; session + CSRF + trạng thái loading/errors; trích dẫn mở đúng quyền.  
**Auth owner:** session introspection, revocation, principal `tt_auth_app`, auth event contract; kiểm không lộ quyền DB.  
**Tenant owner:** membership/course ACL, quota idempotency, db principal, tests multi-tenant.  
**Document owner:** MongoDB persistence migration, outbox, ingestion, vector, S3, retrieval scope.  
**Chat/AI owner:** Mongo repo, verified identity, evaluation A/B/C, evidence/citation, usage/feedback.  
**DevOps/QA:** Mongo provision + role tests, CI, S3/Redis/Vector env, restore drill, E2E hai tenant, metrics.

Một service đạt **Definition of Done** khi có: OpenAPI/events versioned, 1 database duy nhất và credential scope riêng, schema indexes/migrations, test truy cập DB khác **bị chặn**, test authorization tenant, logs/metrics, readiness/rollback, backup/runbook, không có hardcoded secret, không truy cập DB ngoài owner.

## 26. Go/No-Go và điều kiện bàn giao

**Không đưa Chat/Document mới lên môi trường công khai nếu bất kỳ điều kiện nào sau đây chưa đạt:**

- [ ] MongoDB runtime credential riêng cho 4 service cốt lõi, negative DB permission tests chạy thật.
- [ ] Chứng minh `tt_document_app` không thể đọc `tt_chat_db`, và ngược lại.
- [ ] Chat không sử dụng `X-Tenant-Id`, `X-User-Id` từ client để quyết định quyền.
- [ ] E2E dùng **hai tenant có thật**, mỗi tenant có course, giảng viên, sinh viên và PDF hợp lệ có text.
- [ ] Document upload → S3 → Mongo outbox → Redis → worker → READY → vector retrieval được xác nhận.
- [ ] Document ACL loại tài liệu cá nhân khác user, course khác, document đã xóa hoặc chưa READY.
- [ ] Chat answer citations mapping snapshot; insufficient evidence không giả lỗi retrieval.
- [ ] Mọi endpoint `/internal` inaccessible từ public Gateway; Kong routes tương ứng API thật.
- [ ] Không xóa PostgreSQL trước khi backfill/compare/cutover/rollback sign-off.
- [ ] Restore từ backup đã thử trên môi trường staging và reconcile data giữa service.

**Chốt cuối:** để đáp ứng mong muốn “mỗi service một database”, **phải thực thi cả ranh giới mã nguồn, credential, quyền MongoDB, ownership và test**; chỉ đặt tên `auth_db/tenant_db/...` trong sơ đồ là chưa đủ. Ưu tiên thực tế trước tiên là bảo mật Chat + provision database/credentials chuẩn, sau đó di trú Document/Chat và hoàn thiện vertical slice.

## 27. Bằng chứng và tài liệu tham khảo

### 27.1. Nguồn nội bộ tại commit baseline

- `apps/web/README.md`: frontend demo chưa gọi API nghiệp vụ hoặc upload bytes thật.
- `services/auth-service/config/database.ts`, `services/tenant-service/config/database.ts`: Mongoose, Mongo URIs/replica set.
- `services/tenant-service/routes/internal.route.ts` và `services/tenant-service/services/course.service.ts`: authorization/quota kiểm scope.
- `services/document-service/README.md`, `services/document-service/database/migrations/001_document_upload.sql`: PostgreSQL AS-IS, S3 và Redis queue.
- `services/chat-service/pyproject.toml`, `chat_controller.py` và `security.py`: SQL skeleton và lỗ hổng header chưa verified.
- `infrastructure/gateway/kong/kong.yml`, `infrastructure/gateway/opa/policies/authz.rego`: gateway/OPA hiện trạng.
- `infrastructure/sandbox/compose.yaml`: Mongo replica set, PostgreSQL, Redis, MinIO của test hiện tại.
- `docs/reports/2026-10-27/2026-10-26-linh-upload-e2e-review.md`: phạm vi E2E và các thiếu sót của test fixtures.

### 27.2. Tài liệu MongoDB và nguyên tắc kỹ thuật

- MongoDB Vector Search overview: <https://www.mongodb.com/docs/vector-search/>
- Vector Search index fields / prefilters: <https://www.mongodb.com/docs/vector-search/indexes/vector-search-type/>
- MongoDB `$vectorSearch` compatibility: <https://www.mongodb.com/docs/manual/reference/operator/aggregation/vectorsearch/>
- MongoDB database users/role scope: <https://www.mongodb.com/docs/manual/reference/method/db.createuser/>
- [MongoDB transaction considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
- MongoDB change streams: <https://www.mongodb.com/docs/manual/changestreams/>

**Giới hạn:** tài liệu thiết kế dựa trên mã nguồn repository và tài liệu kỹ thuật công khai tại thời điểm biên soạn; chưa triển khai thay đổi lên GitHub, chưa benchmark/restore MongoDB V3, chưa xác minh riêng license/chi phí của môi trường mục tiêu. Mọi con số/index dimension minh họa phải được chốt bằng ADR và test trên môi trường thực.
