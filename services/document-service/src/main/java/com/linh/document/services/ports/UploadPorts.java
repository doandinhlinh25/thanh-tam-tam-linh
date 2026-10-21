package com.linh.document.services.ports;

import com.linh.document.model.DocumentRecord;

/** Ports connecting upload logic to separately owned infrastructure. */
public final class UploadPorts {
    private UploadPorts() {
    }

    /** Identity and tenant verified by the Tenant Service. */
    public record AuthorizedUploader(String tenantId, String userId) {
    }

    /** New document metadata assembled after upload validation. */
    public record NewDocument(String documentId, String tenantId, String courseId, String uploaderUserId,
            String idempotencyKey, String fileName, long byteSize, String checksumSha256, String storageKey) {
    }

    /** Validates an upload against the owning course service. */
    public interface AuthorizationGateway {
        /**
         * Confirms that the original user session may upload to a course.
         *
         * @param courseId requested course
         * @param cookie original session cookie
         * @return trusted tenant and user IDs
         */
        AuthorizedUploader authorize(String courseId, String cookie);
    }

    /** Stores and updates document metadata. */
    public interface Repository {
        /**
         * Finds an upload by its scoped idempotency key.
         *
         * @param tenantId verified tenant
         * @param courseId requested course
         * @param userId verified uploader
         * @param key idempotency key
         * @return existing record or null
         */
        DocumentRecord findByIdempotency(String tenantId, String courseId, String userId, String key);

        /**
         * Creates metadata without duplicating a simultaneous upload.
         *
         * @param document new metadata
         * @return created record or null if the key already exists
         */
        DocumentRecord create(NewDocument document);

        /**
         * Marks a document queued and records one ingestion job.
         *
         * @param document queued document
         * @return current metadata
         */
        DocumentRecord markQueued(DocumentRecord document);
    }

    /** Stores PDFs in private object storage. */
    public interface ObjectStore {
        /**
         * Uploads validated PDF bytes.
         *
         * @param key private object key
         * @param content PDF bytes
         */
        void put(String key, byte[] content);

        /**
         * Removes an object left by an idempotency race.
         *
         * @param key private object key
         */
        void remove(String key);
    }

    /** Publishes a versioned document ingestion request. */
    public interface IngestionQueue {
        /**
         * Publishes or reuses one job per document version.
         *
         * @param document uploaded document
         */
        void enqueue(DocumentRecord document);
    }
}
