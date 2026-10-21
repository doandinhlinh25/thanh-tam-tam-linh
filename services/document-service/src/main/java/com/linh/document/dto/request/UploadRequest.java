package com.linh.document.dto.request;

import com.linh.document.constants.DocumentContract;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import org.springframework.web.multipart.MultipartFile;

/** Multipart upload fields checked at the HTTP boundary. */
public record UploadRequest(String courseId, String idempotencyKey, MultipartFile file) {
    /**
     * Checks required upload fields before reading PDF bytes.
     *
     * @return true when all required fields are present
     */
    public boolean hasRequiredFields() {
        return courseId != null && !courseId.isBlank()
                && idempotencyKey != null && !idempotencyKey.isBlank()
                && idempotencyKey.length() <= DocumentContract.MAX_KEY_LENGTH
                && file != null && !file.isEmpty();
    }

    /**
     * Checks PDF media type, filename, and file signature.
     *
     * @param bytes uploaded file bytes
     * @return true when the file has a PDF signature and expected metadata
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
