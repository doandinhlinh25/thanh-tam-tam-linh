package org.example.saas.commonlib.dto.response;

import java.util.Objects;

/**
 * Wraps every API response with a consistent success or error envelope.
 *
 * @param <T> successful response payload type
 */
public final class ApiResponse<T> {

    private static final boolean FAILURE_RESPONSE = false;
    private static final boolean SUCCESSFUL_RESPONSE = true;

    private final boolean successful;
    private final T data;
    private final ApiErrorResponse error;

    private ApiResponse(boolean successful, T data, ApiErrorResponse error) {
        this.successful = successful;
        this.data = data;
        this.error = error;
    }

    /**
     * Creates a successful API response envelope.
     *
     * @param responseData successful response payload
     * @param <T> successful response payload type
     * @return successful response envelope
     */
    public static <T> ApiResponse<T> success(T responseData) {
        return new ApiResponse<>(SUCCESSFUL_RESPONSE, responseData, null);
    }

    /**
     * Creates a failed API response envelope.
     *
     * @param errorResponse standardized error details
     * @param <T> successful response payload type
     * @return failed response envelope
     */
    public static <T> ApiResponse<T> failure(ApiErrorResponse errorResponse) {
        return new ApiResponse<>(
                FAILURE_RESPONSE,
                null,
                Objects.requireNonNull(errorResponse));
    }

    /**
     * Indicates whether the request completed successfully.
     *
     * @return true when the response contains successful data
     */
    public boolean isSuccessful() {
        return successful;
    }

    /**
     * Returns the successful response payload.
     *
     * @return successful response payload or null for failures
     */
    public T getData() {
        return data;
    }

    /**
     * Returns standardized error details.
     *
     * @return error details or null for successes
     */
    public ApiErrorResponse getError() {
        return error;
    }
}
