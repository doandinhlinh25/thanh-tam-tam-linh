package com.linh.document.entity;

import com.linh.document.constants.DocumentContract;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;

/** Thực thể ánh xạ đến bảng documents. */
@Entity
@Table(name = Documents.TABLE_NAME)
public class Documents {
    /** Bảng cơ sở dữ liệu được thực thể này ánh xạ. */
    public static final String TABLE_NAME = "documents";
    private static final String DOCUMENT_ID_COLUMN = "document_id";
    private static final String TENANT_ID_COLUMN = "tenant_id";
    private static final String COURSE_ID_COLUMN = "course_id";
    private static final String UPLOADER_USER_ID_COLUMN = "uploader_user_id";
    private static final String IDEMPOTENCY_KEY_COLUMN = "idempotency_key";
    private static final String FILE_NAME_COLUMN = "file_name";
    private static final String BYTE_SIZE_COLUMN = "byte_size";
    private static final String CHECKSUM_SHA256_COLUMN = "checksum_sha256";
    private static final String STORAGE_KEY_COLUMN = "storage_key";
    private static final String ACCESS_SCOPE_COLUMN = "access_scope";
    private static final String STATUS_COLUMN = "status";
    private static final String DOCUMENT_VERSION_COLUMN = "document_version";
    private static final String PAGE_COUNT_COLUMN = "page_count";
    private static final String FAILURE_CODE_COLUMN = "failure_code";
    private static final String CREATED_AT_COLUMN = "created_at";
    private static final String UPDATED_AT_COLUMN = "updated_at";

    @Id
    @Column(name = DOCUMENT_ID_COLUMN, nullable = false)
    @NotBlank
    private String documentId;

    @Column(name = TENANT_ID_COLUMN, nullable = false)
    @NotBlank
    private String tenantId;

    @Column(name = COURSE_ID_COLUMN, nullable = false)
    @NotBlank
    private String courseId;

    @Column(name = UPLOADER_USER_ID_COLUMN, nullable = false)
    @NotBlank
    private String uploaderUserId;

    @Column(name = IDEMPOTENCY_KEY_COLUMN, nullable = false)
    @NotBlank
    @Size(max = DocumentContract.MAX_KEY_LENGTH)
    private String idempotencyKey;

    @Column(name = FILE_NAME_COLUMN, nullable = false)
    @NotBlank
    @Size(max = DocumentContract.MAX_FILE_NAME_LENGTH)
    private String fileName;

    @Column(name = BYTE_SIZE_COLUMN, nullable = false)
    @Positive
    private long byteSize;

    @Column(name = CHECKSUM_SHA256_COLUMN, nullable = false)
    @NotBlank
    @Pattern(regexp = DocumentContract.SHA256_HEX_PATTERN)
    private String checksumSha256;

    @Column(name = STORAGE_KEY_COLUMN, nullable = false)
    @NotBlank
    private String storageKey;

    @Column(name = ACCESS_SCOPE_COLUMN, nullable = false)
    @NotBlank
    private String accessScope;

    @Column(name = STATUS_COLUMN, nullable = false)
    @NotBlank
    private String status;

    @Column(name = DOCUMENT_VERSION_COLUMN, nullable = false)
    @Positive
    private int documentVersion;

    @Column(name = PAGE_COUNT_COLUMN)
    @Positive
    private Integer pageCount;

    @Column(name = FAILURE_CODE_COLUMN)
    @Pattern(regexp = DocumentContract.NON_BLANK_PATTERN)
    private String failureCode;

    @Column(name = CREATED_AT_COLUMN, nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = UPDATED_AT_COLUMN, nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    /** Phương thức khởi tạo cần thiết để JPA nạp thực thể. */
    protected Documents() {
    }

    /**
     * Tạo thực thể từ một bản ghi tài liệu đã lưu.
     *
     * @param documentId mã tài liệu
     * @param tenantId mã tenant sở hữu
     * @param courseId mã khóa học
     * @param uploaderUserId mã người tải lên
     * @param idempotencyKey khóa chống trùng của lượt tải lên
     * @param fileName tên tệp gốc
     * @param byteSize dung lượng tệp tính theo byte
     * @param checksumSha256 mã kiểm tra SHA-256 của tệp PDF
     * @param storageKey khóa lưu trữ đối tượng riêng tư
     * @param accessScope phạm vi truy cập tài liệu
     * @param status trạng thái
     * @param documentVersion phiên bản tài liệu
     * @param pageCount số trang đã trích xuất
     * @param failureCode mã lỗi xử lý dữ liệu
     * @param createdAt thời điểm tạo
     * @param updatedAt thời điểm cập nhật gần nhất
     */
    public Documents(String documentId, String tenantId, String courseId, String uploaderUserId,
            String idempotencyKey, String fileName, long byteSize, String checksumSha256,
            String storageKey, String accessScope, String status, int documentVersion,
            Integer pageCount, String failureCode, Instant createdAt, Instant updatedAt) {
        this.documentId = documentId;
        this.tenantId = tenantId;
        this.courseId = courseId;
        this.uploaderUserId = uploaderUserId;
        this.idempotencyKey = idempotencyKey;
        this.fileName = fileName;
        this.byteSize = byteSize;
        this.checksumSha256 = checksumSha256;
        this.storageKey = storageKey;
        this.accessScope = accessScope;
        this.status = status;
        this.documentVersion = documentVersion;
        this.pageCount = pageCount;
        this.failureCode = failureCode;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /** @return mã tài liệu */
    public String documentId() {
        return documentId;
    }

    /** @return mã tenant sở hữu */
    public String tenantId() {
        return tenantId;
    }

    /** @return mã khóa học sở hữu */
    public String courseId() {
        return courseId;
    }

    /** @return mã người tải lên */
    public String uploaderUserId() {
        return uploaderUserId;
    }

    /** @return khóa chống trùng của lượt tải lên */
    public String idempotencyKey() {
        return idempotencyKey;
    }

    /** @return tên tệp đã tải lên */
    public String fileName() {
        return fileName;
    }

    /** @return dung lượng tệp đã tải lên */
    public long byteSize() {
        return byteSize;
    }

    /** @return mã kiểm tra của tệp PDF */
    public String checksumSha256() {
        return checksumSha256;
    }

    /** @return khóa lưu trữ đối tượng riêng tư */
    public String storageKey() {
        return storageKey;
    }

    /** @return phạm vi truy cập tài liệu */
    public String accessScope() {
        return accessScope;
    }

    /** @return trạng thái xử lý dữ liệu */
    public String status() {
        return status;
    }

    /** @return phiên bản tài liệu */
    public int documentVersion() {
        return documentVersion;
    }

    /** @return số trang đã trích xuất */
    public Integer pageCount() {
        return pageCount;
    }

    /** @return mã lỗi xử lý dữ liệu */
    public String failureCode() {
        return failureCode;
    }

    /** @return thời điểm tạo */
    public Instant createdAt() {
        return createdAt;
    }

    /** @return thời điểm cập nhật gần nhất */
    public Instant updatedAt() {
        return updatedAt;
    }
}
