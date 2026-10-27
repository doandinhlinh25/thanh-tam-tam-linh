package com.linh.document.dto.response;

import com.linh.document.entity.Documents;
import java.time.Instant;

/** Siêu dữ liệu công khai được trả về khi chấp nhận tải tài liệu lên. */
public record DocumentResponse(String documentId, String tenantId, String courseId, String fileName,
        String status, int documentVersion, Integer pageCount, String failureCode,
        Instant createdAt, Instant updatedAt) {
    /**
     * Loại bỏ các trường riêng tư về người tải lên và nơi lưu trữ đối tượng.
     *
     * @param record bản ghi tài liệu đã lưu
     * @return phản hồi công khai
     */
    public static DocumentResponse from(Documents record) {
        return new DocumentResponse(record.documentId(), record.tenantId(), record.courseId(),
                record.fileName(), record.status(), record.documentVersion(), record.pageCount(),
                record.failureCode(), record.createdAt(), record.updatedAt());
    }
}
