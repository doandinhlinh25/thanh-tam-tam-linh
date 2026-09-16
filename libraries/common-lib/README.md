# common-lib

`common-lib` là thư viện Java dùng chung nội bộ cho các microservice của dự án. Module hiện cung cấp hai nhóm tiện ích:

- Response envelope thống nhất qua `ApiResponse<T>` và `ApiErrorResponse`.
- Chuyển đổi ngày giờ ISO-8601 tại API boundary qua `ApiDateTimeFormatter`.

Thư viện chỉ chứa DTO kỹ thuật và formatter thuần Java. Không đưa entity, repository, service, business rule, database driver hay code phụ thuộc framework vào module này.

## Yêu cầu và cách thêm dependency

Project sử dụng Java 21. Với một service nằm trong Maven reactor của dự án, thêm dependency sau vào `pom.xml` của service:

```xml
<dependency>
    <groupId>org.example</groupId>
    <artifactId>common-lib</artifactId>
    <version>${project.version}</version>
</dependency>
```

Build riêng module:

```powershell
.\mvnw.cmd -pl libraries/common-lib package
```

## Quy ước chung

- Controller trả cùng một kiểu envelope: `ApiResponse.success(...)` khi thành công hoặc `ApiResponse.failure(...)` khi thất bại.
- Exception handler của từng service là nơi tạo `ApiErrorResponse`; controller không tạo một response lỗi với cấu trúc khác.
- Chỉ dùng `ApiDateTimeFormatter` ở ranh giới API (request, response, query/path parameter) để giữ định dạng nhất quán.
- Các phương thức trong thư viện không nhận `null`. Ngoại lệ là dữ liệu của `ApiResponse.success(...)` có thể là `null` nếu API đó cố ý không có payload.

## `ApiResponse<T>`

Package: `org.example.saas.commonlib.dto.response`

`ApiResponse<T>` là lớp `final` bọc kết quả trả về của API. Một instance chỉ ở một trong hai trạng thái:

| Trạng thái | `isSuccessful()` | `getData()` | `getError()` |
| --- | --- | --- | --- |
| Thành công | `true` | payload kiểu `T` (có thể `null`) | `null` |
| Thất bại | `false` | `null` | `ApiErrorResponse` không `null` |

Không có public constructor. Hãy tạo instance bằng các factory method bên dưới.

### `success(T responseData)`

Tạo response thành công. `T` được Java suy luận từ đối số; có thể truyền DTO, collection hoặc `null` cho endpoint không có body dữ liệu.

```java
TenantResponse tenant = tenantService.findById(tenantId);
ApiResponse<TenantResponse> response = ApiResponse.success(tenant);
```

Ví dụ endpoint xóa thành công nhưng không trả payload:

```java
ApiResponse<Void> response = ApiResponse.success(null);
```

### `failure(ApiErrorResponse errorResponse)`

Tạo response thất bại với chi tiết lỗi chuẩn. `errorResponse` là bắt buộc; truyền `null` sẽ ném `NullPointerException`.

```java
ApiErrorResponse error = new ApiErrorResponse(
        "TENANT_NOT_FOUND",
        "Không tìm thấy tenant.",
        Map.of());
ApiResponse<Void> response = ApiResponse.failure(error);
```

Nên gọi method này trong global exception handler thay vì rải logic dựng lỗi trong controller.

### `isSuccessful()`

Trả về `true` khi envelope được tạo bởi `success(...)`, ngược lại là `false`. Dùng để phân nhánh khi một service hoặc client xử lý object response trực tiếp.

```java
if (response.isSuccessful()) {
    process(response.getData());
} else {
    logError(response.getError().getErrorCode());
}
```

### `getData()`

Trả payload thành công kiểu `T`. Giá trị này là `null` cho response thất bại, và cũng có thể là `null` cho một success response không có dữ liệu. Vì vậy, luôn kiểm tra `isSuccessful()` trước khi diễn giải giá trị `null`.

```java
TenantResponse tenant = response.getData();
```

### `getError()`

Trả chi tiết lỗi chuẩn (`ApiErrorResponse`). Giá trị là `null` cho response thành công.

```java
ApiErrorResponse error = response.getError();
String code = error.getErrorCode();
```

## `ApiErrorResponse`

Package: `org.example.saas.commonlib.dto.response`

`ApiErrorResponse` là lớp `final` mô tả lỗi nằm trong `ApiResponse.failure(...)`. Ba thành phần của lỗi là:

| Thành phần | Ý nghĩa | Có thể `null` |
| --- | --- | --- |
| `errorCode` | Mã ổn định, dành cho máy/client xử lý | Không |
| `errorMessage` | Thông điệp dành cho người đọc | Không |
| `fieldErrors` | Lỗi validation theo tên field | Không; có thể là map rỗng |

### `ApiErrorResponse(String errorCode, String errorMessage, Map<String, String> fieldErrors)`

Tạo chi tiết lỗi bất biến. Cả ba tham số đều bắt buộc; truyền `null` cho bất kỳ tham số nào sẽ ném `NullPointerException`. `fieldErrors` được copy tại lúc tạo object, do đó thay đổi map ban đầu không làm thay đổi response.

```java
Map<String, String> validationErrors = Map.of(
        "email", "Email không đúng định dạng.",
        "name", "Tên tenant là bắt buộc.");

ApiErrorResponse error = new ApiErrorResponse(
        "VALIDATION_ERROR",
        "Dữ liệu đầu vào không hợp lệ.",
        validationErrors);
```

Với lỗi không gắn với field cụ thể, truyền `Map.of()`:

```java
ApiErrorResponse error = new ApiErrorResponse(
        "ACCESS_DENIED",
        "Bạn không có quyền thực hiện thao tác này.",
        Map.of());
```

### `getErrorCode()`

Trả mã lỗi ổn định. Client nên dựa vào giá trị này để lập trình xử lý lỗi thay vì so sánh `errorMessage`, vì thông điệp có thể được cải thiện hoặc bản địa hóa.

```java
if ("VALIDATION_ERROR".equals(error.getErrorCode())) {
    showFieldErrors(error.getFieldErrors());
}
```

### `getErrorMessage()`

Trả thông điệp mô tả lỗi dành cho log hoặc hiển thị cho người dùng, tùy chính sách của service.

```java
String message = error.getErrorMessage();
```

### `getFieldErrors()`

Trả map lỗi validation theo tên field. Map trả về là immutable: không được gọi `put`, `remove` hoặc `clear` trên map này. Khi không có lỗi field, method trả về map rỗng.

```java
String emailError = error.getFieldErrors().get("email");
```

## `ApiDateTimeFormatter`

Package: `org.example.saas.commonlib.format.datetime`

`ApiDateTimeFormatter` là utility class `final` có private constructor và chỉ có static method. Nó chuẩn hóa ba biểu diễn ISO-8601:

| Kiểu Java | Format dùng chung | Ví dụ |
| --- | --- | --- |
| `Instant` | `ISO_INSTANT` | `2026-09-16T15:30:00Z` |
| `LocalDate` | `ISO_LOCAL_DATE` | `2026-09-16` |
| `OffsetDateTime` | `ISO_OFFSET_DATE_TIME` | `2026-09-16T22:30:00+07:00` |

Không khởi tạo class này. Import static method hoặc gọi trực tiếp qua tên class:

```java
import org.example.saas.commonlib.format.datetime.ApiDateTimeFormatter;
```

Tất cả parse method sẽ ném `NullPointerException` khi input là `null`, và ném `java.time.format.DateTimeParseException` khi chuỗi không đúng định dạng tương ứng.

### `formatInstant(Instant instantValue)`

Chuyển `Instant` sang chuỗi UTC chuẩn `ISO_INSTANT` với hậu tố `Z`.

```java
String value = ApiDateTimeFormatter.formatInstant(
        Instant.parse("2026-09-16T15:30:00Z"));
// 2026-09-16T15:30:00Z
```

### `parseInstant(String instantValue)`

Chuyển chuỗi instant ISO sang `Instant`. Dùng cho timestamp tuyệt đối, không phụ thuộc múi giờ địa phương.

```java
Instant createdAt = ApiDateTimeFormatter.parseInstant("2026-09-16T15:30:00Z");
```

### `formatLocalDate(LocalDate localDateValue)`

Chuyển `LocalDate` sang chuỗi ngày `yyyy-MM-dd`, không kèm giờ hay timezone. Phù hợp với ngày sinh, ngày hiệu lực hoặc ngày hóa đơn.

```java
String dueDate = ApiDateTimeFormatter.formatLocalDate(LocalDate.of(2026, 9, 30));
// 2026-09-30
```

### `parseLocalDate(String localDateValue)`

Chuyển chuỗi ngày ISO `yyyy-MM-dd` sang `LocalDate`.

```java
LocalDate dueDate = ApiDateTimeFormatter.parseLocalDate("2026-09-30");
```

### `formatOffsetDateTime(OffsetDateTime offsetDateTimeValue)`

Chuyển `OffsetDateTime` sang chuỗi ISO giữ nguyên UTC offset. Dùng khi API cần thể hiện cả thời điểm lẫn offset gửi kèm.

```java
OffsetDateTime startsAt = OffsetDateTime.parse("2026-09-16T22:30:00+07:00");
String value = ApiDateTimeFormatter.formatOffsetDateTime(startsAt);
// 2026-09-16T22:30:00+07:00
```

### `parseOffsetDateTime(String offsetDateTimeValue)`

Chuyển chuỗi ISO có offset sang `OffsetDateTime`. Chuỗi đầu vào phải có thông tin offset như `Z`, `+07:00` hoặc `-04:00`.

```java
OffsetDateTime startsAt = ApiDateTimeFormatter.parseOffsetDateTime(
        "2026-09-16T22:30:00+07:00");
```

## Ví dụ luồng hoàn chỉnh

Một global exception handler có thể tạo response lỗi validation như sau:

```java
Map<String, String> fieldErrors = Map.of("email", "Email không đúng định dạng.");
ApiErrorResponse error = new ApiErrorResponse(
        "VALIDATION_ERROR",
        "Dữ liệu đầu vào không hợp lệ.",
        fieldErrors);

ApiResponse<Void> response = ApiResponse.failure(error);
```

Với endpoint thành công, chỉ bọc payload vào `ApiResponse.success(...)`:

```java
ApiResponse<TenantResponse> response = ApiResponse.success(tenantResponse);
```
