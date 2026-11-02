package com.linh.document.services.storage.impl;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import java.io.IOException;
import java.io.InputStream;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

class S3DocumentObjectStoreImplTest {
    private static final String BUCKET = "private-documents";
    private static final String KEY = "tenant/course/document/1.pdf";
    private static final byte[] PDF = {0x25, 0x50, 0x44, 0x46, 0x2D, 0x00, (byte) 0xFF, 0x12, 0x34};

    @Test
    void writesPdfToConfiguredBucketWithPdfMime() throws IOException {
        S3Client client = mock(S3Client.class);
        S3DocumentObjectStoreImpl store = new S3DocumentObjectStoreImpl(client, BUCKET);
        store.put(KEY, PDF);
        ArgumentCaptor<PutObjectRequest> request = ArgumentCaptor.forClass(PutObjectRequest.class);
        ArgumentCaptor<RequestBody> body = ArgumentCaptor.forClass(RequestBody.class);
        verify(client).putObject(request.capture(), body.capture());
        assertEquals(BUCKET, request.getValue().bucket());
        assertEquals(KEY, request.getValue().key());
        assertEquals(DocumentContract.PDF_MIME, request.getValue().contentType());
        try (InputStream payload = body.getValue().contentStreamProvider().newStream()) {
            assertArrayEquals(PDF, payload.readAllBytes());
        }
    }

    @Test
    void removesOnlySpecifiedObject() {
        S3Client client = mock(S3Client.class);
        S3DocumentObjectStoreImpl store = new S3DocumentObjectStoreImpl(client, BUCKET);
        store.remove(KEY);
        ArgumentCaptor<DeleteObjectRequest> request = ArgumentCaptor.forClass(DeleteObjectRequest.class);
        verify(client).deleteObject(request.capture());
        assertEquals(BUCKET, request.getValue().bucket());
        assertEquals(KEY, request.getValue().key());
    }

    @Test
    void mapsPutAndDeleteFailuresToUnavailable() {
        S3Client client = mock(S3Client.class);
        S3DocumentObjectStoreImpl store = new S3DocumentObjectStoreImpl(client, BUCKET);
        doThrow(new IllegalStateException("storage down")).when(client)
                .putObject(any(PutObjectRequest.class), any(RequestBody.class));
        DocumentException putError = assertThrows(DocumentException.class, () -> store.put(KEY, PDF));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, putError.status());
        doThrow(new IllegalStateException("storage down")).when(client).deleteObject(any(DeleteObjectRequest.class));
        DocumentException deleteError = assertThrows(DocumentException.class, () -> store.remove(KEY));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, deleteError.status());
    }
}
