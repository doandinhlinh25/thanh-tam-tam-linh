# Quy chuẩn code

Áp dụng cho mọi Java service trong dự án. Mỗi service giữ cùng quy chuẩn, nhưng không chia sẻ entity, repository hoặc database.

## 1. Không hard-code

Không hard-code message, HTTP status, business value, role, route, database value, date pattern hoặc tên operation trong method. Đặt chúng trong `constant`, `enum`, `configuration` hoặc properties phù hợp của service.

```java
// Không dùng
throw new BusinessException("Tenant already exists");

// Dùng constant hoặc enum có tên rõ nghĩa
throw new BusinessException(TenantErrorCode.TENANT_ALREADY_EXISTS);
```

## 2. Validation

Validation chia thành ba lớp, không thay thế lẫn nhau.

| Vị trí | Trách nhiệm |
|---|---|
| `controller` | Dùng `@Valid` cho dữ liệu HTTP đầu vào và trả lỗi request không hợp lệ. |
| `dto/request` | Dùng Jakarta Validation như `@NotBlank`, `@Size`, `@Email`, `@Pattern`. |
| `entity` | Dùng constraint phù hợp và bảo vệ invariant khi tạo/cập nhật entity. |
| `services` | Kiểm tra business rule, tồn tại dữ liệu và quyền thao tác. Method validation trong service phải trả về `boolean`. |

```java
/**
 * Creates a tenant from a validated client request.
 *
 * @param createTenantRequest validated tenant creation input
 * @return created tenant response
 */
public TenantResponse createTenant(
        @Valid @RequestBody CreateTenantRequest createTenantRequest) {
    return tenantService.createTenant(createTenantRequest);
}
```

Tên method validation trong service phải phản ánh boolean result, ví dụ `isTenantNameAvailable`, `hasActiveMembership` hoặc `isMemberAllowedToManageTenant`.

## 3. Exception handling

Không viết `try/catch` trong business service. Mỗi service có package `exception` với `ExceptionExecutor`, `BusinessException`, technical exception và global exception handler.

`ExceptionExecutor` là nơi duy nhất bọc operation kỹ thuật bằng `try/catch`, ghi log có ngữ cảnh và chuyển exception kỹ thuật sang exception chuẩn của service. Nó không được nuốt exception hoặc chuyển mọi lỗi thành thành công.

Đề xuất API chung cho từng service:

```java
/**
 * Executes technical operations and translates unexpected failures.
 */
public final class ExceptionExecutor {

    private final ExceptionTranslator exceptionTranslator;

    /**
     * Creates an executor with the service exception translator.
     *
     * @param exceptionTranslator component that translates technical failures
     */
    public ExceptionExecutor(ExceptionTranslator exceptionTranslator) {
        this.exceptionTranslator = exceptionTranslator;
    }

    /**
     * Executes an operation and translates unexpected technical exceptions.
     *
     * @param operationName descriptive operation constant or enum value
     * @param operation operation to execute
     * @param <T> returned value type
     * @return operation result
     * @throws BusinessException when the operation violates a business rule
     * @throws TechnicalException when an unexpected technical failure occurs
     */
    public <T> T execute(OperationName operationName, ThrowingSupplier<T> operation) {
        try {
            return operation.get();
        } catch (BusinessException businessException) {
            throw businessException;
        } catch (Exception technicalException) {
            throw exceptionTranslator.translate(operationName, technicalException);
        }
    }
}
```

Service sử dụng executor thay vì tự bắt lỗi:

```java
return exceptionExecutor.execute(
        TenantOperationName.CREATE_TENANT,
        () -> tenantRepository.save(tenantEntity));
```

`@ControllerAdvice` chỉ chuyển exception chuẩn thành HTTP response; không chứa business logic.

## 4. Naming

Tên class, method, parameter và biến phải biểu đạt mục đích và kiểu dữ liệu. Không dùng tên chung chung như `request`, `response`, `data`, `item`, `result`, `value`, `temp` hoặc một ký tự, trừ biến chỉ số vòng lặp khi không có lựa chọn rõ hơn.

| Không dùng | Dùng |
|---|---|
| `request` | `createTenantRequest` |
| `response` | `tenantResponse` |
| `entity` | `tenantEntity` |
| `data` | `tenantMembershipData` |
| `list` | `activeTenantMemberships` |
| `service` | `tenantMembershipService` |

## 5. Public API documentation

Mọi `public` class, interface, constructor và method phải có JavaDoc chuẩn. JavaDoc cần nêu trách nhiệm, `@param`, `@return`, `@throws` khi áp dụng. Không dùng comment để lặp lại tên method; giải thích contract, side effect hoặc business meaning.

## 6. Vòng lặp

Không khai báo biến tạm trong thân vòng lặp. Khai báo biến trước vòng lặp để giảm cấp phát và giúp scope rõ ràng.

```java
int tenantIndex;
TenantMembership tenantMembership;

for (tenantIndex = 0; tenantIndex < tenantMemberships.size(); tenantIndex++) {
    tenantMembership = tenantMemberships.get(tenantIndex);
    processTenantMembership(tenantMembership);
}
```

## 7. String

Khi ghép từ nhiều phần hoặc thực hiện trong vòng lặp, bắt buộc dùng `StringBuilder`. Không nối chuỗi bằng toán tử `+` trong vòng lặp.

```java
StringBuilder tenantAuditMessageBuilder = new StringBuilder();

tenantAuditMessageBuilder.append(tenantName);
tenantAuditMessageBuilder.append(TenantAuditConstant.MESSAGE_SEPARATOR);
tenantAuditMessageBuilder.append(membershipRole);
```

## 8. Date and time

Không tự khai báo date format, `DateTimeFormatter` hoặc pattern date trong từng service. Mọi format/parse date-time tại API boundary phải dùng `format.datetime.ApiDateTimeFormatter` từ `common-lib`.

| Kiểu dữ liệu | Format chung |
|---|---|
| `Instant` | `DateTimeFormatter.ISO_INSTANT` |
| `OffsetDateTime` | `DateTimeFormatter.ISO_OFFSET_DATE_TIME` |
| `LocalDate` | `DateTimeFormatter.ISO_LOCAL_DATE` |

Không dùng `LocalDateTime` cho dữ liệu có thời điểm thực tế vì không mang offset/time zone. Lưu date/time bằng `Instant`, `OffsetDateTime` hoặc `LocalDate` theo nghĩa nghiệp vụ.

## 9. Database and DBML

Mỗi service bắt buộc sở hữu một database riêng và credential database riêng. Không dùng chung một database, một schema hoặc một database account giữa các service.

| Service | Database ownership |
|---|---|
| `identity-service` | Database riêng của identity. |
| `tenant-service` | Database riêng của tenant và membership. |
| `billing-service` | Database riêng của billing. |
| `notification-service` | Database riêng của notification. |

Một physical database server hoặc cluster có thể chứa nhiều database độc lập, nhưng mỗi service chỉ được kết nối tới database và account của chính nó. Cập nhật đồng thời `database/schema.dbml` và Flyway migration khi thay đổi schema. Không tạo foreign key, join, entity reference hoặc truy vấn trực tiếp sang database của service khác.

## 10. Common API response

Controller của mọi microservice phải trả response thông qua `ApiResponse<T>` từ `common-lib`. `ApiResponse.success(...)` bọc dữ liệu thành công; global exception handler bọc lỗi bằng `ApiResponse.failure(...)` và `ApiErrorResponse`. Không tạo response envelope khác trong từng service.
