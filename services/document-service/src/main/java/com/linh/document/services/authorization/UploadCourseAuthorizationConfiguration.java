package com.linh.document.services.authorization;

import com.linh.document.constants.DocumentContract;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Áp dụng kiểm tra quyền khóa học cho endpoint tải tài liệu. */
@Configuration
public class UploadCourseAuthorizationConfiguration implements WebMvcConfigurer {
    private final UploadCourseAuthorizationInterceptor interceptor;

    /**
     * Khởi tạo cấu hình kiểm tra quyền tải lên.
     *
     * @param interceptor bước kiểm tra quyền theo khóa học
     */
    public UploadCourseAuthorizationConfiguration(UploadCourseAuthorizationInterceptor interceptor) {
        this.interceptor = interceptor;
    }

    /**
     * Chỉ áp dụng kiểm tra quyền cho đường dẫn tải tài liệu.
     *
     * @param registry danh sách interceptor của Spring MVC
     */
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor).addPathPatterns(DocumentContract.UPLOAD_PATH);
    }
}
