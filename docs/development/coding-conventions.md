# Quy chuẩn TypeScript cho Node.js services

Áp dụng cho mọi service trong `services/`. Mỗi service giữ cùng quy chuẩn,
nhưng sở hữu dữ liệu, entity, repository và business rule của chính mình.

## Cấu trúc và trách nhiệm

- Mỗi service dùng bố cục từ nhánh `duy-tam`: `index.ts` và các thư mục
  `configs`, `controllers`, `helpers`, `interface`, `middlewares`, `models`,
  `routes`, `services` tại gốc service. Bổ sung `dto/request`,
  `dto/response`, `repositories`, `exceptions` để giữ ranh giới rõ ràng từ Java.
- Route/controller xử lý HTTP, DTO và validation dữ liệu đầu vào.
- `dto/request` đặt kiểu dữ liệu và logic kiểm tra đầu vào cùng nhau;
  `dto/response` định nghĩa payload trả về. `models` chứa domain/persistence
  model thuộc riêng service.
- Service xử lý business rule; phương thức kiểm tra `valid` trong service luôn
  trả về `boolean`, với tên phản ánh kết quả như `hasActiveMembership`.
- `repositories` chỉ truy cập database của service hiện tại, không dùng chung
  entity hoặc repository giữa các service.
- `packages/common` chứa response envelope và formatter kỹ thuật;
  `packages/http` chứa HTTP setup và error mapping.
- Hợp đồng API/event đặt trong `contracts/openapi`.

## Không hard-code

Đặt route, HTTP status, error code, message, role, giá trị nghiệp vụ và format
ngày giờ trong constant có tên rõ nghĩa, enum hoặc cấu hình. Cổng lắng nghe lấy
từ biến môi trường `PORT`; không đặt số cổng trong source. Không tạo biến tạm
trong thân vòng lặp. Khi ghép nhiều chuỗi, dùng mảng và `join` hoặc formatter
phù hợp thay vì nối chuỗi lặp lại.

## Validation và lỗi

Validation request ở HTTP boundary, dùng logic kiểm tra đặt cùng request DTO;
service tiếp tục kiểm tra business rule.
Một hàm validation trong service trả về `boolean` và không dùng exception làm
giá trị điều khiển thông thường. Error handler HTTP chuẩn hóa lỗi thành
`ApiResponse` từ `@saas/common`; không dựng cấu trúc lỗi tùy ý trong
controller. Business error của service đặt trong `exceptions`; lỗi kỹ thuật
được bắt và chuyển tại một boundary rõ ràng, không rải
`try/catch` trong business service và không nuốt lỗi.

## Tên và tài liệu public API

Dùng tên class, function, parameter và biến mô tả mục đích. Mọi class, interface,
constructor và function export công khai cần JSDoc mô tả contract, `@param`,
`@returns` và `@throws` khi áp dụng. Comment cần giải thích ý nghĩa nghiệp vụ
hoặc side effect, không lặp lại tên hàm.

## Thời gian và dữ liệu

Dùng ISO 8601 tại API boundary qua `@saas/common`; timestamp thực tế phải có
offset/timezone. Mỗi service sở hữu database, credential, schema DBML và
migration trong `database/migrations`. Không tạo foreign key, join hay truy vấn
trực tiếp sang database service khác. Chọn công cụ migration sau khi quyết định
database engine, và cập nhật DBML cùng migration khi đổi schema.

## Xác minh

Chạy `npm run build`, `npm run typecheck` và `npm test` tại thư mục gốc.
Mỗi endpoint thành công hoặc thất bại phải theo hợp đồng response chung.
