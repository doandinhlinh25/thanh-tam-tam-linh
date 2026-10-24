package com.linh.document.model;

import java.time.Instant;

/** Document metadata stored in the service-owned PostgreSQL database. */
public record DocumentRecord(String documentId, String tenantId, String courseId, String uploaderUserId,
        String idempotencyKey, String fileName, String checksumSha256, String storageKey, String status,
        int documentVersion, Integer pageCount, String failureCode, Instant createdAt, Instant updatedAt) {
}
