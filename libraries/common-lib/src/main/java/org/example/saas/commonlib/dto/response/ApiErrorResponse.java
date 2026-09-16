package org.example.saas.commonlib.dto.response;

import java.util.Map;
import java.util.Objects;

/**
 * Represents standardized error details returned inside an API response envelope.
 */
public final class ApiErrorResponse {

    private final String errorCode;
    private final String errorMessage;
    private final Map<String, String> fieldErrors;

    /**
     * Creates immutable error details for an API response.
     *
     * @param errorCode stable machine-readable error identifier
     * @param errorMessage human-readable error description
     * @param fieldErrors validation errors indexed by field name
     */
    public ApiErrorResponse(
            String errorCode,
            String errorMessage,
            Map<String, String> fieldErrors) {
        this.errorCode = Objects.requireNonNull(errorCode);
        this.errorMessage = Objects.requireNonNull(errorMessage);
        this.fieldErrors = Map.copyOf(Objects.requireNonNull(fieldErrors));
    }

    /**
     * Returns the stable machine-readable error identifier.
     *
     * @return error identifier
     */
    public String getErrorCode() {
        return errorCode;
    }

    /**
     * Returns the human-readable error description.
     *
     * @return error description
     */
    public String getErrorMessage() {
        return errorMessage;
    }

    /**
     * Returns immutable validation errors indexed by field name.
     *
     * @return validation errors
     */
    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
