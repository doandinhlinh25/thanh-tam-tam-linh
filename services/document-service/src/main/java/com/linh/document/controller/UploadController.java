package com.linh.document.controller;

import com.linh.document.constants.DocumentContract;
import com.linh.document.dto.request.UploadRequest;
import com.linh.document.dto.response.ApiResponse;
import com.linh.document.dto.response.DocumentResponse;
import com.linh.document.exception.DocumentException;
import com.linh.document.entity.Documents;
import com.linh.document.services.business.IUploadService;
import com.linh.document.services.authorization.AuthorizedUploader;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Kiểm tra và tiếp nhận tệp PDF tại điểm truy cập HTTP công khai. */
@RestController
public class UploadController {
    private static final String INVALID_REQUEST_CODE = "DOCUMENT_UPLOAD_INVALID";
    private static final String INVALID_REQUEST_MESSAGE = "Thiếu môn học, khóa upload hoặc tệp PDF";
    private static final String INVALID_FILE_CODE = "DOCUMENT_FILE_INVALID";
    private static final String INVALID_FILE_MESSAGE = "Tệp không phải PDF hợp lệ";
    private final IUploadService service;

    /**
     * Khởi tạo điểm tiếp nhận tệp PDF.
     *
     * @param service quy trình tải lên
     */
    public UploadController(IUploadService service) {
        this.service = service;
    }

    /**
     * Chỉ tiếp nhận một tệp PDF sau khi bộ lọc xác thực quyền của phiên gốc.
     *
     * @param courseId mã khóa học
     * @param key khóa chống trùng của lượt tải lên
     * @param file tệp PDF được tải lên
     * @param uploader tenant và người tải lên đã được xác minh
     * @return phản hồi chứa tài liệu đã tiếp nhận
     */
    @PostMapping(path = DocumentContract.UPLOAD_PATH, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(@PathVariable String courseId,
            @RequestHeader(value = DocumentContract.IDEMPOTENCY_HEADER, required = false) String key,
            @RequestParam(value = DocumentContract.FILE_FIELD, required = false) MultipartFile file,
            @RequestAttribute(DocumentContract.UPLOADER_ATTRIBUTE) AuthorizedUploader uploader) {
        UploadRequest uploadRequest = new UploadRequest(courseId, key, file);
        if (!uploadRequest.hasRequiredFields()) {
            throw new DocumentException(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
        }
        byte[] bytes = readBytes(file);
        if (!uploadRequest.hasPdfSignature(bytes)) {
            throw new DocumentException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, INVALID_FILE_CODE, INVALID_FILE_MESSAGE);
        }
        Documents document = service.upload(courseId, key, file.getOriginalFilename(), bytes, uploader);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(ApiResponse.success(DocumentResponse.from(document)));
    }

    private byte[] readBytes(MultipartFile file) {
        try {
            return file.getBytes();
        } catch (IOException error) {
            throw new DocumentException(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
        }
    }
}
