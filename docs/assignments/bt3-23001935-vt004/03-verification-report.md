# BT3 – VT-004 · 03. Verification report

Mọi số liệu dưới đây lấy từ log trong `evidence/`, chạy trên Node v24.14.0, Linux 6.8,
AMD Ryzen 7 5800HS (16 luồng), MongoDB 7.0.24 (mongodb-memory-server, replica set 1 node).

## 1. Git và commit

| Bước | Commit | Nội dung |
|---|---|---|
| Baseline | `6663a36` (`origin/main`) | `test:platform` 11/11 pass — `evidence/00-baseline-platform.log` |
| Spec | `0de91b4` | `01-spec-and-ai-plan.md` |
| Red | `5904f39` | Test + stub planner; chưa có route |
| Green | `95f1e98` | Patch: planner, service, validator, controller, route (+201/−3 dòng source) |
| Mutation | `5e563b3` | `test/mutation/run-mutants.mjs`, IT-R2 sau khi M10 sống sót |
| Flaky/Load | `f3afbcf` | `test/flaky/…`, `test/load/…`, test strategy, README |
| Mutant tạm | `918b128` trên `mutant/bt3-m1-invert-student-guard` | **Không** nằm trong nhánh nộp bài |

## 2. Test-first: fail → patch → pass

**Red (`5904f39`)** — `evidence/01-red-unit.log`, `01-red-integration.log`:

- Unit 0/10 pass. Lý do đúng: stub trả `results: []` →
  `actual: undefined, expected: { row: 1, userId: '…a1', outcome: 'created' }`.
- Integration 1/9 pass. 8 test fail với `{"code":"error","message":"Không tìm thấy đường dẫn!"}`
  (endpoint chưa tồn tại). IT-R1 pass — đúng kỳ vọng, vì đó là characterization test khóa
  behavior cũ trước khi sửa.
- **Phát hiện test yếu:** bản đầu của IT-05 *pass* ở trạng thái red (`01a-red-integration-weak-IT05.log`)
  vì 404 "route chưa tồn tại" trùng mã với 404 "course đã xóa". Đã thêm assert message
  `"Không tìm thấy môn học!"` (và `"Không đủ quyền!"` cho IT-03) trước khi viết code.

**Review diff AI trước khi chấp nhận** (4 lớp theo Lecture 06):

- *Scope*: chỉ 5 file tenant-service + `package.json` (script). Không đụng `index.ts`, `tenant.helper.ts`, multer, `enrollStudent`.
- *Design*: logic quyết định nằm trong hàm thuần; service chỉ nạp dữ liệu, gọi planner, `bulkWrite`.
- *Correctness*: `typecheck` báo lỗi kiểu ở `bulkWrite` (`status: string` không gán được cho `EnrollmentStatus`) → sửa bằng kiểu `AnyBulkWriteOperation<ICourseEnrollment>`; giữ guard `status: { $nin: ["active","completed"] }` trong filter để `bulkWrite` không ghi đè enrollment active/completed nếu kế hoạch bị cũ.
- *Operability*: lỗi theo dòng trả trong `results`; lỗi hạ tầng vẫn đi qua `errorResponse` (500, không lộ stack).

**Green (`95f1e98`)** — unit 10/10, integration 9/9 (`02-green-*.log`); `npm test` toàn repo
41/41 (8 + 2 + 1 + 11 + 10 + 9) và `npm run typecheck` pass (`03-*.log`).
Sau `5e563b3` integration là 10/10 (thêm IT-R2).

## 3. Mutation — "Who tests the tests?"

Mutation bắt buộc (đảo điều kiện true/false trong business rule) trên nhánh tạm
`mutant/bt3-m1-invert-student-guard` (`918b128`):

```diff
-    if (!context.activeStudentIds.has(base.userId))
+    if (context.activeStudentIds.has(base.userId))
```

Kết quả (`04-mutant-M1-*.log`): **bị kill** bởi 8/10 unit test (U-ST1…U-ST6, U-N2, U-SUM) và
6/9 integration test. `test:platform` 11/11 vẫn pass → suite cũ không thể bảo vệ tính năng mới.
Đáng chú ý: **U-INV (test bất biến dạng metamorphic) vẫn pass** dưới mutant, vì nó so dòng
hợp lệ "trong lô hỗn hợp" với "khi chạy riêng" — cả hai cùng sai như nhau. Test bất biến
chỉ có giá trị khi đi kèm test trạng thái tường minh.

Mở rộng bằng `test/mutation/run-mutants.mjs` (mỗi mutant đảo đúng một điều kiện, tự khôi phục source):

| Mutant | Business rule bị đảo | Lần 1 | Sau bổ sung |
|---|---|---|---|
| M1 | Chỉ student active được ghi danh (planner) | KILLED (unit 8, import 6) | KILLED |
| M2 | active → skipped | KILLED | KILLED |
| M3 | completed là trạng thái cuối | KILLED | KILLED |
| M4 | Trùng trong lô: lần đầu thắng | KILLED | KILLED |
| M5 | Chỉ `bulkWrite` khi có dòng hợp lệ (service) | KILLED (**chỉ** integration) | KILLED |
| M6 | Course xóa mềm → 404 (service) | KILLED (chỉ integration) | KILLED |
| M7 | [cũ] Ghi danh đơn lẻ trùng → 409 | KILLED (import 1, platform 2) | KILLED |
| M8 | [cũ] Course không active thì không truy cập | KILLED (platform 2) | KILLED |
| M9 | [cũ] Student không upload/xóa tài liệu | KILLED (platform 2) | KILLED |
| M10 | [cũ] Thêm lại member đang active → 409 | **SURVIVED** | KILLED (IT-R2) |

M10 sống sót (`05-mutation-M10-before.log`): không test nào khóa rule "member active không
được `add` lại để đổi vai trò ngầm" — mà vai trò này chính là guard của import. Đã thêm IT-R2,
IT-R2 pass trên code đúng, rồi chạy lại: M10 bị kill (`05-mutation-M10-after.log`). Lần chạy
cuối 10/10 KILLED (`05-mutation-run-final.log`). Không mutant nào còn trong nhánh nộp
(`git diff` sạch sau mỗi lần chạy).

## 4. Coverage trong context

| Đối tượng | Công cụ | Line | Branch |
|---|---|---|---|
| `enrollment-import.helper.ts` (chỉ unit) | `node --experimental-test-coverage` | 96.43 % | 94.44 % |
| `enrollment-import.helper.ts` (integration) | `NODE_V8_COVERAGE` + c8 | 100 % | 94.11 % |
| `CourseService.importEnrollments` (integration) | c8 lcov, dòng 293–356 | 64/64 = 100 % | 10/10 |
| `course.service.ts` cả file (integration) | c8 | 62.59 % | 69.38 % |

Diễn giải: "dòng chưa phủ" 21–22 và 66 của báo cáo unit là khai báo `type` và
`seen.add(...)` — dòng 66 chắc chắn chạy (U-N2 phụ thuộc nó); đây là sai lệch source-map của
tsx, minh họa coverage là số đo công cụ chứ không phải sự thật. Ngược lại 100 % line của
`importEnrollments` **không** chứng minh guard `$nin` trong filter `bulkWrite` có tác dụng:
bỏ guard đó thì 20/20 test import vẫn pass (`06-guard-nin-removed.log`) — đó là code phòng thủ cho race, chưa có test kích hoạt.

Risk coverage theo AC: AC1 (U-SUM, IT-01, IT-04), AC2 (U-N1, U-N2, U-INV, IT-01), AC3
(U-ST1…6, IT-02, IT-07), AC4 (IT-03, IT-04, IT-05), AC5 (IT-R1, IT-R2, `test:platform` 11,
M7–M10), NFR1 (L-01), NFR2 (IT-06, IT-08), NFR3 (IT-R1 413, IT-03). Mọi AC/NFR có ít nhất
một test fail được khi rule tương ứng bị đảo (trừ guard `$nin` nói trên).

## 5. Flaky-test review

`bash test/flaky/run-flaky-checks.sh 10 20` → **42/42 PASS** trong 2 phút 28 giây (`07-flaky-checks.log`).

| Nguy cơ | Cách kiểm tra | Kết quả / biện pháp |
|---|---|---|
| ORDER / shared state | Chạy riêng từng test (10 lần chạy `--test-name-pattern`) | Pass cả 10. Mỗi test seed tenant riêng (ObjectId + `bt3-<uuid>`), không có test nào dựa vào dữ liệu test trước |
| CONCURRENCY | IT-08 lặp 20 lần (5 lô đồng thời, transaction retry) | 20/20 pass; test assert unique index tồn tại trước khi chạy để không "pass may mắn" khi index chưa build |
| TIME | Suite dưới `TZ=Pacific/Kiritimati` (UTC+14) và `Etc/GMT+12` (UTC−12) | Pass. Dữ liệu dùng mốc ISO có `Z`; assert `enrolledAt > 2026-01-01Z` thay vì so với "bây giờ" |
| REPEAT | Toàn suite lặp 10 lần | 10/10 pass |
| NETWORK (rủi ro còn lại) | Phân tích | `freePort()` có khoảng hở TOCTOU giữa đóng và mở cổng; fail point MongoDB của IT-06 là toàn server → chỉ an toàn vì chạy `--test-concurrency=1` và tắt trong `finally` |

## 6. Kiểm chứng tải (40 tác vụ đồng thời, p95 ≤ 1.5 s)

Harness: `npm run load:import` — Auth + Tenant thật, mỗi tác vụ 25 dòng (20 student hợp lệ
mới, 3 sai định dạng, 2 không phải student), 1 vòng warm-up + 5 vòng đo × 40 = 200 mẫu/kịch bản.

| Kịch bản | Lần chạy | p50 | p95 | p99 | max | Lỗi | Dòng hợp lệ mất |
|---|---|---|---|---|---|---|---|
| S1 – 40 tenant độc lập | 1 | 193 ms | **232 ms** | 234 ms | 235 ms | 0 | 0 / 4 800 |
| S1 | 2 | 196 ms | 239 ms | 241 ms | 243 ms | 0 | 0 |
| S2 – 40 course cùng 1 tenant | 1 | 805 ms | **1 078 ms** | 1 095 ms | 1 101 ms | 0 | 0 / 4 800 |
| S2 | 2 | 840 ms | 1 118 ms | 1 149 ms | 1 164 ms | 0 | 0 |
| S2 thăm dò 80 tác vụ | 1 | 3 017 ms | 4 015 ms | 4 105 ms | 4 133 ms | 0 | 0 |

Kết luận: **đạt** mục tiêu ở 40 tác vụ cho cả hai kịch bản. Kịch bản xấu nhất (S2) còn
khoảng 25–28 % dư địa và suy giảm phi tuyến: gấp đôi tải → p95 gấp ~3.7 lần, vì mọi
transaction `withTenant` cùng `$inc` một document tenant nên bị tuần tự hóa qua write-conflict
+ retry. Giới hạn kết luận: một máy chạy cả load generator, MongoDB và 2 service; MongoDB
in-memory 1 node (không có độ trễ mạng/replication thật); dữ liệu nền nhỏ (vài nghìn bản ghi);
chỉ đo endpoint import, không trộn tải chat/upload. Số liệu là cận dưới lạc quan cho môi trường thật.

## 7. Traceability

| AC / Risk | Test case | Test file | Commit | Kết quả |
|---|---|---|---|---|
| AC1 | U-SUM, IT-01, IT-04 | `test/unit/enrollment-import.test.ts`, `test/enrollment-import.integration.ts` | `5904f39` → `95f1e98` | Red → Pass |
| AC2 / R2 / invariant | U-N1, U-N2, U-INV, IT-01 | như trên | `5904f39` → `95f1e98` | Red → Pass; M1, M4 killed |
| AC3 / R3 | U-ST1…U-ST6, IT-02, IT-07 | như trên | `5904f39` → `95f1e98` | Red → Pass; M1–M3 killed |
| AC4 / R6 | IT-03, IT-04, IT-05 | `test/enrollment-import.integration.ts` | `5904f39` (IT-05 sửa trước patch) → `95f1e98` | Red → Pass; M6 killed |
| AC5 / R1 (VT-004) | IT-R1, IT-R2, `test:platform` | `test/enrollment-import.integration.ts`, `test/platform.integration.ts` | `5904f39`, `5e563b3` | Pass trước & sau patch; M7–M10 killed |
| NFR2 / R4, R5 | IT-06, IT-08 | `test/enrollment-import.integration.ts` | `5904f39` → `95f1e98` | Red → Pass; IT-08 20/20 |
| NFR1 / R7 | L-01 | `test/load/enrollment-import.load.ts` | `f3afbcf` | p95 232 ms / 1 078 ms ≤ 1 500 ms |

## 8. AI Usage Log

| # | Công cụ | Prompt chính (tóm tắt) | Output được dùng | Thay đổi / bác bỏ | Evidence |
|---|---|---|---|---|---|
| 1 | Claude Code (Claude Opus 5.5), VS Code | "Chưa sinh code; trả slice, assumptions A1..An, file dự định, risk & test strategy" (nguyên văn ở `01-spec-and-ai-plan.md` §2) | Slice import ghi danh, A1 | Bác bỏ A2–A6, sửa A7 bằng dòng code cụ thể | `01-spec-and-ai-plan.md` §4 |
| 2 | Claude Code | "Viết test trước theo bảng T1–T6, negative, failure path qua HTTP thật; test phải fail trước khi có code" | Unit + integration test, harness | IT-05 pass sai lý do → thêm assert message cho IT-05, IT-03 | `01a-…weak-IT05.log`, `01-red-*.log` |
| 3 | Claude Code | "Hiện thực plan v2, chỉ sửa 5 file đã duyệt, không đổi behavior cũ" | Planner, service, route, validator, controller | Sửa lỗi kiểu `bulkWrite`; giữ guard `$nin`; kiểm tra diff chỉ có formatting ở file test | `95f1e98`, `03-typecheck.log` |
| 4 | Claude Code | "Tạo mutant đảo true/false cho rule mới và rule cũ liên quan, tự khôi phục source" | `run-mutants.mjs` | M10 sống sót → thêm IT-R2 | `05-mutation-*.log` |
| 5 | Claude Code | "Load harness 40 tác vụ, tính p50/p95/p99, kiểm tra không mất dòng" | `enrollment-import.load.ts` | Thêm kịch bản S2 (cùng tenant) sau khi đọc `withTenant`; thêm thăm dò 80 tác vụ | `08-load-*.json` |
| 6 | Claude Code | "Soạn báo cáo từ log, không thêm số liệu không có trong evidence" | Bản nháp tài liệu | Sinh viên đối chiếu từng số với log trước khi nộp | `evidence/` |

### Hai điểm AI-generated trông hợp lý nhưng chưa đáng tin ngay

1. **IT-05 bản đầu** (`expect 404` khi course đã xóa) pass ngay cả khi endpoint chưa tồn tại —
   assert mã trạng thái nhưng không assert *nguồn* của lỗi. Nếu không chạy red trước, test này
   sẽ được tính là "phủ AC4" trong khi không kiểm tra gì.
2. **U-INV** (test bất biến "dòng lỗi không đổi outcome dòng hợp lệ") trông là test mạnh nhất,
   nhưng sống sót trước mutant M1 vì so sánh hai lần chạy cùng sai. Ngoài ra dữ liệu seed của
   IT-07 dùng member `status: "revoked", deleted: false`, trong khi `revokeMember` thật đặt
   `deleted: true` → test đúng về guard nhưng chưa tái hiện đúng trạng thái sản xuất.

## 9. Reflection

Confidence của tôi tăng không phải vì số test pass mà vì các test đã chứng minh được
khả năng thất bại. Trước khi có code, 18 test mới fail đúng lý do, test còn lại là characterization cố ý
pass; IT-05 từng pass sai lý do và chỉ lộ ra nhờ bước red. Sau patch, toàn bộ 41 test của repository pass, gồm 11 test
platform có sẵn, nghĩa là risk trọng tâm của VT-004 – một thay đổi nhỏ làm hỏng behavior cũ –
được kiểm tra bằng chính bộ regression của nhóm cộng với hai characterization test. Mutation
cho tôi bằng chứng mạnh hơn coverage: cả mười mutant đảo điều kiện đều bị bắt, và mutant
M10 sống sót đã chỉ ra lỗ hổng ở rule membership mà import phụ thuộc. Việc tách
quyết định vào một hàm thuần giúp state transition testing tường minh: mỗi transition có một
test, mỗi transition bị cấm có một test riêng, và integration test nối các trạng thái thật qua
API cũ.

Những điều vẫn chưa được chứng minh: guard `$nin` trong `bulkWrite` chưa có test nào kích hoạt,
nên tôi chỉ tin vào lập luận chứ chưa có bằng chứng rằng nó ngăn được race giữa lúc đọc và lúc
ghi. Kết quả tải chỉ đúng cho một máy, MongoDB in-memory một node và dữ liệu nhỏ; ở 80 tác vụ
cùng tenant p95 đã lên khoảng 4 giây, cho thấy thiết kế khóa theo `tenant.revision` là nút cổ
chai. Endpoint ghi danh đơn lẻ cũ vẫn kích hoạt lại enrollment `completed`, khác với rule
của import; đây là một mâu thuẫn nghiệp vụ cần nhóm quyết định. Route mới cũng chưa có
contract OpenAPI.

Test tiếp theo có giá trị cao nhất là một integration test tranh chấp có kiểm soát: chạy import
và `unenroll`/`revokeMember` đồng thời cho cùng sinh viên, lặp nhiều lần, rồi assert không sinh
viên nào bị thu hồi mà vẫn có enrollment `active`. Test này nhắm đúng giao điểm giữa risk
VT-004, contract với `canAccessCourse` và guard `$nin` chưa được chứng minh.
