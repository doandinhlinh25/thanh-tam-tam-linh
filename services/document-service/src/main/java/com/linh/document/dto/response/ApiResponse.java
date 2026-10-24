package com.linh.document.dto.response;

import java.util.Map;

/** Shared JSON response shape used by the platform APIs. */
public record ApiResponse<T>(boolean successful, T data, ApiError error) {
    /**
     * Wraps a successful result.
     *
     * @param data result data
     * @return successful envelope
     * @param <T> result type
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    /**
     * Wraps a failed result.
     *
     * @param error stable error details
     * @return failed envelope
     */
    public static ApiResponse<Void> failure(ApiError error) {
        return new ApiResponse<>(false, null, error);
    }

    /** Stable client facing error fields. */
    public record ApiError(String errorCode, String errorMessage, Map<String, String> fieldErrors) {
    }
}
