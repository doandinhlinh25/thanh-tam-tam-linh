package com.linh.document.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import software.amazon.awssdk.services.s3.S3Client;

class HealthControllerTest {
    private JdbcTemplate jdbc;
    private StringRedisTemplate redis;
    private S3Client s3;
    private HealthController controller;

    @BeforeEach
    void setUp() {
        jdbc = mock(JdbcTemplate.class);
        redis = mock(StringRedisTemplate.class);
        s3 = mock(S3Client.class);
        controller = new HealthController(jdbc, redis, s3, "sandbox-private");
    }

    @Test
    void livenessDoesNotRequireDependencies() {
        assertEquals("ok", controller.live().data().get("status"));
        verifyNoInteractions(jdbc, redis, s3);
    }

    @Test
    void readinessRequiresMigratedDatabaseRedisAndBucket() {
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        var factory = mock(RedisConnectionFactory.class);
        var connection = mock(RedisConnection.class);
        when(redis.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn("PONG");
        assertEquals(200, controller.ready().getStatusCode().value());
        verify(jdbc).queryForObject("SELECT count(*) FROM documents WHERE false", Long.class);
        verify(jdbc).queryForObject("SELECT count(*) FROM ingestion_jobs WHERE false", Long.class);
        verify(connection).close();
        verify(s3).headBucket(any(software.amazon.awssdk.services.s3.model.HeadBucketRequest.class));
    }

    @Test
    void unavailableDependencyReturns503WithoutConnectionDetails() {
        when(jdbc.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new IllegalStateException("private-database-password"));
        var response = controller.ready();
        assertEquals(503, response.getStatusCode().value());
        org.junit.jupiter.api.Assertions.assertFalse(response.getBody().toString().contains("private-database-password"));
        verifyNoInteractions(redis, s3);
    }
}
