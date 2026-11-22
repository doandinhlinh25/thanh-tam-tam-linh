package com.linh.document.repository;
import static org.junit.jupiter.api.Assertions.*;
import com.linh.document.entity.Documents;
import com.linh.document.constants.DocumentContract;
import java.net.URI;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.springframework.data.mongodb.core.*;
import org.springframework.data.mongodb.core.query.*;
import org.springframework.transaction.support.TransactionTemplate;

class MongoDocumentsRepositoryTest {
    private static SimpleMongoClientDatabaseFactory factory;
    private static MongoTemplate mongo;
    private static DocumentsRepository repository;
    private String tenant;
    @BeforeAll static void connect() {
        String uri=System.getenv("DOCUMENT_TEST_MONGODB_URI");
        Assumptions.assumeTrue(uri!=null,"NOT RUN: dedicated loopback Mongo replica set not supplied");
        URI parsed=URI.create(uri);
        assertTrue(Set.of("127.0.0.1","localhost").contains(parsed.getHost()),"Only isolated loopback test Mongo is permitted");
        assertEquals("/document_sandbox",parsed.getPath());
        factory=new SimpleMongoClientDatabaseFactory(uri);mongo=new MongoTemplate(factory);
        repository=new DocumentsRepository(mongo,new TransactionTemplate(new org.springframework.data.mongodb.MongoTransactionManager(factory)));
        repository.initializeIndexes();
    }
    @AfterAll static void close() throws Exception { if(factory!=null)factory.destroy(); }
    @BeforeEach void scope(){ tenant="r1-"+UUID.randomUUID(); }
    private Documents doc(String key) {
        return new Documents(UUID.randomUUID().toString(),tenant,"course","uploader",key,"fixture.pdf",42,
                "a".repeat(64),tenant+"/"+UUID.randomUUID()+"/1.pdf","COURSE","UPLOADED",1,null,null,null,null);
    }
    @Test void persistsMetadataAndTimestampsWithoutChangingIds() {
        Documents input=doc("persist");Documents saved=repository.createIfAbsent(input);
        assertEquals(input.documentId(),saved.documentId());assertNotNull(saved.createdAt());
        Documents read=repository.findByDocumentIdAndTenantId(input.documentId(),tenant).orElseThrow();
        assertEquals(input.checksumSha256(),read.checksumSha256());assertEquals(input.storageKey(),read.storageKey());
        assertTrue(repository.findByDocumentIdAndTenantId(input.documentId(),"other").isEmpty());
    }
    @Test void duplicateUploadKeyHasOneWinner() {
        Documents one=doc("same");assertNotNull(repository.createIfAbsent(one));
        assertNull(repository.createIfAbsent(doc("same")));
        assertEquals(1,mongo.count(new Query(Criteria.where("tenantId").is(tenant)),Documents.class));
    }
    @Test void queuesOneJobAndPreservesTenantIdentityOnRetry() {
        Documents saved=repository.createIfAbsent(doc("queued"));
        assertEquals(DocumentContract.QUEUED,repository.markQueued(saved).status());
        assertEquals(DocumentContract.QUEUED,repository.markQueued(saved).status());
        assertEquals(1,mongo.getCollection("ingestion_jobs").countDocuments(new Document("documentId",saved.documentId())));
    }
    @Test void concurrentInsertUsesTheUniqueCompoundIndex() throws Exception {
        try(var pool=Executors.newFixedThreadPool(8)){
            List<Callable<Documents>> calls=new ArrayList<>();
            for(int i=0;i<16;i++)calls.add(()->repository.createIfAbsent(doc("race")));
            int winners=0;for(Future<Documents> result:pool.invokeAll(calls))if(result.get()!=null)winners++;
            assertEquals(1,winners);
        }
    }
    @Test void concurrentQueueUpdatesCreateOneJob() throws Exception {
        Documents saved=repository.createIfAbsent(doc("queue-race"));
        try(var pool=Executors.newFixedThreadPool(8)){
            List<Callable<Documents>> calls=new ArrayList<>();
            for(int i=0;i<8;i++)calls.add(()->repository.markQueued(saved));
            for(Future<Documents> result:pool.invokeAll(calls))assertEquals("QUEUED",result.get().status());
        }
        assertEquals(1,mongo.getCollection("ingestion_jobs").countDocuments(new Document("documentId",saved.documentId())));
    }
    @Test void unrelatedStorageKeyCollisionIsNotAnIdempotentReplay() {
        Documents first=repository.createIfAbsent(doc("one"));Documents second=doc("two");
        Documents conflict=new Documents(second.documentId(),tenant,"course","uploader","two","fixture.pdf",42,"b".repeat(64),
                first.storageKey(),"COURSE","UPLOADED",1,null,null,null,null);
        assertThrows(org.springframework.dao.DuplicateKeyException.class,()->repository.createIfAbsent(conflict));
    }
    @Test void jobUniqueFailureRollsBackStatusUpdate() {
        Documents saved=repository.createIfAbsent(doc("rollback"));
        mongo.getCollection("ingestion_jobs").insertOne(new Document("_id","different-"+UUID.randomUUID())
                .append("documentId",saved.documentId()).append("documentVersion",1).append("tenantId",tenant));
        assertThrows(RuntimeException.class,()->repository.markQueued(saved));
        assertEquals("UPLOADED",repository.findByDocumentIdAndTenantId(saved.documentId(),tenant).orElseThrow().status());
    }
}
