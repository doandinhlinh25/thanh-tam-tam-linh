package com.linh.document.dto.request;

import com.linh.document.constants.DocumentContract;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.web.multipart.MultipartFile;

/** Các trường tải lên multipart được kiểm tra tại điểm truy cập HTTP. */
public record UploadRequest(String courseId, String idempotencyKey, MultipartFile file) {
    /**
     * Kiểm tra các trường tải lên bắt buộc trước khi đọc dữ liệu PDF.
     *
     * @return true khi có đầy đủ các trường bắt buộc
     */
    public boolean hasRequiredFields() {
        return courseId != null && !courseId.isBlank()
                && idempotencyKey != null && !idempotencyKey.isBlank()
                && idempotencyKey.length() <= DocumentContract.MAX_KEY_LENGTH
                && file != null && !file.isEmpty();
    }

    /**
     * Kiểm tra loại nội dung PDF, tên tệp và chữ ký tệp.
     *
     * @param bytes dữ liệu tệp PDF được tải lên
     * @return true khi tệp có chữ ký PDF và siêu dữ liệu hợp lệ
     */
    public boolean hasPdfSignature(byte[] bytes) {
        byte[] signature = DocumentContract.PDF_MAGIC.getBytes(StandardCharsets.US_ASCII);
        String fileName = file.getOriginalFilename();
        return DocumentContract.PDF_MIME.equals(file.getContentType()) && fileName != null
                && !fileName.isBlank() && fileName.length() <= DocumentContract.MAX_FILE_NAME_LENGTH
                && bytes.length >= signature.length
                && Arrays.equals(Arrays.copyOf(bytes, signature.length), signature);
    }
}
