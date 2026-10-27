package com.linh.document.controller;

import com.linh.document.dto.response.ApiResponse;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;

/** Reports liveness and checks the upload dependencies without writing data. */
@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;
    private final S3Client s3;
    private final String bucket;

    /** Creates the dependency readiness probe. */
    public HealthController(JdbcTemplate jdbc, StringRedisTemplate redis, S3Client s3,
            @Value("${document.s3.bucket}") String bucket) {
        this.jdbc = jdbc;
        this.redis = redis;
        this.s3 = s3;
        this.bucket = bucket;
    }

    /** Reports whether the HTTP process is alive. */
    @GetMapping({"/health", "/health/live"})
    public ApiResponse<Map<String, String>> live() {
        return ApiResponse.success(Map.of("service", "document-service", "status", "ok"));
    }

    /** Checks PostgreSQL, Redis and access to the private S3 bucket. */
    @GetMapping("/health/ready")
    public ResponseEntity<?> ready() {
        try {
            if (!Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class))) {
                throw new IllegalStateException("Database unavailable");
            }
            // A successful SQL ping alone does not prove that the migration was applied.
            jdbc.queryForObject("SELECT count(*) FROM documents WHERE false", Long.class);
            jdbc.queryForObject("SELECT count(*) FROM ingestion_jobs WHERE false", Long.class);
            var factory = redis.getConnectionFactory();
            if (factory == null) throw new IllegalStateException("Redis unavailable");
            try (var connection = factory.getConnection()) {
                if (!"PONG".equals(connection.ping())) throw new IllegalStateException("Redis unavailable");
            }
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            return ResponseEntity.ok(ApiResponse.success(Map.of("service", "document-service", "status", "ready")));
        } catch (Exception error) {
            return ResponseEntity.status(503).body(ApiResponse.failure(new ApiResponse.ApiError(
                    "DOCUMENT_DEPENDENCY_UNAVAILABLE", "Upload dependencies are not ready", Map.of())));
        }
    }
}
