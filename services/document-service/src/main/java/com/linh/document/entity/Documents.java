package com.linh.document.entity;

import com.linh.document.constants.DocumentContract;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/** Thực thể ánh xạ đến collection documents. */
@Document(collection = Documents.COLLECTION_NAME)
public class Documents {
    /** Bảng cơ sở dữ liệu được thực thể này ánh xạ. */
    public static final String COLLECTION_NAME = "documents";
    private static final String CHECKSUM_SHA256_COLUMN = "checksum_sha256";

    @Id
    @NotBlank
    private String documentId;

    @NotBlank
    private String tenantId;

    @NotBlank
    private String courseId;

    @NotBlank
    private String uploaderUserId;

    @NotBlank
    @Size(max = DocumentContract.MAX_KEY_LENGTH)
    private String idempotencyKey;

    @NotBlank
    @Size(max = DocumentContract.MAX_FILE_NAME_LENGTH)
    private String fileName;

    @Positive
    private long byteSize;

    @NotBlank
    @Pattern(regexp = DocumentContract.SHA256_HEX_PATTERN)
    private String checksumSha256;

    @NotBlank
    private String storageKey;

    @NotBlank
    private String accessScope;

    @NotBlank
    private String status;

    @Positive
    private int documentVersion;

    @Positive
    private Integer pageCount;

    @Pattern(regexp = DocumentContract.NON_BLANK_PATTERN)
    private String failureCode;

    private Instant createdAt;

    private Instant updatedAt;

    /** Phương thức khởi tạo cần thiết để MongoDB nạp thực thể. */
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
        this.createdAt = createdAt == null ? Instant.now() : createdAt;
        this.updatedAt = updatedAt == null ? this.createdAt : updatedAt;
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
