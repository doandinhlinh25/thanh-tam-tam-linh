package com.linh.document.services.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import com.linh.document.model.DocumentRecord;
import com.linh.document.services.UploadService;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;
import com.linh.document.services.ports.UploadPorts.IngestionQueue;
import com.linh.document.services.ports.UploadPorts.NewDocument;
import com.linh.document.services.ports.UploadPorts.ObjectStore;
import com.linh.document.services.ports.UploadPorts.Repository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class UploadServiceImplTest {
    private static final String TENANT_ID = "tenant-a";
    private static final String OTHER_TENANT_ID = "tenant-b";
    private static final String COURSE_ID = "course-a";
    private static final String USER_ID = "user-a";
    private static final String KEY = "upload-key";
    private static final String FILE_NAME = "lesson.pdf";
    private static final byte[] PDF_BYTES = "%PDF-1.7\ncontent".getBytes(StandardCharsets.US_ASCII);
    @Mock private Repository repository;
    @Mock private ObjectStore objectStore;
    @Mock private IngestionQueue queue;
    private UploadService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        service = new UploadServiceImpl(repository, objectStore, queue);
    }

    @Test
    void storesUsingVerifiedTenantAndQueuesDocument() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.create(any(NewDocument.class))).thenAnswer(invocation -> {
            NewDocument input = invocation.getArgument(0);
            return record(input, DocumentContract.UPLOADED);
        });
        when(repository.markQueued(any(DocumentRecord.class))).thenAnswer(invocation -> {
            DocumentRecord input = invocation.getArgument(0);
            return withStatus(input, DocumentContract.QUEUED);
        });

        DocumentRecord result = service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        ArgumentCaptor<NewDocument> saved = ArgumentCaptor.forClass(NewDocument.class);
        verify(repository).create(saved.capture());
        assertEquals(TENANT_ID, saved.getValue().tenantId());
        assertEquals(USER_ID, saved.getValue().uploaderUserId());
        assertEquals(DocumentContract.QUEUED, result.status());
        verify(objectStore).put(saved.getValue().storageKey(), PDF_BYTES);
        verify(queue).enqueue(any(DocumentRecord.class));
    }

    @Test
    void reusesSameContentWithoutStoringAgain() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.findByIdempotency(TENANT_ID, COURSE_ID, USER_ID, KEY))
                .thenReturn(existingRecord(DocumentContract.QUEUED));

        DocumentRecord result = service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        assertEquals(DocumentContract.QUEUED, result.status());
        verify(repository, never()).create(any(NewDocument.class));
        verify(queue, never()).enqueue(any(DocumentRecord.class));
    }

    @Test
    void rejectsChangedContentForSameKey() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.findByIdempotency(TENANT_ID, COURSE_ID, USER_ID, KEY))
                .thenReturn(existingRecord(DocumentContract.QUEUED));

        DocumentException error = assertThrows(DocumentException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, "%PDF-new".getBytes(StandardCharsets.US_ASCII), uploader));

        assertEquals("DOCUMENT_IDEMPOTENCY_CONFLICT", error.code());
        verify(repository, never()).create(any(NewDocument.class));
    }

    @Test
    void scopesLookupToVerifiedTenant() {
        AuthorizedUploader uploader = new AuthorizedUploader(OTHER_TENANT_ID, USER_ID);
        when(repository.create(any(NewDocument.class))).thenAnswer(invocation ->
                record(invocation.getArgument(0), DocumentContract.UPLOADED));
        when(repository.markQueued(any(DocumentRecord.class))).thenAnswer(invocation ->
                withStatus(invocation.getArgument(0), DocumentContract.QUEUED));

        service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        verify(repository).findByIdempotency(OTHER_TENANT_ID, COURSE_ID, USER_ID, KEY);
        verify(repository, never()).findByIdempotency(TENANT_ID, COURSE_ID, USER_ID, KEY);
        verify(queue, times(1)).enqueue(any(DocumentRecord.class));
    }

    @Test
    void removesStoredPdfWhenMetadataWriteFails() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.create(any(NewDocument.class))).thenThrow(new IllegalStateException("database unavailable"));

        assertThrows(IllegalStateException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader));

        ArgumentCaptor<String> storageKey = ArgumentCaptor.forClass(String.class);
        verify(objectStore).put(storageKey.capture(), eq(PDF_BYTES));
        verify(objectStore).remove(storageKey.getValue());
        verify(queue, never()).enqueue(any(DocumentRecord.class));
    }

    @Test
    void leavesMetadataUploadedWhenQueueFailsForRetry() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.create(any(NewDocument.class))).thenAnswer(invocation ->
                record(invocation.getArgument(0), DocumentContract.UPLOADED));
        doThrow(new IllegalStateException("redis unavailable")).when(queue).enqueue(any(DocumentRecord.class));

        assertThrows(IllegalStateException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader));

        verify(repository, never()).markQueued(any(DocumentRecord.class));
    }

    private DocumentRecord existingRecord(String status) {
        NewDocument input = new NewDocument("document-a", TENANT_ID, COURSE_ID, USER_ID, KEY,
                FILE_NAME, PDF_BYTES.length,
                "275904d2c62c45e21f420f0e323ec3518a0c6223623ed1f89b9d1ebd9a5ddff3", "private-key");
        return record(input, status);
    }

    private DocumentRecord record(NewDocument input, String status) {
        return new DocumentRecord(input.documentId(), input.tenantId(), input.courseId(), input.uploaderUserId(),
                input.idempotencyKey(), input.fileName(), input.checksumSha256(), input.storageKey(), status,
                DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, Instant.EPOCH, Instant.EPOCH);
    }

    private DocumentRecord withStatus(DocumentRecord input, String status) {
        return new DocumentRecord(input.documentId(), input.tenantId(), input.courseId(), input.uploaderUserId(),
                input.idempotencyKey(), input.fileName(), input.checksumSha256(), input.storageKey(), status,
                input.documentVersion(), input.pageCount(), input.failureCode(), input.createdAt(), input.updatedAt());
    }
}
