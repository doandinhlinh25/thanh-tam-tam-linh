package com.linh.document.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.constants.DocumentContract;
import com.linh.document.dto.response.ApiResponse;
import com.linh.document.exception.DocumentException;
import com.linh.document.services.authorization.ICourseAuthorizationGateway;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Kiểm tra quyền đối với khóa học trước khi phân tích tệp PDF multipart. */
@Component
public class UploadAuthorizationFilter extends OncePerRequestFilter {
    private static final String POST_METHOD = "POST";
    private static final String PATH_SEPARATOR = "/";
    private static final String UNAUTHENTICATED_CODE = "DOCUMENT_UNAUTHENTICATED";
    private static final String UNAUTHENTICATED_MESSAGE = "Chưa có phiên đăng nhập hợp lệ";
    private static final String INVALID_REQUEST_CODE = "DOCUMENT_UPLOAD_INVALID";
    private static final String INVALID_REQUEST_MESSAGE = "Yêu cầu upload không hợp lệ";
    private final ICourseAuthorizationGateway authorization;
    private final ObjectMapper objectMapper;

    /**
     * Khởi tạo bước kiểm tra quyền truy cập khóa học trước khi xử lý tệp.
     *
     * @param authorization cổng kiểm tra quyền truy cập khóa học
     * @param objectMapper bộ xử lý JSON
     */
    public UploadAuthorizationFilter(ICourseAuthorizationGateway authorization, ObjectMapper objectMapper) {
        this.authorization = authorization;
        this.objectMapper = objectMapper;
    }

    /**
     * Cấp quyền tải lên mà không tin các header tenant hoặc người dùng do ứng dụng khách gửi.
     *
     * @param request yêu cầu HTTP gửi đến
     * @param response phản hồi HTTP gửi đi
     * @param chain chuỗi xử lý yêu cầu còn lại
     * @throws ServletException khi quá trình xử lý servlet phía sau thất bại
     * @throws IOException khi ghi phản hồi thất bại
     */
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (!isUploadRequest(request.getMethod(), path)) {
            chain.doFilter(request, response);
            return;
        }
        String courseId = path.substring(DocumentContract.UPLOAD_PREFIX.length(),
                path.length() - DocumentContract.UPLOAD_SUFFIX.length());
        String cookie = request.getHeader(HttpHeaders.COOKIE);
        try {
            if (courseId.isBlank() || courseId.contains(PATH_SEPARATOR)) {
                throw new DocumentException(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
            }
            if (cookie == null || cookie.isBlank()) {
                throw new DocumentException(HttpStatus.UNAUTHORIZED, UNAUTHENTICATED_CODE, UNAUTHENTICATED_MESSAGE);
            }
            request.setAttribute(DocumentContract.UPLOADER_ATTRIBUTE, authorization.authorize(courseId, cookie));
        } catch (DocumentException error) {
            response.setStatus(error.status().value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiResponse.ApiError details = new ApiResponse.ApiError(error.code(), error.getMessage(), Map.of());
            objectMapper.writeValue(response.getOutputStream(), ApiResponse.failure(details));
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isUploadRequest(String method, String path) {
        return POST_METHOD.equals(method) && path.startsWith(DocumentContract.UPLOAD_PREFIX)
                && path.endsWith(DocumentContract.UPLOAD_SUFFIX);
    }
}
