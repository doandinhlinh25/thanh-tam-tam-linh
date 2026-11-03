package com.linh.document.services.queue.impl;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.linh.document.constants.DocumentContract;
import com.linh.document.entity.Documents;
import com.linh.document.exception.DocumentException;
import com.linh.document.utils.IngestionJobIds;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;

class RedisIngestionQueueImplTest {
    private static final String DOCUMENT_ID = "document-a";
    private static final String TENANT_ID = "tenant-a";
    private static final String REDIS_PORT_ENV = "P03_REDIS_PORT";
    private static final String LOCALHOST = "127.0.0.1";
    private static final String DEDUP_PREFIX = "document-ingestion:published:";
    private static final long NO_EXPIRY = -1L;

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
        assertEquals(DEDUP_PREFIX + jobId, keys.getValue().get(0));
        JsonNode event = new ObjectMapper().readTree(payload.getValue());
        assertEquals(DocumentContract.INGEST_EVENT, event.path("event").asText());
        assertEquals(DocumentContract.EVENT_VERSION, event.path("eventVersion").asInt());
        assertEquals(jobId, event.path("jobId").asText());
        assertEquals(TENANT_ID, event.path("tenantId").asText());
        assertEquals(DOCUMENT_ID, event.path("documentId").asText());
        assertEquals(DocumentContract.INITIAL_DOCUMENT_VERSION, event.path("documentVersion").asInt());
        Instant.parse(event.path("occurredAt").asText());
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

    @Test
    void publishesOnlyOneEventForRepeatedDocumentOnIsolatedRedis() {
        String portValue = System.getenv(REDIS_PORT_ENV);
        assumeTrue(portValue != null && !portValue.isBlank(), "isolated Redis port not configured");
        LettuceConnectionFactory factory = new LettuceConnectionFactory(LOCALHOST, Integer.parseInt(portValue));
        factory.afterPropertiesSet();
        try {
            StringRedisTemplate redis = new StringRedisTemplate(factory);
            redis.afterPropertiesSet();
            Documents record = document(UUID.randomUUID().toString());
            String jobId = IngestionJobIds.forDocument(record);
            String dedupKey = DEDUP_PREFIX + jobId;
            long initialEvents = redis.opsForStream().size(DocumentContract.INGEST_STREAM);
            RedisIngestionQueueImpl queue = new RedisIngestionQueueImpl(redis, new ObjectMapper());

            queue.enqueue(record);
            queue.enqueue(record);

            assertEquals(initialEvents + 1, redis.opsForStream().size(DocumentContract.INGEST_STREAM));
            assertEquals(Boolean.TRUE, redis.hasKey(dedupKey));
            assertEquals(NO_EXPIRY, redis.getExpire(dedupKey));
        } finally {
            factory.destroy();
        }
    }

    private Documents document() {
        return document(DOCUMENT_ID);
    }

    private Documents document(String documentId) {
        return new Documents(documentId, TENANT_ID, "course-a", "user-a", "key-a", "lesson.pdf", 8,
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", "private-key",
                DocumentContract.COURSE_SCOPE, DocumentContract.UPLOADED,
                DocumentContract.INITIAL_DOCUMENT_VERSION, null, null, Instant.EPOCH, Instant.EPOCH);
    }
}
