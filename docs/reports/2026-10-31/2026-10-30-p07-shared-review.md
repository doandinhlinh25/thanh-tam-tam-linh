# P07-shared — REVIEW cuối (2026-10-31)

- Nhánh / baseline: `Linh` / `63065d4`; kiểm tra diff chưa commit.
- Quyết định: **REQUEST CHANGES**.
- Căn cứ: kế hoạch P07-shared `APPROVED`, handoff, TEST FAIL ban đầu và TEST PASS lần 2; đã đọc diff mã nguồn thực tế, không chỉ dựa vào báo cáo.

## 1. Phạm vi diff và tích hợp

- Diff code P07 so với baseline chỉ gồm `packages/common/src/index.ts`, `packages/common/test/contracts.test.js`, `packages/http/test/http.test.js`, đúng các file trong plan. `contracts/openapi/common.yaml` không đổi, parse ra `paths: {}`. Không có file staged. `git diff --check` exit 0.
- Working tree có sửa đổi `docs/documents/assignments/02-platform-saas-Duy-Tam.md` và nhiều file untracked từ trước P07; không quy chúng cho P07 và không đụng tới. Không thấy thay đổi P07 ở service, web, gateway, database hay migration.
- `@saas/http` gọi `failure()` với `fieldErrors` là plain object trong error handler; các health controller dùng `success()`. Test HTTP P07 chạy 5/5 cùng common, không thấy hỏng tích hợp với caller hiện tại. Không khẳng định đã kiểm toàn hệ thống; root `npm test` là **NOT RUN** theo TEST lần 2 và là bước tùy chọn của plan.

## 2. Phát hiện

### Medium — Confirmed defect: `fieldErrors` có khóa Symbol với giá trị sai vẫn được nhận

- **Vị trí:** `packages/common/src/index.ts`, kiểm tra `Object.values(fieldErrors)` trong `failure()`.
- **Vấn đề:** prototype của plain object hợp lệ, nhưng `Object.values()` bỏ qua khóa `Symbol`; object spread sau đó lại sao chép khóa `Symbol`. Vì vậy giá trị không phải chuỗi được đưa vào `error.fieldErrors`, trái yêu cầu mọi giá trị đều là chuỗi và kiểu `Record<string, string>`.
- **Tác động:** validation runtime chưa khép kín; kết quả chứa dữ liệu sai trong bộ nhớ và giá trị đó biến mất khi JSON hóa, tạo sai khác âm thầm tại HTTP boundary. Chưa thấy caller hiện tại truyền khóa Symbol, nên không khẳng định lỗi đã xảy ra ở production.
- **Bằng chứng tái hiện:** `const key=Symbol('field'); failure({errorCode:'E',errorMessage:'message',fieldErrors:{[key]:42}})` trả về object có `error.fieldErrors[key] === 42`, không ném `TypeError`; `JSON.stringify(error.fieldErrors)` cho `{}`. Lệnh đọc/kiểm tra exit 0. Regression hiện tại không có ca Symbol.
- **Đề nghị tối thiểu:** từ chối khóa `Symbol` (và mọi thuộc tính không thể biểu diễn nhất quán trong JSON record) bằng `TypeError` trước khi spread; thêm regression chứng minh đầu vào này bị từ chối. Giữ plain/null-prototype object với các khóa chuỗi và giá trị chuỗi, chữ ký public, response envelope và frozen behavior.

## 3. Đối chiếu acceptance criteria

| AC | Kết quả REVIEW | Bằng chứng |
| --- | --- | --- |
| AC1 build/typecheck | PASS theo TEST lần 2 | Bốn lệnh build/typecheck từng workspace exit 0 trong báo cáo độc lập. |
| AC2 validation và regression | **FAIL** | TEST lần 2 có 4/4 common và 5/5 P07 test đạt, Date/Map/Set đã được sửa; kiểm tra bổ sung ở REVIEW tái hiện trường hợp Symbol có giá trị số đi qua. |
| AC3 chữ ký và envelope hợp lệ | PASS | Diff giữ `failure(errorResponse: ApiErrorResponse): ApiResponse<never>`, exports và cấu trúc `successful/data/error`; test hợp lệ và frozen đạt. Không thấy thay đổi `success()` hay format timestamp ngoài T2 đã duyệt. |
| AC4 contract pathless | PASS | Không có diff `common.yaml`; YAML parse cho `paths {}`. |
| AC5 phạm vi | PASS cho P07 | Ba file code/test thay đổi đều thuộc plan; các thay đổi khác trong working tree là tồn tại từ trước và không bị ghi đè. |

## 4. Chất lượng kiểm thử và rủi ro còn lại

- Regression Date/Map của TEST lần 2 có khả năng bắt lỗi cũ: đã thấy test thất bại trước bản sửa prototype và đạt sau bản sửa. REVIEW chạy lại focused suite: **5/5 PASS**, nhưng suite hiện chưa kiểm khóa Symbol nên không phủ toàn bộ AC2.
- Dữ liệu lỗi hợp lệ vẫn được sao chép và đóng băng; plain object và null-prototype object được nhận. Không có thay đổi API contract trong YAML. `HttpError.status`, OpenAPI nullable và envelope legacy của Auth/Tenant/Chat là vấn đề hoãn theo plan, không phải phát hiện mới của P07.
- Không chạy `npm test` toàn repo; không kết luận platform integration hoặc production readiness. Không phát hiện thêm vấn đề ở route/auth/DB vì không thuộc diff P07.

## 5. Quyết định và điều kiện tích hợp

**REQUEST CHANGES** vì AC2 còn một trường hợp sai có thể tái hiện. Để tích hợp P07 vào nhánh chính: sửa đúng đầu vào Symbol trong phạm vi `packages/common`, thêm regression, chạy lại build/typecheck/focused tests và kiểm tra diff; sau đó TEST và REVIEW lại đạt. Việc commit/PR/merge chỉ thực hiện khi người điều phối cho phép. REVIEW này chỉ thêm báo cáo và handoff, không sửa implementation.
