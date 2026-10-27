package com.linh.document.services.authorization;

/** Xác minh quyền tải lên với dịch vụ quản lý khóa học. */
public interface ICourseAuthorizationGateway {
    /**
     * Xác nhận phiên người dùng gốc được phép tải tài liệu lên khóa học.
     *
     * @param courseId mã khóa học
     * @param cookie cookie của phiên người dùng gốc
     * @return mã tenant và người dùng đã được xác minh
     */
    AuthorizedUploader authorize(String courseId, String cookie);
}
