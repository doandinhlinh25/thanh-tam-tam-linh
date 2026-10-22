package com.linh.document.services.business.impl;

import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import com.linh.document.entity.Documents;
import com.linh.document.repository.DocumentsRepository;
import com.linh.document.services.business.IUploadService;
import com.linh.document.services.authorization.AuthorizedUploader;
import com.linh.document.services.storage.IDocumentObjectStore;
import com.linh.document.services.queue.IIngestionQueue;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Điều phối một lượt tải PDF đã được cấp quyền qua các bước lưu tệp, lưu siêu dữ liệu và xử lý dữ liệu. */
@Service
public class UploadServiceImpl implements IUploadService {
    private static final String HASH_ALGORITHM = "SHA-256";
    private static final String STORAGE_SEPARATOR = "/";
    private static final String KEY_CONFLICT_CODE = "DOCUMENT_IDEMPOTENCY_CONFLICT";
    private static final String KEY_CONFLICT_MESSAGE = "Khóa upload đã được dùng cho nội dung khác";
    private static final String MISSING_CONCURRENT_MESSAGE = "Không tìm thấy tài liệu sau xung đột khóa upload";
    private final DocumentsRepository repository;
    private final IDocumentObjectStore objectStore;
    private final IIngestionQueue queue;
    private final Validator validator;

    /**
     * Kết nối quy trình tải lên với các bộ kết nối hạ tầng.
     *
     * @param repository kho tài liệu Spring Data JPA
     * @param objectStore kho lưu trữ tệp PDF
     * @param queue bộ gửi yêu cầu xử lý dữ liệu
     * @param validator bộ kiểm tra ràng buộc dữ liệu của thực thể
     */
    public UploadServiceImpl(DocumentsRepository repository, IDocumentObjectStore objectStore,
            IIngestionQueue queue, Validator validator) {
        this.repository = repository;
        this.objectStore = objectStore;
        this.queue = queue;
        this.validator = validator;
    }

    /**
     * Lưu tệp PDF đã kiểm tra và yêu cầu xử lý dữ liệu trước khi trả về thành công.
     *
     * @param courseId mã khóa học
     * @param idempotencyKey khóa chống trùng của lượt tải lên
     * @param fileName tên tệp gốc
     * @param bytes dữ liệu tệp PDF được tải lên
     * @param uploader tenant và người tải lên đã được xác minh
     * @return siêu dữ liệu tài liệu đã lưu
     */
    @Override
    public Documents upload(String courseId, String idempotencyKey, String fileName,
            byte[] bytes, AuthorizedUploader uploader) {
        String checksum = checksum(bytes);
        Documents existing = repository.findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
                uploader.tenantId(), courseId, uploader.userId(), idempotencyKey).orElse(null);
        if (existing != null) {
            return reuseExisting(existing, checksum);
        }
        String documentId = UUID.randomUUID().toString();
        String storageKey = String.join(STORAGE_SEPARATOR, uploader.tenantId(), courseId, documentId,
                DocumentContract.INITIAL_DOCUMENT_VERSION + DocumentContract.PDF_EXTENSION);
        String safeFileName = fileName.replace('\\', '/');
        safeFileName = safeFileName.substring(safeFileName.lastIndexOf(STORAGE_SEPARATOR) + STORAGE_SEPARATOR.length());
        Documents document = new Documents(documentId, uploader.tenantId(), courseId, uploader.userId(),
                idempotencyKey, safeFileName, bytes.length, checksum, storageKey, DocumentContract.COURSE_SCOPE,
                DocumentContract.UPLOADED, DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, null, null);
        Set<ConstraintViolation<Documents>> violations = validator.validate(document);
        if (!violations.isEmpty()) {
            throw new ConstraintViolationException(violations);
        }
        objectStore.put(storageKey, bytes);
        Documents created;
        try {
            created = repository.createIfAbsent(document);
        } catch (RuntimeException error) {
            try {
                objectStore.remove(storageKey);
            } catch (RuntimeException cleanupError) {
                error.addSuppressed(cleanupError);
            }
            throw error;
        }
        if (created == null) {
            objectStore.remove(storageKey);
            Documents concurrent = repository.findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
                    uploader.tenantId(), courseId, uploader.userId(), idempotencyKey).orElse(null);
            if (concurrent == null) {
                throw new IllegalStateException(MISSING_CONCURRENT_MESSAGE);
            }
            return reuseExisting(concurrent, checksum);
        }
        return enqueueIfRequired(created);
    }

    private Documents reuseExisting(Documents record, String checksum) {
        if (!hasSameContent(record, checksum)) {
            throw new DocumentException(HttpStatus.CONFLICT, KEY_CONFLICT_CODE, KEY_CONFLICT_MESSAGE);
        }
        return enqueueIfRequired(record);
    }

    private Documents enqueueIfRequired(Documents record) {
        if (!DocumentContract.UPLOADED.equals(record.status())) {
            return record;
        }
        queue.enqueue(record);
        return repository.markQueued(record);
    }

    private boolean hasSameContent(Documents record, String checksum) {
        return record.checksumSha256().equals(checksum);
    }

    private String checksum(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }
}
