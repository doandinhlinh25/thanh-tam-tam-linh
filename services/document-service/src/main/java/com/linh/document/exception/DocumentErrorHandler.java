package com.linh.document.exception;

import com.linh.document.dto.response.ApiResponse;
import com.linh.document.exception.DocumentException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

/** Converts upload failures to the public API error envelope. */
@RestControllerAdvice
public class DocumentErrorHandler {
    private static final String TOO_LARGE_CODE = "DOCUMENT_FILE_TOO_LARGE";
    private static final String TOO_LARGE_MESSAGE = "Tệp vượt quá kích thước cho phép";
    private static final String INVALID_CODE = "DOCUMENT_UPLOAD_INVALID";
    private static final String INVALID_MESSAGE = "Yêu cầu upload không hợp lệ";
    private static final String UNSUPPORTED_CODE = "DOCUMENT_FILE_INVALID";
    private static final String UNSUPPORTED_MESSAGE = "Tệp không phải PDF hợp lệ";
    private static final String INTERNAL_CODE = "DOCUMENT_INTERNAL_ERROR";
    private static final String INTERNAL_MESSAGE = "Không thể xử lý yêu cầu upload";

    /**
     * Returns a known document failure.
     *
     * @param error domain error
     * @return API error response
     */
    @ExceptionHandler(DocumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocument(DocumentException error) {
        return failure(error.status(), error.code(), error.getMessage());
    }

    /**
     * Rejects oversized multipart requests.
     *
     * @param error multipart size error
     * @return API error response
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleTooLarge(MaxUploadSizeExceededException error) {
        return failure(HttpStatus.PAYLOAD_TOO_LARGE, TOO_LARGE_CODE, TOO_LARGE_MESSAGE);
    }

    /**
     * Rejects malformed multipart requests.
     *
     * @param error multipart parsing error
     * @return API error response
     */
    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMultipart(MultipartException error) {
        return failure(HttpStatus.BAD_REQUEST, INVALID_CODE, INVALID_MESSAGE);
    }

    /**
     * Rejects requests with an unsupported content type.
     *
     * @param error media type error
     * @return API error response
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaType(HttpMediaTypeNotSupportedException error) {
        return failure(HttpStatus.UNSUPPORTED_MEDIA_TYPE, UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE);
    }

    /**
     * Hides infrastructure details from API clients.
     *
     * @param error unexpected error
     * @return API error response
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception error) {
        return failure(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_CODE, INTERNAL_MESSAGE);
    }

    private ResponseEntity<ApiResponse<Void>> failure(HttpStatus status, String code, String message) {
        ApiResponse.ApiError details = new ApiResponse.ApiError(code, message, Map.of());
        return ResponseEntity.status(status).body(ApiResponse.failure(details));
    }
}
