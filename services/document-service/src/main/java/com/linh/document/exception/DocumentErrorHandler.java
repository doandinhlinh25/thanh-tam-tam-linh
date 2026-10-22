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

/** Chuyển lỗi tải lên thành cấu trúc lỗi của API công khai. */
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
     * Trả về lỗi tài liệu đã xác định.
     *
     * @param error thông tin lỗi
     * @return phản hồi lỗi API
     */
    @ExceptionHandler(DocumentException.class)
    public ResponseEntity<ApiResponse<Void>> handleDocument(DocumentException error) {
        return failure(error.status(), error.code(), error.getMessage());
    }

    /**
     * Từ chối yêu cầu multipart vượt giới hạn dung lượng.
     *
     * @param error thông tin lỗi
     * @return phản hồi lỗi API
     */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiResponse<Void>> handleTooLarge(MaxUploadSizeExceededException error) {
        return failure(HttpStatus.PAYLOAD_TOO_LARGE, TOO_LARGE_CODE, TOO_LARGE_MESSAGE);
    }

    /**
     * Từ chối yêu cầu multipart sai định dạng.
     *
     * @param error thông tin lỗi
     * @return phản hồi lỗi API
     */
    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiResponse<Void>> handleMultipart(MultipartException error) {
        return failure(HttpStatus.BAD_REQUEST, INVALID_CODE, INVALID_MESSAGE);
    }

    /**
     * Từ chối yêu cầu có loại nội dung không được hỗ trợ.
     *
     * @param error thông tin lỗi
     * @return phản hồi lỗi API
     */
    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> handleMediaType(HttpMediaTypeNotSupportedException error) {
        return failure(HttpStatus.UNSUPPORTED_MEDIA_TYPE, UNSUPPORTED_CODE, UNSUPPORTED_MESSAGE);
    }

    /**
     * Ẩn thông tin hạ tầng khỏi ứng dụng khách API.
     *
     * @param error thông tin lỗi
     * @return phản hồi lỗi API
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
