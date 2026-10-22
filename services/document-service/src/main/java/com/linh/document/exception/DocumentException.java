package com.linh.document.exception;

import org.springframework.http.HttpStatus;

/** Lỗi tải lên kèm trạng thái HTTP và mã lỗi API cố định. */
public class DocumentException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    /**
     * Tạo lỗi tài liệu trả về cho ứng dụng khách.
     *
     * @param status trạng thái HTTP
     * @param code mã lỗi cố định
     * @param message nội dung giải thích dễ hiểu
     */
    public DocumentException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /**
     * Trả về trạng thái HTTP.
     *
     * @return trạng thái HTTP
     */
    public HttpStatus status() {
        return status;
    }

    /**
     * Trả về mã lỗi API cố định.
     *
     * @return mã lỗi
     */
    public String code() {
        return code;
    }
}
