# P07-shared — SCOUT (R0)

## 1. Yêu cầu và phạm vi

Theo `docs/prompts/ai01/linh/Thanh-Tam-Bo-Prompt-Nhieu-AI-R0-R1-v1.1/thanh-tam-bo-prompt-multi-ai-v1.1/R0-on-dinh-hien-trang/P07-shared-prompt-v1.0.md`: chỉ khảo sát shared packages đã triển khai, nêu 3–6 vấn đề, không sửa code hoặc mở rộng nghiệp vụ. Vùng sửa code ở stage sau chỉ gồm `packages/common/**`, `packages/http/**`, `contracts/openapi/common.yaml`. Kiến trúc V4 tại `docs/architecture/document.pdf` là TO-BE; R0 không di trú DB, mở route hoặc thay response phá tương thích.

## 2. Git và cấu trúc

- **Đã xác minh:** nhánh `Linh`, HEAD `63065d4`; baseline PDF là `6663a36`. Worktree chính tại `C:/Users/User/MyProjects/thanh-tam-tam-linh`; có worktree khác tại `C:/Users/User/.codex/worktrees/f1ab/thanh-tam-tam-linh`. `git branch -vv` cho thấy `Linh` track `origin/Linh`, nhưng không xác minh remote mới nhất.
- **Đã xác minh:** trước SCOUT có sửa đổi/untracked ở docs và `output/`; ba vùng code P07 không có diff (`git status --short packages/common packages/http contracts/openapi/common.yaml`). Không ghi đè các file đó.
- **Đã xác minh:** `packages/common/src/index.ts` xuất `ApiResponse<T>`, `success`, `failure`, `formatInstant`, `parseInstant`. `packages/http/src/index.ts` xuất `HttpError`, `isValidPort`, `createServiceApp`, `registerErrorHandler`, `startService`. `contracts/openapi/common.yaml` chỉ có schemas, `paths: {}`. Tests hiện ở `packages/common/test/contracts.test.js`, `packages/http/test/http.test.js`.
- **Đã xác minh:** `docs/development/coding-conventions.md` quy định technical DTO/formatter và HTTP setup/mapping trong shared packages; public API có JSDoc; tránh hard-code và domain logic.

## 3. Những vấn đề/rủi ro quan sát được

| Ưu tiên | Bằng chứng AS-IS | Đề xuất trong phạm vi P07 | Kiểm thử cần có |
| --- | --- | --- | --- |
| 1 | `packages/common/src/index.ts:35-44`: `failure()` chỉ kiểm truthy. `fieldErrors` là string/array cũng qua kiểm tra rồi được spread thành object, khác `Record<string,string>` và OpenAPI. | Kiểm tra runtime hình dạng các trường mà không đổi chữ ký/hợp đồng hợp lệ; chốt mức nghiêm ngặt ở PLAN. | Regression với `fieldErrors` null, array, string, value không phải string; lỗi TypeError và input hợp lệ. |
| 2 | `packages/common/src/index.ts:65-75`: `parseInstant()` dùng regex và `Date`; chưa kiểm canonical round-trip. JavaScript có thể chuẩn hóa ngày không tồn tại như 30/02 thành ngày khác. | Xác định quy tắc timestamp hợp lệ, tránh đổi hành vi timestamp hợp lệ hiện có. | Test ngày lịch không tồn tại, offset, giây/millisecond và timestamp hợp lệ. |
| 3 | `packages/http/src/index.ts:20-34,70-78`: `HttpError.status` không được kiểm tra. Nếu constructor nhận status ngoài 100–599, `response.status()` có thể ném và error boundary không còn trả envelope. Đây là rủi ro đầu vào nội bộ, chưa thấy call site service hiện tại dùng `new HttpError`. | Kiểm tra status ở constructor hoặc boundary, giữ chữ ký; chỉ thực hiện nếu PLAN chấp thuận giá trị mặc định/lỗi. | Test status không hợp lệ và lỗi `HttpError` hợp lệ. |
| 4 | `packages/http/test/http.test.js` chỉ kiểm JSON/404; chưa kiểm nhánh `HttpError`, lỗi không xác định, hoặc không lộ thông tin lỗi. | Bổ sung regression cho error mapping đang có, không thêm endpoint. | HTTP 4xx có `errorCode`/`fieldErrors`; 500 dùng `INTERNAL_ERROR` và không lộ exception message. |
| 5 | `contracts/openapi/common.yaml`: `ApiSuccessResponse.error` và `ApiFailureResponse.data` chỉ `nullable: true`, không ràng buộc null thực; runtime `success`/`failure` luôn trả null ở vị trí tương ứng. | Ghi rõ độ lệch schema/runtime; nếu chỉnh schema, cần kiểm tương thích OpenAPI 3.0.3 và consumer trước. Không thêm paths. | Parse contract và kiểm schema với mẫu thành công/thất bại; xác nhận `paths` vẫn rỗng. |
| 6 | Legacy Auth/Tenant trả `{code, message}` hoặc `{code, account}` (`services/auth-service/helpers/error.helper.ts`, `controllers/internal.controller.ts`, `services/tenant-service/helpers/error.helper.ts`, `controllers/internal.controller.ts`); Chat `app/schemas/common.py` dùng `success`/`code`, trong khi shared contract dùng `successful`/`errorCode`. Document Java `dto/response/ApiResponse.java` gần khớp. | Chỉ báo điều phối viên/owner các service; không sửa ngoài P07 hay đổi shared envelope để che lệch. | Contract tests theo từng service do owner thực hiện trước khi tích hợp. |

## 4. Baseline và giới hạn

- **PASS:** `npm run build --workspace @saas/common`; `npm run build --workspace @saas/http`; `npm run typecheck` cho từng workspace; `node --test packages/common/test/contracts.test.js packages/http/test/http.test.js` — 3/3 tests pass. Build tạo `dist` theo script dự án; Git không báo diff trong vùng P07.
- **NOT RUN:** root `npm test` vì gồm platform integration ngoài phạm vi và cần MongoDB/SMTP tạm. Không có kết quả E2E hay production.
- **Unknown:** consumer ngoài repo, semantics timestamp được khách hàng chấp thuận, remote HEAD hiện tại. Mọi đổi validation chặt hơn có thể ảnh hưởng caller; cần PLAN mô tả non-breaking và rollback.

## 5. Bước tiếp theo

Dừng ở SCOUT. Đề nghị PLAN riêng cho P07: ưu tiên regression error mapping, kiểm input `failure` và timestamp; chốt phạm vi chỉnh OpenAPI sau khi soát consumer. Chưa sửa source, contract, service, DB; chưa commit/push/merge.
