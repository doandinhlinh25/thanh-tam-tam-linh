# BT3 – VT-004 · 02. Risk-based test strategy và test design

## 1. Risk register

| ID | Risk | Impact | Likelihood | Test chính |
|---|---|---|---|---|
| R1 (VT-004) | Thay đổi nhỏ làm hỏng behavior cũ không liên quan (ghi danh đơn lẻ, ACL, giới hạn JSON 32 kB, membership) | Cao | Trung bình | IT-R1, IT-R2, `test:platform` 11 test, mutant M7–M10 |
| R2 | Dòng lỗi làm mất dòng hợp lệ (yêu cầu cốt lõi của CR) | Cao | Trung bình | U-INV, IT-01, IT-04 |
| R3 | Import "hồi sinh" quyền: member đã thu hồi hoặc enrollment `completed` bị kích hoạt lại → được hỏi trợ giảng RAG | Cao | Thấp | U-ST4, U-ST6, IT-02, IT-07 |
| R4 | Import đồng thời tạo enrollment trùng hoặc báo `created` hai lần | Trung bình | Trung bình | IT-08 |
| R5 | Lỗi hạ tầng giữa lô để lại dữ liệu ghi dở nhưng client tưởng thành công | Trung bình | Thấp | IT-06 (fail point MongoDB) |
| R6 | Lecturer/student tự import để ghi danh | Cao | Thấp | IT-03 |
| R7 | 40 tác vụ đồng thời vượt p95 1.5 s (tranh chấp `tenant.revision`) | Trung bình | Trung bình | L-01 (load harness) |

## 2. Phân bổ test level

| Level | Phạm vi | Lý do | Số test |
|---|---|---|---|
| Unit | `planEnrollmentImport` (hàm thuần) | Bảng chuyển trạng thái là domain rule; chạy < 1 s, không cần DB, chỉ ra đúng transition sai | 10 |
| Integration/API | HTTP thật: Origin + cookie JWT + CSRF → Tenant → Auth → MongoDB replica set (transaction, unique index, fail point) | Rủi ro R2–R6 nằm ở boundary DB/transaction/authz mà unit không thấy (mutant M5, M6 chỉ integration bắt được) | 10 |
| Regression | `test:platform` có sẵn (11) + IT-R1, IT-R2 | Risk VT-004 = phá behavior cũ | 13 |
| E2E (service-level) | IT-01/IT-02 đi qua toàn bộ stack backend | Không có UI import; xem mục 2.1 | (dùng chung) |
| Performance | `test/load/enrollment-import.load.ts` | NFR1: 40 tác vụ, p95 ≤ 1.5 s | 2 kịch bản |

### 2.1 Test không cần thiết (và lý do)

- **UI/browser E2E (Playwright)**: `apps/web` hiện chỉ có mock UI, không gọi API tenant; `contracts/openapi` không có path tenant. Viết E2E UI lúc này là test một màn hình không tồn tại.
- **Unit test controller/route với mock**: controller chỉ là glue 15 dòng; mock `CourseService`/mongoose sẽ lặp lại assumption của implementation (Lecture 07 – test doubles che tích hợp sai). API test đã đi qua đúng đoạn code đó.
- **Mock transaction MongoDB**: rollback/write-conflict chỉ có ý nghĩa trên replica set thật → dùng `mongodb-memory-server` replica set thay vì mock.
- **Load test cho endpoint ghi danh đơn lẻ**: không thay đổi; regression chức năng là đủ.
- **Contract test OpenAPI**: chưa có spec cho tenant admin; ghi nhận là việc tiếp theo, không tự bịa contract.

## 3. State transition testing (kỹ thuật bắt buộc)

Thực thể: enrollment của cặp *(course, user)*. Trạng thái: `NONE`, `active`, `dropped`,
`completed`. Guard `S` = user là thành viên `student`, `status: active`, `deleted: false`
của tenant. Sự kiện: `import`, cùng các sự kiện cũ `enroll` (đơn lẻ), `unenroll`, `revoke member`.

```text
            import[S] / created
   NONE ─────────────────────────▶ active ◀──────────────┐
    │ import[¬S] / rejected          │  ▲ import / skipped │
    ▼ (giữ NONE)                     │  └────(tự lặp)      │ import[S] / reactivated
   NONE                     unenroll │ revoke member       │
                                     ▼                     │
                                  dropped ─────────────────┘
                                     │ import[¬S] / rejected (giữ dropped)
   completed ── import / rejected (enrollment_completed, giữ completed)
```

| Transition | Từ → Đến | Hợp lệ? | Unit | Integration |
|---|---|---|---|---|
| T1 | NONE —import[S]→ active | Có | U-ST1 | IT-01, IT-02 |
| T2 | dropped —import[S]→ active | Có | U-ST2 | IT-02, IT-06 (retry) |
| T3 | active —import→ active (không ghi) | Có (no-op) | U-ST3 | IT-02 (giữ `enrolledAt`) |
| T4 | completed —import→ active | **Bị cấm** | U-ST4 | IT-02 |
| T5 | NONE —import[¬S]→ active | **Bị cấm** | U-ST5 | IT-01 (outsider, lecturer) |
| T6 | dropped —import[¬S]→ active | **Bị cấm** | U-ST6 | IT-07 |
| Chuỗi 1-switch | NONE →import→ active →unenroll→ dropped →import→ active | Có | – | IT-02 |
| Chuỗi idempotent | active →import→ active →import→ active | Có | – | IT-02 (lần 2: 0 created) |

Phủ: 6/6 cặp (trạng thái × guard) cho sự kiện `import` (0-switch), 4/4 transition bị cấm
có test riêng, và 2 chuỗi nhiều bước dùng API cũ để nối trạng thái thật.

### Cách chọn test data

- **Một đại diện cho mỗi (trạng thái, guard)**: ID dễ đọc `…a1` = NONE+student, `…a2` = dropped+student, `…b2` = dropped+revoked… → khi fail biết ngay transition nào sai.
- **Partition định dạng sai** (U-N1): `null`, số, `{}`, chuỗi rỗng, 23 ký tự, 25 ký tự, 24 ký tự không phải hex, chuỗi trần không bọc object.
- **Boundary kích thước lô** (IT-04): 0, 500 (biên trên hợp lệ), 501 (ngay trên biên), kiểu sai.
- **Vị trí dòng lỗi** (U-INV, IT-01): đầu, giữa, cuối lô — bắt lỗi kiểu "dừng ở dòng lỗi đầu tiên".
- **Trùng khác hoa/thường** (U-N2): ObjectId hex không phân biệt hoa thường → phải coi là trùng.
- **Timestamp cố định** `2026-01-01T00:00:00Z`: phân biệt "skipped không ghi lại" với "ghi đè cùng giá trị".
- **Mỗi test có tenant riêng** (ObjectId ngẫu nhiên, code `bt3-<uuid>`): không chia sẻ state, chạy riêng lẻ được.

## 4. Bảng test cases

| ID | Risk / Requirement | Level | Precondition / Input | Expected result | Priority |
|---|---|---|---|---|---|
| U-ST1 | AC3, T1 | Unit | NONE + student active | `created` | P1 |
| U-ST2 | AC3, T2 | Unit | dropped + student active | `reactivated` | P1 |
| U-ST3 | AC3, T3 | Unit | active | `skipped / already_active` | P2 |
| U-ST4 | AC3, R3, T4 | Unit | completed | `rejected / enrollment_completed` | P1 |
| U-ST5 | AC2, T5 | Unit | NONE + không phải student | `rejected / not_active_student` | P1 |
| U-ST6 | R3, T6 | Unit | dropped + member bị thu hồi | `rejected / not_active_student` | P1 |
| U-N1 | AC2 (negative) | Unit | 10 dòng sai định dạng | mỗi dòng `rejected / invalid_user_id`, không throw | P1 |
| U-N2 | AC2 (negative) | Unit | cùng ID 3 lần, 1 lần viết hoa | dòng đầu `created`, 2 dòng sau `duplicate_in_batch` | P2 |
| U-INV | Invariant, R2 | Unit | 3 dòng hợp lệ chèn dòng lỗi ở đầu/giữa/cuối | outcome dòng hợp lệ giống hệt khi chạy riêng; tổng summary = total | P1 |
| U-SUM | AC1 | Unit | lô 7 dòng đủ loại | `summary` đúng từng loại | P2 |
| IT-01 | AC1, AC2, R2 | API | 8 dòng: sai ID, 3 student, outsider, lecturer, trùng, `null` | 200; 3 `created`, 5 `rejected` đúng reason & thứ tự; DB đúng 3 enrollment | P1 |
| IT-02 | AC3, R3 | API | seed dropped/active/completed với ngày cố định; gửi 2 lần; unenroll rồi import | lần 1: created/reactivated/skipped/rejected; `enrolledAt` của active giữ nguyên; `completedAt` giữ nguyên; lần 2: 0 created; chuỗi unenroll→import = reactivated | P1 |
| IT-03 | AC4, R6 (negative) | API | lecturer, student của tenant gọi import | 403 "Không đủ quyền!", 0 enrollment | P1 |
| IT-04 | AC4 (negative, boundary) | API | `{}`, `rows: []`, `rows: "abc"`, 501 dòng, field lạ; rồi 500 dòng | 400 và 0 enrollment; 500 dòng → 200 | P1 |
| IT-05 | AC4 (failure path) | API | course đã xóa mềm | 404 "Không tìm thấy môn học!", 0 enrollment | P2 |
| IT-06 | NFR2, R5 (failure path) | API | fail point `failCommand` lỗi lệnh `update` 1 lần | 500; dropped cũ vẫn dropped; `tenant.revision` không đổi; retry → 2 created + 1 reactivated | P1 |
| IT-07 | Contract, R3 | API | member `revoked` có enrollment dropped | `rejected / not_active_student`; enrollment vẫn dropped | P1 |
| IT-08 | NFR2, R4 | API | 5 lô chồng lấn (30 student) gửi đồng thời | 200 cả 5; 30 enrollment, không trùng; tổng `created` = 30 | P1 |
| IT-R1 | AC5, R1 (regression) | API | ghi danh đơn lẻ 2 lần, unenroll, ghi lại; student xem list/detail; body 33 kB | 200/409/200/200; ACL như cũ; 413 | P1 |
| IT-R2 | AC5, R1 (thêm sau mutant M10) | API | thêm lại member đang active với vai trò khác | 409; vai trò vẫn `student`; import vẫn `created` | P2 |
| L-01 | NFR1, R7 | Performance | 40 tác vụ × 25 dòng, 5 vòng đo + 1 warm-up, 2 kịch bản | p95 ≤ 1500 ms, 0 lỗi, 0 dòng hợp lệ bị mất | P2 |

Negative tests: U-N1, U-N2, IT-03, IT-04. Failure-path tests gắn risk riêng: IT-05,
IT-06 (lỗi hạ tầng giữa lô — R5/NFR2) và IT-R1/IT-R2 (risk VT-004: behavior cũ bị phá).
