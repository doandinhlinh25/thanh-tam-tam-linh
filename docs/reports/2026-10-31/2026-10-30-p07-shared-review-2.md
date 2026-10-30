# P07-shared — REVIEW lần 2 (2026-10-31)

- Nhánh/baseline: `Linh` / `63065d4`; kiểm tra diff chưa commit và các báo cáo TEST.
- Quyết định duy nhất: **REQUEST CHANGES**.

## Phạm vi thực tế

Ba file code/test P07 trong Git diff là `packages/common/src/index.ts`, `packages/common/test/contracts.test.js`, và `packages/http/test/http.test.js` (file thứ ba đối chiếu với plan và diff). Không có diff ở `contracts/openapi/common.yaml`, service, database hoặc migration; không có staged diff. `git diff --check` exit 0. Working tree còn sửa đổi tài liệu assignment và nhiều file untracked đã tồn tại trước P07; không quy chúng cho P07 hay đụng tới.

## Phát hiện theo mức độ

### Medium — Confirmed defect: getter làm thay đổi giá trị sau validation

- **Vị trí:** `packages/common/src/index.ts`, `failure()` tại đoạn `Reflect.ownKeys(...).every(...)` và spread `fieldErrors` sau đó.
- **Vấn đề:** validation đọc `fieldErrors[fieldKey]` một lần; object spread đọc lại getter. Plain object có getter trả chuỗi ở lần đầu và số ở lần sau được chấp nhận, rồi response chứa số. Điều này vi phạm AC2: mọi giá trị được nhận phải là chuỗi và dữ liệu sai không được đi qua một cách âm thầm.
- **Tác động:** object nội bộ mang giá trị khác với giá trị đã được kiểm; JSON response có thể chứa dữ liệu sai. Chưa thấy caller P07 hiện tại dùng getter, nên không suy ra lỗi production.
- **Tái hiện:** chạy `node -e` với `const fields={get email(){ reads+=1; return reads===1?'Required':42; }}; failure({errorCode:'E',errorMessage:'message',fieldErrors:fields})`. Kết quả thực: `accepted number 42 reads 2`, không có `TypeError`. Lệnh exit 0. TEST lần 3 và regression hiện có không thử accessor thay đổi giá trị.
- **Đề xuất nhỏ nhất:** tạo snapshot `fieldErrors` trong một lượt duyệt các own keys và dùng chính snapshot đã xác minh để trả về, hoặc từ chối accessor nếu nhóm xác nhận contract chỉ chấp nhận data properties. Thêm regression getter đổi giá trị, giữ chữ ký, envelope, plain/null-prototype records và frozen behavior.

## Ma trận acceptance criteria

| AC | Kết luận REVIEW | Bằng chứng |
| --- | --- | --- |
| AC1 — build/typecheck | PASS theo TEST lần 3 | Bốn lệnh cho common/http exit 0; REVIEW không báo toàn repo PASS. |
| AC2 — validation/regression | **FAIL** | Date/Map/Set, Symbol số/chuỗi/không enumerable và string key không enumerable đã có regression và bị từ chối. Getter biến đổi giữa validation và spread vẫn đưa số vào response; tái hiện trực tiếp. |
| AC3 — chữ ký/envelope/tương thích hợp lệ | PASS với đầu vào thông thường | Diff giữ `failure(errorResponse: ApiErrorResponse): ApiResponse<never>`, các khóa `successful/data/error`, `success()`, timestamp hợp lệ; error và `fieldErrors` vẫn frozen. Lỗi getter là ngoại lệ chưa đạt AC2. |
| AC4 — contract | PASS | `common.yaml` không đổi và YAML parse cho `paths {}`. |
| AC5 — phạm vi | PASS | Git diff P07 chỉ có ba file trong plan; các thay đổi khác có trước và được bảo toàn. |

## Implementation, test và tích hợp

`Reflect.ownKeys()` hiện phát hiện đúng Symbol kể cả không enumerable; prototype guard loại Date/Map/Set/Array và custom prototype. Kiểm enumerable loại thuộc tính chuỗi không enumerable. Với plain object chứa các data properties chuỗi thông thường và null-prototype object, response giữ nội dung, envelope và bản sao frozen. Không thấy logic domain, dependency mới hay thay đổi `@saas/http` source. `@saas/http` dùng `failure()` với plain `fieldErrors`; focused test REVIEW chạy lại **5/5 PASS**. Regression mới có khả năng bắt hai lỗi P07 đã phát hiện trước đây, nhưng không bắt việc cùng một getter bị đọc hai lần. TEST lần 3 ghi common **4/4**, P07 **5/5**, bốn build/typecheck PASS và `git diff --check` PASS; đây là bằng chứng thực, song chưa đủ cho ca getter trên.

## Rủi ro, kiểm tra chưa chạy và điều kiện tích hợp

Root `npm test` vẫn **NOT RUN** theo ngoại lệ tùy chọn trong plan vì cần MongoDB replica set/SMTP; không tuyên bố toàn repository hay production PASS. `HttpError.status`, nullable OpenAPI và envelope legacy của các service là mục hoãn có sẵn, không mở rộng P07. Không phát hiện thay đổi ngoài phạm vi hoặc mất dữ liệu người dùng.

**REQUEST CHANGES:** chưa đủ điều kiện nghiệm thu AC2. Trước khi tích hợp nhánh chính, sửa đúng việc đọc lại getter trong phạm vi `packages/common`, thêm regression, chạy TEST và REVIEW lại đạt; sau đó cần quyết định/ủy quyền riêng của người điều phối cho commit, PR hoặc merge. REVIEW này chỉ ghi báo cáo và handoff, không sửa code hoặc test.
