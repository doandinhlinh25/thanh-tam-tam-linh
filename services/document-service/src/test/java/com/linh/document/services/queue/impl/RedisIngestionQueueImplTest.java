package com.linh.document.services.queue.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.constants.DocumentContract;
import com.linh.document.entity.Documents;
import com.linh.document.exception.DocumentException;
import com.linh.document.utils.IngestionJobIds;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;

class RedisIngestionQueueImplTest {
    private static final String DOCUMENT_ID = "document-a";
    private static final String TENANT_ID = "tenant-a";

    @Test
    @SuppressWarnings("unchecked")
    void publishesExistingEventContractToStreamWithDedupKey() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        RedisIngestionQueueImpl queue = new RedisIngestionQueueImpl(redis, new ObjectMapper());
        Documents document = document();
        String jobId = IngestionJobIds.forDocument(document);
        queue.enqueue(document);
        ArgumentCaptor<List<String>> keys = ArgumentCaptor.forClass(List.class);
        ArgumentCaptor<String> payload = ArgumentCaptor.forClass(String.class);
        verify(redis).execute(any(DefaultRedisScript.class), keys.capture(),
                org.mockito.ArgumentMatchers.eq("payload"), payload.capture(), org.mockito.ArgumentMatchers.eq(jobId));
        assertEquals(DocumentContract.INGEST_STREAM, keys.getValue().get(1));
        assertTrue(keys.getValue().get(0).endsWith(jobId));
        assertEquals(DocumentContract.INGEST_EVENT,
                new ObjectMapper().readTree(payload.getValue()).path("event").asText());
        assertEquals(DOCUMENT_ID, new ObjectMapper().readTree(payload.getValue()).path("documentId").asText());
    }

    @Test
    void mapsRedisFailureToUnavailable() {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        when(redis.execute(any(DefaultRedisScript.class), any(List.class), any(String.class), any(String.class),
                any(String.class))).thenThrow(new IllegalStateException("redis down"));
        RedisIngestionQueueImpl queue = new RedisIngestionQueueImpl(redis, new ObjectMapper());
        DocumentException error = assertThrows(DocumentException.class, () -> queue.enqueue(document()));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.status());
    }

    private Documents document() {
        return new Documents(DOCUMENT_ID, TENANT_ID, "course-a", "user-a", "key-a", "lesson.pdf", 8,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "private-key",
                DocumentContract.COURSE_SCOPE, DocumentContract.UPLOADED,
                DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, Instant.EPOCH, Instant.EPOCH);
    }
}
