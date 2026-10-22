package com.linh.document.services.authorization;

/** Danh tính và tenant đã được Tenant Service xác minh. */
public record AuthorizedUploader(String tenantId, String userId) {
}
