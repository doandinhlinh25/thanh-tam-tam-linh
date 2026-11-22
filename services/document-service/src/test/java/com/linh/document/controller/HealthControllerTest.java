package com.linh.document.controller;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import software.amazon.awssdk.services.s3.S3Client;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.ListIndexesIterable;

class HealthControllerTest {
    private MongoTemplate mongo;
    private StringRedisTemplate redis;
    private S3Client s3;
    private HealthController controller;
    @BeforeEach void setUp() {
        mongo=mock(MongoTemplate.class); redis=mock(StringRedisTemplate.class); s3=mock(S3Client.class);
        controller=new HealthController(mongo,redis,s3,"sandbox-private");
    }
    @Test void livenessDoesNotRequireDependencies() {
        assertEquals("ok",controller.live().data().get("status"));
        verifyNoInteractions(mongo,redis,s3);
    }
    @Test void readinessRequiresMongoCollectionsRedisAndBucket() {
        MongoCollection<Document> collection=mock(MongoCollection.class);
        ListIndexesIterable<Document> indexes=mock(ListIndexesIterable.class);
        when(mongo.getCollection(anyString())).thenReturn(collection);
        when(collection.listIndexes()).thenReturn(indexes);
        when(indexes.first()).thenReturn(new Document("name","_id_"));
        var factory=mock(RedisConnectionFactory.class);var connection=mock(RedisConnection.class);
        when(redis.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(connection);when(connection.ping()).thenReturn("PONG");
        assertEquals(200,controller.ready().getStatusCode().value());
        verify(mongo).executeCommand(new Document("ping",1));
        verify(mongo).getCollection("documents");verify(mongo).getCollection("ingestion_jobs");
        verify(connection).close();verify(s3).headBucket(any(software.amazon.awssdk.services.s3.model.HeadBucketRequest.class));
    }
    @Test void unavailableDependencyReturns503WithoutConnectionDetails() {
        when(mongo.executeCommand(any(Document.class))).thenThrow(new IllegalStateException("private-database-password"));
        var response=controller.ready();assertEquals(503,response.getStatusCode().value());
        assertFalse(response.getBody().toString().contains("private-database-password"));
        verifyNoInteractions(redis,s3);
    }
}
