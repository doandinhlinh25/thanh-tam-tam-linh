# BT3 – VT-004 · Import ghi danh hàng loạt (Nguyễn Trung Thành – 23001935)

Change request: *Thêm chức năng import dữ liệu hàng loạt; bản ghi lỗi không được làm mất các
bản ghi hợp lệ.* Slice: `POST /admin/tenant/:tenantId/courses/:courseId/enroll/import`
trong `services/tenant-service`.

- Baseline: `origin/main` @ `6663a36`
- Nhánh nộp bài: `bt3/23001935-vt004-bulk-enrollment-import`
- Mutant tạm (không merge, không nằm trong nhánh nộp): `mutant/bt3-m1-invert-student-guard` @ `918b128`

## Yêu cầu môi trường

- Node.js ≥ 22 (đã chạy với v24.14.0), npm.
- Không cần MongoDB cài sẵn: `mongodb-memory-server` tự tải MongoDB 7.0.24 lần đầu (cần mạng).
- Linux/macOS; các test spawn Auth + Tenant service trên cổng ngẫu nhiên của `127.0.0.1`.

## Cách chạy

```bash
npm ci
npm run build                     # build @saas/common, @saas/http (service phụ thuộc dist/)

npm run test:import:unit          # 10 unit test – bảng chuyển trạng thái (state transition)
npm run test:import:integration   # 10 API test – Auth + Tenant + MongoDB replica set thật
npm run test:import               # cả hai
npm run test:platform             # 11 regression test có sẵn của nhóm
npm test                          # toàn bộ (build + mọi suite)

node test/mutation/run-mutants.mjs        # 10 mutant đảo true/false, tự khôi phục source
node test/mutation/run-mutants.mjs M1     # chạy 1 mutant
bash test/flaky/run-flaky-checks.sh 10 20 # isolation, IT-08 x20, 2 múi giờ, suite x10
npm run load:import                       # 40 tác vụ đồng thời, so p95 với 1.5 s
```

Coverage:

```bash
node --import tsx --test --experimental-test-coverage \
  --test-coverage-include='services/tenant-service/helpers/enrollment-import.helper.ts' \
  test/unit/enrollment-import.test.ts
NODE_V8_COVERAGE=/tmp/bt3-v8cov npm run test:import:integration
npx c8@10 report --temp-directory /tmp/bt3-v8cov --reporter text --include 'services/tenant-service/**'
```

## API

```http
POST /admin/tenant/{tenantId}/courses/{courseId}/enroll/import
Cookie + X-CSRF-Token + Origin (như các route admin khác); quyền: tenant_owner | tenant_admin
Content-Type: application/json

{ "rows": [ { "userId": "<ObjectId 24 hex>" }, ... ] }   // 1..500 dòng
```

Response 200 (kể cả khi có dòng bị từ chối):

```json
{
  "code": "success",
  "message": "Import ghi danh hoàn tất!",
  "results": [
    { "row": 1, "userId": null, "outcome": "rejected", "reason": "invalid_user_id" },
    { "row": 2, "userId": "…", "outcome": "created" }
  ],
  "summary": { "total": 2, "created": 1, "reactivated": 0, "skipped": 0, "rejected": 1 }
}
```

`outcome`: `created` (NONE→active), `reactivated` (dropped→active), `skipped`
(`already_active`), `rejected` (`invalid_user_id`, `duplicate_in_batch`,
`not_active_student`, `enrollment_completed`). Lỗi cấp request: 400 (rows rỗng/không phải
mảng/> 500), 403 (không phải owner/admin), 404 (course không tồn tại/đã xóa), 500 (lỗi hạ
tầng → rollback cả lô).

## Tài liệu và evidence

| File | Nội dung |
|---|---|
| `01-spec-and-ai-plan.md` | Problem statement, AC, NFR, invariant, prompt, AI plan v1, review bác bỏ, plan v2 |
| `02-test-strategy.md` | Risk register, phân bổ level, state transition model, bảng test cases |
| `03-verification-report.md` | Fail→pass, mutation, coverage, flaky, load, traceability, AI usage log, reflection |
| `evidence/00-*` | Baseline: build + `test:platform` 11/11 trước khi sửa |
| `evidence/01-*` | Red: test fail đúng lý do trước patch (kèm bản IT-05 pass sai lý do) |
| `evidence/02-*`, `03-*` | Green sau patch; full `npm test`; typecheck |
| `evidence/04-*`, `05-*` | Mutant M1 trên nhánh tạm; chạy 10 mutant; M10 sống sót → thêm IT-R2 → bị kill |
| `evidence/06-*` | Coverage unit + integration |
| `evidence/07-*` | Flaky checks |
| `evidence/08-*` | Kết quả load 40 tác vụ đồng thời |
