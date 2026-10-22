package com.linh.document.dto.response;

import java.util.Map;

/** Cấu trúc phản hồi JSON dùng chung cho các API của nền tảng. */
public record ApiResponse<T>(boolean successful, T data, ApiError error) {
    /**
     * Đóng gói kết quả thành công.
     *
     * @param data dữ liệu kết quả
     * @return cấu trúc phản hồi thành công
     * @param <T> kiểu dữ liệu kết quả
     */
    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, null);
    }

    /**
     * Đóng gói kết quả thất bại.
     *
     * @param error thông tin lỗi
     * @return cấu trúc phản hồi thất bại
     */
    public static ApiResponse<Void> failure(ApiError error) {
        return new ApiResponse<>(false, null, error);
    }

    /** Các trường lỗi cố định trả về cho ứng dụng khách. */
    public record ApiError(String errorCode, String errorMessage, Map<String, String> fieldErrors) {
    }
}
