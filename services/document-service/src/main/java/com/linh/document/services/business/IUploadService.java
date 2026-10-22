package com.linh.document.services.business;

import com.linh.document.entity.Documents;
import com.linh.document.services.authorization.AuthorizedUploader;

/** Điều phối lượt tải PDF đã được cấp quyền và trả về siêu dữ liệu tài liệu đã lưu. */
public interface IUploadService {
    /**
     * Lưu tệp PDF đã kiểm tra và yêu cầu xử lý dữ liệu.
     *
     * @param courseId mã khóa học
     * @param idempotencyKey khóa chống trùng của lượt tải lên
     * @param fileName tên tệp gốc
     * @param bytes dữ liệu tệp PDF được tải lên
     * @param uploader tenant và người tải lên đã được xác minh
     * @return siêu dữ liệu tài liệu đã lưu
     */
    Documents upload(String courseId, String idempotencyKey, String fileName,
            byte[] bytes, AuthorizedUploader uploader);
}
