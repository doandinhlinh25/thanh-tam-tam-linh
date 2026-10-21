package com.linh.document.services.impl;

import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import com.linh.document.model.DocumentRecord;
import com.linh.document.services.UploadService;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;
import com.linh.document.services.ports.UploadPorts.IngestionQueue;
import com.linh.document.services.ports.UploadPorts.NewDocument;
import com.linh.document.services.ports.UploadPorts.ObjectStore;
import com.linh.document.services.ports.UploadPorts.Repository;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Coordinates one authorized PDF upload across storage, metadata, and ingestion. */
@Service
public class UploadServiceImpl implements UploadService {
    private static final String HASH_ALGORITHM = "SHA-256";
    private static final String STORAGE_SEPARATOR = "/";
    private static final String KEY_CONFLICT_CODE = "DOCUMENT_IDEMPOTENCY_CONFLICT";
    private static final String KEY_CONFLICT_MESSAGE = "Khóa upload đã được dùng cho nội dung khác";
    private static final String MISSING_CONCURRENT_MESSAGE = "Không tìm thấy tài liệu sau xung đột khóa upload";
    private final Repository repository;
    private final ObjectStore objectStore;
    private final IngestionQueue queue;

    /**
     * Connects the upload workflow to its adapters.
     *
     * @param repository document metadata store
     * @param objectStore PDF store
     * @param queue ingestion publisher
     */
    public UploadServiceImpl(Repository repository, ObjectStore objectStore, IngestionQueue queue) {
        this.repository = repository;
        this.objectStore = objectStore;
        this.queue = queue;
    }

    /**
     * Stores a validated PDF and requests ingestion before returning success.
     *
     * @param courseId authorized course
     * @param idempotencyKey client upload key
     * @param fileName original file name
     * @param bytes validated PDF bytes
     * @param uploader verified tenant and user
     * @return stored document metadata
     */
    @Override
    public DocumentRecord upload(String courseId, String idempotencyKey, String fileName,
            byte[] bytes, AuthorizedUploader uploader) {
        String checksum = checksum(bytes);
        DocumentRecord existing = repository.findByIdempotency(uploader.tenantId(), courseId,
                uploader.userId(), idempotencyKey);
        if (existing != null) {
            return reuseExisting(existing, checksum);
        }
        String documentId = UUID.randomUUID().toString();
        String storageKey = String.join(STORAGE_SEPARATOR, uploader.tenantId(), courseId, documentId,
                DocumentContract.INITIAL_DOCUMENT_VERSION + DocumentContract.PDF_EXTENSION);
        String safeFileName = fileName.replace('\\', '/');
        safeFileName = safeFileName.substring(safeFileName.lastIndexOf(STORAGE_SEPARATOR) + STORAGE_SEPARATOR.length());
        NewDocument document = new NewDocument(documentId, uploader.tenantId(), courseId, uploader.userId(),
                idempotencyKey, safeFileName, bytes.length, checksum, storageKey);
        objectStore.put(storageKey, bytes);
        DocumentRecord created;
        try {
            created = repository.create(document);
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
            DocumentRecord concurrent = repository.findByIdempotency(uploader.tenantId(), courseId,
                    uploader.userId(), idempotencyKey);
            if (concurrent == null) {
                throw new IllegalStateException(MISSING_CONCURRENT_MESSAGE);
            }
            return reuseExisting(concurrent, checksum);
        }
        return enqueueIfRequired(created);
    }

    private DocumentRecord reuseExisting(DocumentRecord record, String checksum) {
        if (!hasSameContent(record, checksum)) {
            throw new DocumentException(HttpStatus.CONFLICT, KEY_CONFLICT_CODE, KEY_CONFLICT_MESSAGE);
        }
        return enqueueIfRequired(record);
    }

    private DocumentRecord enqueueIfRequired(DocumentRecord record) {
        if (!DocumentContract.UPLOADED.equals(record.status())) {
            return record;
        }
        queue.enqueue(record);
        return repository.markQueued(record);
    }

    private boolean hasSameContent(DocumentRecord record, String checksum) {
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
