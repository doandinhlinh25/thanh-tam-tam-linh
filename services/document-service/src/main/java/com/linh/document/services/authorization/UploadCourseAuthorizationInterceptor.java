package com.linh.document.services.authorization;

import com.linh.document.constants.DocumentContract;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;

/** Kiểm tra quyền tải tài liệu lên khóa học trước khi controller đọc tệp. */
@Component
public class UploadCourseAuthorizationInterceptor implements HandlerInterceptor {
    private final ICourseAuthorizationGateway authorization;

    /**
     * Khởi tạo bước kiểm tra quyền theo khóa học.
     *
     * @param authorization cổng kiểm tra quyền với Tenant Service
     */
    public UploadCourseAuthorizationInterceptor(ICourseAuthorizationGateway authorization) {
        this.authorization = authorization;
    }

    /**
     * Dùng tham số URL do Spring MVC phân tích để xác minh quyền tải lên.
     *
     * @param request yêu cầu HTTP
     * @param response phản hồi HTTP
     * @param handler phương thức xử lý được Spring MVC chọn
     * @return true để tiếp tục xử lý sau khi quyền được xác minh
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!HttpMethod.POST.matches(request.getMethod())) {
            return true;
        }
        Map<?, ?> variables = (Map<?, ?>) request.getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
        String courseId = (String) variables.get(DocumentContract.COURSE_ID_VARIABLE);
        AuthorizedUploader uploader = authorization.authorize(courseId, request.getHeader(HttpHeaders.COOKIE));
        request.setAttribute(DocumentContract.UPLOADER_ATTRIBUTE, uploader);
        return true;
    }
}
