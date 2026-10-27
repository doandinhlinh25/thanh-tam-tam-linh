package com.linh.document.services.business.impl;

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
import com.linh.document.entity.Documents;
import com.linh.document.repository.DocumentsRepository;
import com.linh.document.services.business.IUploadService;
import com.linh.document.services.authorization.AuthorizedUploader;
import com.linh.document.services.storage.IDocumentObjectStore;
import com.linh.document.services.queue.IIngestionQueue;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
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
    @Mock private DocumentsRepository repository;
    @Mock private IDocumentObjectStore objectStore;
    @Mock private IIngestionQueue queue;
    @Mock private Validator validator;
    private IUploadService service;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        when(validator.validate(any(Documents.class))).thenReturn(Set.of());
        service = new UploadServiceImpl(repository, objectStore, queue, validator);
    }

    @Test
    void storesUsingVerifiedTenantAndQueuesDocument() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.createIfAbsent(any(Documents.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(repository.markQueued(any(Documents.class))).thenAnswer(invocation -> {
            Documents input = invocation.getArgument(0);
            return withStatus(input, DocumentContract.QUEUED);
        });

        Documents result = service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        ArgumentCaptor<Documents> saved = ArgumentCaptor.forClass(Documents.class);
        verify(repository).createIfAbsent(saved.capture());
        assertEquals(TENANT_ID, saved.getValue().tenantId());
        assertEquals(USER_ID, saved.getValue().uploaderUserId());
        assertEquals(DocumentContract.QUEUED, result.status());
        verify(objectStore).put(saved.getValue().storageKey(), PDF_BYTES);
        verify(queue).enqueue(any(Documents.class));
    }

    @Test
    void reusesSameContentWithoutStoringAgain() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(TENANT_ID, COURSE_ID, USER_ID, KEY))
                .thenReturn(Optional.of(existingRecord(DocumentContract.QUEUED)));

        Documents result = service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        assertEquals(DocumentContract.QUEUED, result.status());
        verify(repository, never()).createIfAbsent(any(Documents.class));
        verify(queue, never()).enqueue(any(Documents.class));
    }

    @Test
    void rejectsChangedContentForSameKey() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(TENANT_ID, COURSE_ID, USER_ID, KEY))
                .thenReturn(Optional.of(existingRecord(DocumentContract.QUEUED)));

        DocumentException error = assertThrows(DocumentException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, "%PDF-new".getBytes(StandardCharsets.US_ASCII), uploader));

        assertEquals("DOCUMENT_IDEMPOTENCY_CONFLICT", error.code());
        verify(repository, never()).createIfAbsent(any(Documents.class));
    }

    @Test
    void scopesLookupToVerifiedTenant() {
        AuthorizedUploader uploader = new AuthorizedUploader(OTHER_TENANT_ID, USER_ID);
        when(repository.createIfAbsent(any(Documents.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(repository.markQueued(any(Documents.class))).thenAnswer(invocation ->
                withStatus(invocation.getArgument(0), DocumentContract.QUEUED));

        service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        verify(repository).findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
                OTHER_TENANT_ID, COURSE_ID, USER_ID, KEY);
        verify(repository, never()).findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
                TENANT_ID, COURSE_ID, USER_ID, KEY);
        verify(queue, times(1)).enqueue(any(Documents.class));
    }

    @Test
    void removesNewPdfAndReusesConcurrentUpload() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        Documents concurrent = existingRecord(DocumentContract.QUEUED);
        when(repository.createIfAbsent(any(Documents.class))).thenReturn(null);
        when(repository.findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
                TENANT_ID, COURSE_ID, USER_ID, KEY)).thenReturn(Optional.empty(), Optional.of(concurrent));

        Documents result = service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader);

        assertEquals(concurrent.documentId(), result.documentId());
        ArgumentCaptor<String> storageKey = ArgumentCaptor.forClass(String.class);
        verify(objectStore).put(storageKey.capture(), eq(PDF_BYTES));
        verify(objectStore).remove(storageKey.getValue());
        verify(queue, never()).enqueue(any(Documents.class));
    }

    @Test
    void removesStoredPdfWhenMetadataWriteFails() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.createIfAbsent(any(Documents.class))).thenThrow(new IllegalStateException("database unavailable"));

        assertThrows(IllegalStateException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader));

        ArgumentCaptor<String> storageKey = ArgumentCaptor.forClass(String.class);
        verify(objectStore).put(storageKey.capture(), eq(PDF_BYTES));
        verify(objectStore).remove(storageKey.getValue());
        verify(queue, never()).enqueue(any(Documents.class));
    }

    @Test
    void leavesMetadataUploadedWhenQueueFailsForRetry() {
        AuthorizedUploader uploader = new AuthorizedUploader(TENANT_ID, USER_ID);
        when(repository.createIfAbsent(any(Documents.class))).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(new IllegalStateException("redis unavailable")).when(queue).enqueue(any(Documents.class));

        assertThrows(IllegalStateException.class,
                () -> service.upload(COURSE_ID, KEY, FILE_NAME, PDF_BYTES, uploader));

        verify(repository, never()).markQueued(any(Documents.class));
    }

    private Documents existingRecord(String status) {
        return new Documents("document-a", TENANT_ID, COURSE_ID, USER_ID, KEY, FILE_NAME, PDF_BYTES.length,
                "275904d2c62c45e21f420f0e323ec3518a0c6223623ed1f89b9d1ebd9a5ddff3", "private-key",
                DocumentContract.COURSE_SCOPE, status,
                DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, Instant.EPOCH, Instant.EPOCH);
    }

    private Documents withStatus(Documents input, String status) {
        return new Documents(input.documentId(), input.tenantId(), input.courseId(), input.uploaderUserId(),
                input.idempotencyKey(), input.fileName(), input.byteSize(), input.checksumSha256(),
                input.storageKey(), input.accessScope(), status,
                input.documentVersion(), input.pageCount(), input.failureCode(), input.createdAt(), input.updatedAt());
    }
}
