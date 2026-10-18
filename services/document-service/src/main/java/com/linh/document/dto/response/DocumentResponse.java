package com.linh.document.dto.response;

import com.linh.document.model.DocumentRecord;
import java.time.Instant;

/** Public metadata returned when a document upload is accepted. */
public record DocumentResponse(String documentId, String tenantId, String courseId, String fileName,
        String status, int documentVersion, Integer pageCount, String failureCode,
        Instant createdAt, Instant updatedAt) {
    /**
     * Removes private uploader and object storage fields.
     *
     * @param record stored document
     * @return public response
     */
    public static DocumentResponse from(DocumentRecord record) {
        return new DocumentResponse(record.documentId(), record.tenantId(), record.courseId(),
                record.fileName(), record.status(), record.documentVersion(), record.pageCount(),
                record.failureCode(), record.createdAt(), record.updatedAt());
    }
}
