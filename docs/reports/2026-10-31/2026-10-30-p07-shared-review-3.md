# P07-shared — REVIEW lần 3 (2026-10-31)

- Phạm vi: kế hoạch `docs/plans/2026-10-30/p07-shared.md` đã duyệt, nhánh `Linh`, HEAD `63065d4`, diff chưa commit sau COOK lần 3 và TEST lần 4.
- Đã đọc trực tiếp toàn bộ ba file code/test P07, Git diff, kế hoạch, handoff và các báo cáo REVIEW/TEST được giao. Đã kiểm lại test kết hợp và ca AC2 trọng tâm trong REVIEW này; quyết định không chỉ dựa trên báo cáo TEST.
- **Quyết định duy nhất: APPROVE** cho phạm vi P07 đã duyệt.

## Ma trận AC1–AC5

| AC và nguyên văn tiêu chí trong kế hoạch | Implementation | Bằng chứng | Kết quả |
| --- | --- | --- | --- |
| AC1: “Shared packages build and typecheck.” | `packages/common/src/index.ts`; HTTP source không sửa. | TEST lần 4 chạy bốn lệnh build/typecheck common/http, tất cả exit 0; REVIEW đối chiếu diff hiện tại và chạy lại bộ test kết hợp 5/5. | PASS |
| AC2: “Regression tests cover malformed error details, invalid/valid timestamps, known/unknown HTTP errors and pass.” | `failure()` kiểm prototype và descriptors tại `packages/common/src/index.ts:36`; `parseInstant()` kiểm ngày nguồn tại dòng 87; HTTP error mapping hiện có không sửa. | `packages/common/test/contracts.test.js` phủ malformed, Date/Map/Set, Symbol, accessor, ngày sai/hợp lệ; `packages/http/test/http.test.js` phủ 422/500/404. TEST lần 4: common 4/4, kết hợp 5/5. REVIEW chạy lại kết hợp 5/5 và ca getter/Symbol/Date/`__proto__` trực tiếp, exit 0. | PASS |
| AC3: “Public signatures and valid response envelope remain unchanged.” | `failure(errorResponse: ApiErrorResponse): ApiResponse<never>` và `success<T>` giữ nguyên chữ ký; `failure()` trả `successful: false`, `data: null`, `error` với ba trường cũ. | Diff source/type và test success/failure; kiểm trực tiếp dữ liệu frozen, khóa `__proto__` và giá trị hợp lệ. Timestamp hợp lệ được common test xác nhận. | PASS |
| AC4: “`common.yaml` remains pathless and unchanged.” | Không sửa `contracts/openapi/common.yaml`. | REVIEW parse YAML bằng `yaml`: `paths {}`; Git diff không chứa contract. | PASS |
| AC5: “No changes outside P07 ownership and own workflow artifacts.” | Chỉ common source/test và HTTP test thuộc plan. | `git status --short`, `git diff --stat`, `git diff`, `git diff --cached`, diff name-only; không có staged diff. Assignment document và các untracked khác đã có sẵn, không quy cho P07. | PASS |

## Ba nhóm lỗi AC2 đã phát hiện

1. **Kiểu dữ liệu không hợp lệ (TEST lần 1):** `failure()` chỉ lấy descriptors sau khi prototype là `Object.prototype` hoặc `null` (`index.ts:37–43`). Vì vậy Date, Map, Set, Array và custom prototype bị từ chối bằng `TypeError` trước bước tạo response. Với primitive/null/undefined, không có descriptors hợp lệ nên cũng ném `TypeError`. Unit regression có Date/Map/Set/Array; REVIEW thử lại Date trực tiếp. Không còn việc chuyển các object này thành `{}`.
2. **Symbol và thuộc tính không enumerable (REVIEW lần 1):** `Reflect.ownKeys(fieldErrorsDescriptors)` (`index.ts:49`) duyệt mọi own key, kể cả Symbol và key ẩn. Điều kiện yêu cầu khóa chuỗi và `enumerable: true`; Symbol giá trị số/chuỗi và cả Symbol ẩn đều ném `TypeError`. String key ẩn cũng bị từ chối, không bị loại bỏ âm thầm. Regression trong common test phủ các trường hợp này.
3. **TOCTOU/accessor (REVIEW lần 2):** `Object.getOwnPropertyDescriptors(fieldErrors)` tạo snapshot; validation yêu cầu own data property với giá trị chuỗi (`index.ts:50–53`). Getter, setter-only và accessor ẩn bị từ chối mà không gọi accessor. `Object.fromEntries(Object.entries(fieldErrorsDescriptors)...)` (`index.ts:58–60`) chỉ lấy giá trị đã kiểm, không đọc lại hoặc spread input. Unit test có getter đổi chuỗi sang số, getter luôn chuỗi, getter side effect và setter-only; các bộ đếm getter vẫn 0. REVIEW thử lại getter đổi giá trị, kết quả `TypeError`, 0 lần gọi. Khóa riêng `"__proto__"` được giữ như own data property của bản sao, prototype không đổi; `error` và `fieldErrors` vẫn frozen.

`Object.getOwnPropertyDescriptors()` không thực thi getter thông thường; bản sao được dựng từ cùng descriptor object đã xác minh. Không phát hiện validation thừa, đọc lại `fieldErrors` sau validation, thay đổi input, debug code, dependency mới hay framework validation mới. Việc từ chối accessor là chủ đích AC2; đầu vào hợp lệ `{}`, plain object và null-prototype object vẫn được nhận. Proxy bất thường nằm ngoài hợp đồng được duyệt và không có bằng chứng rủi ro thực tế trong caller hiện tại.

## Chất lượng kiểm thử, tương thích và hiệu lực TEST

- Date/Map/Set regression sẽ thất bại với bản `failure()` cũ vì bản đó nhận object và trả `{}`. Symbol regression sẽ thất bại với `Object.values()` cũ vì Symbol bị bỏ qua. Getter regression sẽ thất bại với lối validation rồi spread cũ vì getter bị gọi và/hoặc giá trị số đi vào response. Test hiện tại kiểm cả trường hợp hợp lệ để hạn chế từ chối nhầm. Các bước FAIL trước sửa được ghi trong handoff COOK tương ứng; REVIEW dựa vào mã và lần chạy lại hiện tại.
- TEST lần 4 ghi AC1–AC5 PASS; bốn build/typecheck PASS; common 4/4 PASS; bộ P07 5/5 PASS; `git diff --check` PASS. REVIEW chạy lại bộ P07 **5/5 PASS**, ca AC2 trực tiếp PASS, parse contract PASS và `git diff --check` exit 0. Mã/diff P07 hiện tại khớp phần implementation đã đọc tại TEST lần 4; không phát hiện thay đổi nguồn sau TEST làm vô hiệu bằng chứng. Không chạy lại bốn build/typecheck ở REVIEW; dùng kết quả độc lập của TEST lần 4 với diff hiện tại.
- `success()` không đổi trong diff; `parseInstant()` chỉ có thay đổi T2 đã duyệt để từ chối ngày lịch không tồn tại, vẫn giữ offset/fractional hợp lệ. `@saas/http` dùng `failure()` với plain `fieldErrors`; HTTP source không đổi, test 422/500/404 và success chạy đạt. Chữ ký, response envelope và `Object.freeze` của error/fieldErrors giữ nguyên.
- Root `npm test` toàn repository **NOT RUN** theo ngoại lệ tùy chọn của plan vì platform integration cần MongoDB replica set/SMTP. Không tuyên bố toàn repo hoặc production PASS.

## Git scope, findings và rủi ro

Ba file code/test thực sự đổi so với baseline: `packages/common/src/index.ts`, `packages/common/test/contracts.test.js`, `packages/http/test/http.test.js`. File HTTP test được xác định từ plan và Git diff, không suy đoán. `contracts/openapi/common.yaml`, service, database, migration, gateway, web và HTTP source không đổi. Working tree còn sửa `docs/documents/assignments/02-platform-saas-Duy-Tam.md` và nhiều untracked tài liệu/output có trước P07; không ghi đè, không nhận là thay đổi P07. Report này và handoff là workflow artifacts P07.

**Findings:** không có Confirmed defect, Concern hoặc Suggestion cần xử lý trong phạm vi AC1–AC5. Rủi ro còn lại là kiểm thử platform integration chưa chạy; `HttpError.status`, nullable OpenAPI và envelope legacy của service khác được hoãn theo plan, không phải điều kiện sửa trong P07.

## Điều kiện tích hợp

**APPROVE** P07 theo kế hoạch đã duyệt. Trước khi tích hợp nhánh chính, người điều phối cần quyết định và cấp quyền riêng cho commit/PR/merge, kiểm tra lại diff và chạy lại kiểm tra liên quan nếu mã P07 thay đổi. REVIEW này không commit, push, merge, sửa code hoặc chuyển sang nhiệm vụ khác.
