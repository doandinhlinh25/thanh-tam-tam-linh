package com.linh.document.controller;

import com.linh.document.constants.DocumentContract;
import com.linh.document.dto.request.UploadRequest;
import com.linh.document.dto.response.ApiResponse;
import com.linh.document.dto.response.DocumentResponse;
import com.linh.document.exception.DocumentException;
import com.linh.document.model.DocumentRecord;
import com.linh.document.services.UploadService;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Validates and accepts PDF uploads at the public HTTP boundary. */
@RestController
public class UploadController {
    private static final String INVALID_REQUEST_CODE = "DOCUMENT_UPLOAD_INVALID";
    private static final String INVALID_REQUEST_MESSAGE = "Thiếu môn học, khóa upload hoặc tệp PDF";
    private static final String INVALID_FILE_CODE = "DOCUMENT_FILE_INVALID";
    private static final String INVALID_FILE_MESSAGE = "Tệp không phải PDF hợp lệ";
    private static final String TOO_LARGE_CODE = "DOCUMENT_FILE_TOO_LARGE";
    private static final String TOO_LARGE_MESSAGE = "Tệp vượt quá kích thước cho phép";
    private final UploadService service;
    private final long maxUploadBytes;

    /**
     * Creates an upload endpoint with a configured PDF size cap.
     *
     * @param service upload workflow
     * @param maxUploadBytes maximum file bytes
     */
    public UploadController(UploadService service, @Value("${document.max-upload-bytes}") long maxUploadBytes) {
        this.service = service;
        this.maxUploadBytes = maxUploadBytes;
    }

    /**
     * Accepts one PDF only after the filter has authorized the original session.
     *
     * @param courseId course from the path
     * @param key upload idempotency key
     * @param file uploaded PDF part
     * @param request authorized servlet request
     * @return accepted document response
     */
    @PostMapping(path = DocumentContract.UPLOAD_PATH, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<DocumentResponse>> upload(@PathVariable String courseId,
            @RequestHeader(value = DocumentContract.IDEMPOTENCY_HEADER, required = false) String key,
            @RequestParam(value = DocumentContract.FILE_FIELD, required = false) MultipartFile file,
            HttpServletRequest request) {
        UploadRequest uploadRequest = new UploadRequest(courseId, key, file);
        if (!uploadRequest.hasRequiredFields()) {
            throw new DocumentException(HttpStatus.BAD_REQUEST, INVALID_REQUEST_CODE, INVALID_REQUEST_MESSAGE);
        }
        byte[] bytes = readBytes(file);
        if (bytes.length > maxUploadBytes) {
            throw new DocumentException(HttpStatus.PAYLOAD_TOO_LARGE, TOO_LARGE_CODE, TOO_LARGE_MESSAGE);
        }
        if (!uploadRequest.hasPdfSignature(bytes)) {
            throw new DocumentException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, INVALID_FILE_CODE, INVALID_FILE_MESSAGE);
        }
        AuthorizedUploader uploader = (AuthorizedUploader) request.getAttribute(DocumentContract.UPLOADER_ATTRIBUTE);
        DocumentRecord document = service.upload(courseId, key, file.getOriginalFilename(), bytes, uploader);
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
