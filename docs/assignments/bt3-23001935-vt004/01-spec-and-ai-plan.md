# BT3 – VT-004 · 01. Specification và AI-assisted plan

- Sinh viên: Nguyễn Trung Thành — 23001935 · Nhóm SE2026-T01 · Đề tài AI-01
- Baseline: `origin/main` @ `6663a36b2c1ddb2cdfaee7ce7bfff55e33bc1d2b`
- Nhánh: `bt3/23001935-vt004-bulk-enrollment-import`

## 1. Change request → vertical slice

Change request VT-004: *Thêm chức năng import dữ liệu hàng loạt; bản ghi lỗi không
được làm mất các bản ghi hợp lệ.*

Repository hiện chỉ có ghi danh **từng** sinh viên:
`POST /admin/tenant/:tenantId/courses/:courseId/enroll` →
`CourseService.enrollStudent` (`services/tenant-service/services/course.service.ts`).
Trợ giảng RAG chỉ trả lời cho sinh viên có enrollment `active`
(`CourseService.canAccessCourse`, action `chat:ask`, `document:read`), nên một lớp
200 sinh viên phải gọi API 200 lần mới dùng được hệ thống. Slice được chọn:

> **Import ghi danh sinh viên hàng loạt vào một môn học**
> `POST /admin/tenant/:tenantId/courses/:courseId/enroll/import`
> body `{ "rows": [{ "userId": "<ObjectId>" }, ...] }`

### Problem statement

Tenant owner/admin không có cách đưa danh sách lớp vào môn học trong một thao tác.
Gọi lặp API đơn lẻ vừa chậm vừa không cho biết bản ghi nào lỗi; nếu làm "import cả
lô trong một transaction" thì một dòng sai sẽ làm mất toàn bộ các dòng đúng. Cần một
endpoint import hàng loạt xử lý **từng bản ghi độc lập**, báo cáo kết quả theo dòng,
và không thay đổi bất kỳ behavior cũ nào của tenant-service.

### Acceptance criteria (kiểm thử được)

| ID | Acceptance criterion |
|---|---|
| AC1 | Owner/admin gửi 1–500 dòng → mỗi dòng hợp lệ (userId là thành viên `student` đang `active` của tenant) có enrollment `active` cho môn học. Response 200 có `results[]` theo đúng thứ tự dòng (`row`, `userId`, `outcome`, `reason?`) và `summary` với `created + reactivated + skipped + rejected = total`. |
| AC2 | Dòng lỗi (sai định dạng ID, trùng trong cùng lô, không phải student active, enrollment đã `completed`) bị `rejected` kèm `reason` và **không** làm mất dòng hợp lệ, bất kể dòng lỗi nằm đầu, giữa hay cuối lô. |
| AC3 | Chuyển trạng thái enrollment khi import: *none → active* (`created`); *dropped → active* (`reactivated`); *active → active* (`skipped`, giữ nguyên `enrolledAt`); *completed → completed* (`rejected`). Gửi lại cùng lô là idempotent (lần 2 không tạo thêm bản ghi). |
| AC4 | Lỗi cấp request từ chối cả lô **và không ghi gì**: không phải owner/admin → 403; môn học không tồn tại/đã xóa → 404; `rows` không phải mảng, rỗng hoặc > 500 → 400. |
| AC5 | Regression: behavior cũ không đổi — ghi danh đơn lẻ (409 nếu đang active), hủy ghi danh, ACL môn học của sinh viên, ủy quyền Document, giới hạn JSON 32 kB; bộ `test:platform` hiện có vẫn 11/11 pass. |

### Non-functional constraints

| ID | Constraint |
|---|---|
| NFR1 – Performance | 40 tác vụ import đồng thời (mỗi tác vụ 25 dòng) → p95 latency ≤ 1.5 s trên harness local (MongoDB replica set in-memory + Auth + Tenant thật). |
| NFR2 – Consistency | Không bao giờ có 2 enrollment cho cùng `(courseId, userId)` kể cả khi import đồng thời; lỗi hạ tầng giữa lô làm rollback toàn bộ transaction thay vì trả "thành công" cho một lô ghi dở. |
| NFR3 – Security/Isolation | Chỉ kiểm tra membership trong **cùng tenant**; không mở rộng `express.json` 32 kB toàn cục; không thêm upload file vào multer dùng chung (`files: 0`). |

### Invariant / contract quan trọng nhất

> **Kết quả của mỗi dòng chỉ phụ thuộc vào chính dòng đó và trạng thái DB trước import.**
> Tập enrollment được ghi = đúng tập dòng báo `created`/`reactivated`; một dòng lỗi
> không bao giờ làm đổi outcome của dòng khác (trừ quy tắc trùng lặp: lần xuất hiện
> đầu tiên thắng).

Contract phụ, dùng chung với `canAccessCourse`: *một enrollment chỉ được chuyển sang
`active` khi user là thành viên `student`, `status: active`, `deleted: false` của
đúng tenant đó.* Vi phạm contract này = sinh viên đã bị thu hồi quyền lại hỏi được
trợ giảng RAG.

## 2. Prompt cho coding agent (AI phải lập kế hoạch trước khi code)

Công cụ: Claude Code (model Claude Opus 5.5) chạy trong VS Code, đọc repository thật.

```text
Bạn là coding agent trong repo thanh-tam-tam-linh (Node/TS, tenant-service, MongoDB).
Change request: "Thêm chức năng import dữ liệu hàng loạt; bản ghi lỗi không được làm
mất các bản ghi hợp lệ." Risk trọng tâm: thay đổi nhỏ làm hỏng behavior cũ không liên quan.
CHƯA ĐƯỢC SINH CODE. Hãy trả về:
1) vertical slice nhỏ nhất chạy được,
2) danh sách assumptions đánh số (A1..An),
3) các file dự định thay đổi/tạo mới,
4) rủi ro và test strategy (bắt buộc state transition testing).
Tôi sẽ duyệt assumptions trước khi cho phép sinh code.
```

## 3. AI plan v1 (bản agent đề xuất, chưa review)

Slice: import ghi danh sinh viên từ file CSV vào môn học.

| # | Assumption của agent |
|---|---|
| A1 | "Dữ liệu hàng loạt" = danh sách ghi danh sinh viên của môn học trong tenant-service; tái sử dụng logic `enrollStudent`. |
| A2 | Input là file CSV (cột `email`) upload bằng `multer` `upload.single("file")`. |
| A3 | Controller lặp qua từng dòng, gọi `CourseService.enrollStudent`, `try/catch` từng dòng để gom lỗi. |
| A4 | (phương án thay thế) Bọc cả lô trong một transaction, gặp dòng lỗi thì throw để rollback cho "nhất quán". |
| A5 | Validate body bằng Joi: `rows: Joi.array().items(Joi.object({ userId: objectId.required() }))`. |
| A6 | Tăng `express.json({ limit })` lên `5mb` để nhận lô lớn. |
| A7 | Enrollment `completed` được kích hoạt lại giống `dropped`. |

File dự định: `routes/admin/course.route.ts`, `controllers/admin/course.controller.ts`,
`validates/admin/course.validate.ts`, `services/course.service.ts`, `index.ts`
(limit JSON), thêm `helpers/csv.helper.ts`, thêm test.

## 4. Review plan bằng repository thật (sửa/bác bỏ có evidence)

| # | Quyết định | Evidence trong repo | Sửa thành |
|---|---|---|---|
| A1 | **Chấp nhận** | `course.service.ts` `enrollStudent`; `canAccessCourse` yêu cầu `CourseEnrollment.status: "active"` cho student. | Giữ. |
| A2 | **Bác bỏ** | `routes/admin/course.route.ts:13` multer dùng chung `files: 0`; `models/tenant-membership.model.ts` chỉ có `userId`, **không có email** (email thuộc auth-service, coding-conventions cấm truy vấn chéo DB). | Body JSON `rows[{userId}]`; không đụng multer dùng chung. |
| A3 | **Bác bỏ** | `helpers/tenant.helper.ts:17-34`: mỗi `withTenant` mở transaction, `$inc revision` trên **cùng document tenant** và ghi `TenantAudit`. Lô 500 dòng = 500 transaction xung đột trên 1 document → retry, vi phạm NFR1. Ngoài ra `course.service.ts:279` upsert `completedAt: null` → tự động "hồi sinh" enrollment `completed`. | Một transaction cho lô; phân loại dòng **trước** khi ghi bằng hàm thuần `planEnrollmentImport`; ghi bằng `bulkWrite` chỉ các dòng hợp lệ. |
| A4 | **Bác bỏ** | Trực tiếp vi phạm AC2/invariant: một dòng lỗi rollback mọi dòng hợp lệ. | Lỗi nghiệp vụ theo dòng không throw; chỉ lỗi cấp request (403/404/400) hoặc lỗi hạ tầng mới làm hỏng cả lô. |
| A5 | **Bác bỏ** | `helpers/validation.helper.ts:8` `validateBody` trả **400 cho cả request** ngay khi có lỗi đầu tiên → một `userId` sai làm mất cả lô. | Boundary chỉ kiểm tra `rows` là mảng 1–500 (`Joi.any()` cho từng phần tử); định dạng từng dòng do planner kiểm tra. |
| A6 | **Bác bỏ** | `index.ts:32` `express.json({ limit: "32kb" })` là **toàn cục**; `test/platform.integration.ts:995` khóa behavior "multipart fields are bounded"; `error.helper.ts` map `entity.too.large` → 413. Đổi limit = sửa behavior không liên quan (đúng risk VT-004). 500 dòng ≈ 19.5 kB < 32 kB. | Giữ 32 kB; giới hạn 500 dòng/lô. |
| A7 | **Sửa** | Không có code nào set `completed` nhưng schema cho phép (`course-enrollment.model.ts:37`). Kích hoạt lại sẽ xóa `completedAt` (lịch sử học tập). | `completed` là trạng thái cuối với import → `rejected: enrollment_completed`. Không sửa `enrollStudent` cũ (tránh đổi behavior cũ, ghi nhận là residual risk). |

## 5. AI plan v2 (sau review, được phép sinh code)

1. `helpers/enrollment-import.helper.ts` (mới): hằng số + hàm thuần
   `planEnrollmentImport(rows, { activeStudentIds, enrollmentStatusByUser })` →
   `{ results, summary }` (bảng chuyển trạng thái nằm ở đây, unit-test được, không cần DB).
2. `services/course.service.ts`: thêm `CourseService.importEnrollments` dùng **một**
   `withTenant` (giữ kiểm quyền owner/admin + audit), kiểm tra course, nạp membership &
   enrollment hiện có cho các ID hợp lệ, gọi planner, `bulkWrite` các dòng hợp lệ.
3. `validates/admin/course.validate.ts`: `importEnrollments` chỉ ràng buộc mảng 1–500.
4. `controllers/admin/course.controller.ts` + `routes/admin/course.route.ts`: endpoint mới,
   dùng quyền `course-enroll-student` có sẵn, không đổi route cũ.
5. Không sửa `index.ts`, `tenant.helper.ts`, `enrollStudent`, multer.
6. Test: `test/unit/enrollment-import.test.ts`, `test/enrollment-import.integration.ts`,
   harness `test/support/platform-harness.ts`, tải `test/load/enrollment-import.load.ts`.
