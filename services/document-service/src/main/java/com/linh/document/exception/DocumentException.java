package com.linh.document.exception;

import org.springframework.http.HttpStatus;

/** Upload failure with an HTTP status and stable API error code. */
public class DocumentException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    /**
     * Creates a client-facing document error.
     *
     * @param status HTTP status
     * @param code stable error code
     * @param message readable explanation
     */
    public DocumentException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /**
     * Returns the HTTP status.
     *
     * @return status
     */
    public HttpStatus status() {
        return status;
    }

    /**
     * Returns the stable API code.
     *
     * @return error code
     */
    public String code() {
        return code;
    }
}
