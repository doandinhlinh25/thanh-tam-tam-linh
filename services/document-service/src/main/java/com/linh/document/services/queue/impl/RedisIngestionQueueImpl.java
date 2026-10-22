package com.linh.document.services.queue.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.linh.document.constants.DocumentContract;
import com.linh.document.exception.DocumentException;
import com.linh.document.entity.Documents;
import com.linh.document.services.queue.IIngestionQueue;
import com.linh.document.utils.IngestionJobIds;
import java.time.Instant;
import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Gửi một thông điệp xử lý dữ liệu cho mỗi phiên bản tài liệu vào Redis Stream. */
@Component
public class RedisIngestionQueueImpl implements IIngestionQueue {
    private static final String DEDUP_PREFIX = "document-ingestion:published:";
    private static final String PAYLOAD_FIELD = "payload";
    private static final String EVENT_FIELD = "event";
    private static final String EVENT_VERSION_FIELD = "eventVersion";
    private static final String JOB_ID_FIELD = "jobId";
    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String DOCUMENT_ID_FIELD = "documentId";
    private static final String DOCUMENT_VERSION_FIELD = "documentVersion";
    private static final String OCCURRED_AT_FIELD = "occurredAt";
    private static final String QUEUE_ERROR_CODE = "DOCUMENT_QUEUE_UNAVAILABLE";
    private static final String QUEUE_ERROR_MESSAGE = "Không thể đưa tài liệu vào hàng đợi";
    private static final String PUBLISH_SCRIPT = """
            if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
            redis.call('XADD', KEYS[2], '*', ARGV[1], ARGV[2])
            redis.call('SET', KEYS[1], ARGV[3])
            return 1
            """;
    private final StringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final DefaultRedisScript<Long> script;

    /**
     * Cấu hình việc gửi thông điệp nguyên tử và loại bỏ trùng lặp.
     *
     * @param redis ứng dụng khách Redis
     * @param objectMapper bộ xử lý JSON
     */
    public RedisIngestionQueueImpl(StringRedisTemplate redis, ObjectMapper objectMapper) {
        this.redis = redis;
        this.objectMapper = objectMapper;
        this.script = new DefaultRedisScript<>(PUBLISH_SCRIPT, Long.class);
    }

    /** {@inheritDoc} */
    @Override
    public void enqueue(Documents document) {
        String jobId = IngestionJobIds.forDocument(document);
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                    EVENT_FIELD, DocumentContract.INGEST_EVENT,
                    EVENT_VERSION_FIELD, DocumentContract.EVENT_VERSION,
                    JOB_ID_FIELD, jobId,
                    TENANT_ID_FIELD, document.tenantId(),
                    DOCUMENT_ID_FIELD, document.documentId(),
                    DOCUMENT_VERSION_FIELD, document.documentVersion(),
                    OCCURRED_AT_FIELD, Instant.now().toString()));
            redis.execute(script, java.util.List.of(DEDUP_PREFIX + jobId, DocumentContract.INGEST_STREAM),
                    PAYLOAD_FIELD, payload, jobId);
        } catch (JsonProcessingException | RuntimeException error) {
            throw new DocumentException(HttpStatus.SERVICE_UNAVAILABLE, QUEUE_ERROR_CODE, QUEUE_ERROR_MESSAGE);
        }
    }
}
