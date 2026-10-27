package com.linh.document.services.storage.impl;

import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import com.linh.document.services.storage.IDocumentObjectStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

/** Ghi dữ liệu PDF vào bucket riêng tương thích với S3. */
@Component
public class S3DocumentObjectStoreImpl implements IDocumentObjectStore {
    private static final String ERROR_CODE = "DOCUMENT_STORAGE_UNAVAILABLE";
    private static final String ERROR_MESSAGE = "Không thể lưu tệp PDF";
    private final S3Client client;
    private final String bucket;

    /**
     * Cấu hình kho lưu trữ đối tượng.
     *
     * @param client ứng dụng khách tương thích với S3
     * @param bucket tên bucket riêng tư
     */
    public S3DocumentObjectStoreImpl(S3Client client, @Value("${document.s3.bucket}") String bucket) {
        this.client = client;
        this.bucket = bucket;
    }

    /** {@inheritDoc} */
    @Override
    public void put(String key, byte[] content) {
        try {
            PutObjectRequest request = PutObjectRequest.builder().bucket(bucket).key(key)
                    .contentType(DocumentContract.PDF_MIME).build();
            client.putObject(request, RequestBody.fromBytes(content));
        } catch (RuntimeException error) {
            throw new DocumentException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE, ERROR_MESSAGE);
        }
    }

    /** {@inheritDoc} */
    @Override
    public void remove(String key) {
        try {
            client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
        } catch (RuntimeException error) {
            throw new DocumentException(HttpStatus.SERVICE_UNAVAILABLE, ERROR_CODE, ERROR_MESSAGE);
        }
    }
}
