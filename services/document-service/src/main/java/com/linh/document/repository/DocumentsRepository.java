package com.linh.document.repository;

import com.linh.document.constants.DocumentContract;
import com.linh.document.entity.Documents;
import com.linh.document.utils.IngestionJobIds;
import com.mongodb.MongoException;
import jakarta.annotation.PostConstruct;
import java.time.Instant;
import java.util.Optional;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionTemplate;

/** Upload metadata/jobs belong exclusively to the configured Document database. */
@Repository
public class DocumentsRepository {
    public static final String DOCUMENTS = "documents";
    public static final String JOBS = "ingestion_jobs";
    private final MongoTemplate mongo;
    private final TransactionTemplate transactions;

    /**
     * @param mongo client scoped to the Document database
     * @param transactions local replica-set transaction boundary
     */
    public DocumentsRepository(MongoTemplate mongo, TransactionTemplate transactions) {
        this.mongo = mongo;
        this.transactions = transactions;
    }

    /** Equivalent to the old SQL unique constraints; no cross-database indexes. */
    @PostConstruct
    public void initializeIndexes() {
        mongo.indexOps(DOCUMENTS).ensureIndex(new Index()
                .on("tenantId", Sort.Direction.ASC).on("courseId", Sort.Direction.ASC)
                .on("uploaderUserId", Sort.Direction.ASC).on("idempotencyKey", Sort.Direction.ASC)
                .unique().named("upload_idempotency"));
        mongo.indexOps(DOCUMENTS).ensureIndex(new Index().on("storageKey", Sort.Direction.ASC)
                .unique().named("unique_storage_key"));
        mongo.indexOps(DOCUMENTS).ensureIndex(new Index().on("tenantId", Sort.Direction.ASC)
                .on("courseId", Sort.Direction.ASC).named("tenant_course"));
        mongo.indexOps(JOBS).ensureIndex(new Index().on("documentId", Sort.Direction.ASC)
                .on("documentVersion", Sort.Direction.ASC).unique().named("document_version"));
    }

    /**
     * @param tenantId verified tenant
     * @param courseId verified course
     * @param uploaderUserId verified account
     * @param key caller idempotency key
     * @return existing upload within that exact scope
     */
    public Optional<Documents> findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
            String tenantId, String courseId, String uploaderUserId, String key) {
        return Optional.ofNullable(mongo.findOne(new Query(Criteria.where("tenantId").is(tenantId)
                .and("courseId").is(courseId).and("uploaderUserId").is(uploaderUserId)
                .and("idempotencyKey").is(key)), Documents.class));
    }

    /**
     * @param id stable document UUID
     * @param tenantId verified owning tenant
     * @return tenant-scoped metadata
     */
    public Optional<Documents> findByDocumentIdAndTenantId(String id, String tenantId) {
        return Optional.ofNullable(mongo.findOne(new Query(Criteria.where("_id").is(id)
                .and("tenantId").is(tenantId)), Documents.class));
    }

    /**
     * An idempotency loser returns null; unrelated unique-key failures remain errors.
     * @param document validated upload metadata
     * @return inserted document, or null for a duplicate scoped upload key
     */
    public Documents createIfAbsent(Documents document) {
        try {
            return mongo.insert(document);
        } catch (DuplicateKeyException error) {
            if (findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(document.tenantId(),
                    document.courseId(), document.uploaderUserId(), document.idempotencyKey()).isPresent()) {
                return null;
            }
            throw error;
        }
    }

    /**
     * Job creation and status update are atomic in Mongo, not across S3 or Redis.
     * @param document metadata whose event was sent using the existing Redis dedup mechanism
     * @return the current tenant-scoped state, after bounded transaction retries
     */
    public Documents markQueued(Documents document) {
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                return transactions.execute(status -> {
                    mongo.upsert(new Query(Criteria.where("_id").is(IngestionJobIds.forDocument(document))),
                            new Update().setOnInsert("documentId", document.documentId())
                                    .setOnInsert("tenantId", document.tenantId())
                                    .setOnInsert("documentVersion", document.documentVersion())
                                    .setOnInsert("status", DocumentContract.QUEUED)
                                    .setOnInsert("createdAt", Instant.now()), JOBS);
                    mongo.updateFirst(new Query(Criteria.where("_id").is(document.documentId())
                                    .and("tenantId").is(document.tenantId())
                                    .and("status").is(DocumentContract.UPLOADED)),
                            new Update().set("status", DocumentContract.QUEUED)
                                    .set("updatedAt", Instant.now()), Documents.class);
                    return findByDocumentIdAndTenantId(document.documentId(), document.tenantId()).orElseThrow();
                });
            } catch (RuntimeException error) {
                if (attempt == 4 || !retryable(error)) throw error;
                try {
                    Thread.sleep(10L << attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw error;
                }
            }
        }
        throw new IllegalStateException("Document transaction could not complete");
    }

    private boolean retryable(Throwable error) {
        for (Throwable current = error; current != null; current = current.getCause()) {
            if (current instanceof DuplicateKeyException) return true;
            if (current instanceof MongoException mongoError &&
                    (mongoError.hasErrorLabel("TransientTransactionError")
                            || mongoError.hasErrorLabel("UnknownTransactionCommitResult"))) return true;
        }
        return false;
    }
}
