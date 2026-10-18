package com.linh.document.infrastructure.persistence;

import com.linh.document.constants.DocumentContract;
import com.linh.document.model.DocumentRecord;
import com.linh.document.services.ports.UploadPorts.NewDocument;
import com.linh.document.services.ports.UploadPorts.Repository;
import com.linh.document.services.support.IngestionJobIds;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Stores tenant-scoped document metadata and ingestion jobs in PostgreSQL. */
@Component
public class PostgresDocumentRepository implements Repository {
    private static final String SELECT_BY_KEY = """
            SELECT * FROM documents WHERE tenant_id = ? AND course_id = ?
              AND uploader_user_id = ? AND idempotency_key = ?
            """;
    private static final String INSERT_DOCUMENT = """
            INSERT INTO documents (document_id, tenant_id, course_id, uploader_user_id,
              idempotency_key, file_name, byte_size, checksum_sha256, storage_key,
              status, document_version, access_scope)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, course_id, uploader_user_id, idempotency_key) DO NOTHING
            RETURNING *
            """;
    private static final String INSERT_JOB = """
            INSERT INTO ingestion_jobs (job_id, document_id, tenant_id, document_version, status)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (job_id) DO NOTHING
            """;
    private static final String MARK_QUEUED = """
            UPDATE documents SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE document_id = ? AND tenant_id = ? AND status = ?
            """;
    private static final String SELECT_BY_ID = "SELECT * FROM documents WHERE document_id = ? AND tenant_id = ?";
    private static final RowMapper<DocumentRecord> DOCUMENT_MAPPER = PostgresDocumentRepository::mapDocument;
    private final JdbcTemplate jdbc;

    /**
     * Creates the PostgreSQL adapter.
     *
     * @param jdbc configured database client
     */
    public PostgresDocumentRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** {@inheritDoc} */
    @Override
    public DocumentRecord findByIdempotency(String tenantId, String courseId, String userId, String key) {
        return jdbc.query(SELECT_BY_KEY, DOCUMENT_MAPPER, tenantId, courseId, userId, key)
                .stream().findFirst().orElse(null);
    }

    /** {@inheritDoc} */
    @Override
    public DocumentRecord create(NewDocument document) {
        return jdbc.query(INSERT_DOCUMENT, DOCUMENT_MAPPER, document.documentId(), document.tenantId(),
                document.courseId(), document.uploaderUserId(), document.idempotencyKey(),
                document.fileName(), document.byteSize(), document.checksumSha256(), document.storageKey(),
                DocumentContract.UPLOADED, DocumentContract.INITIAL_DOCUMENT_VERSION, DocumentContract.COURSE_SCOPE)
                .stream().findFirst().orElse(null);
    }

    /** {@inheritDoc} */
    @Override
    @Transactional
    public DocumentRecord markQueued(DocumentRecord document) {
        jdbc.update(INSERT_JOB, IngestionJobIds.forDocument(document), document.documentId(),
                document.tenantId(), document.documentVersion(), DocumentContract.QUEUED);
        jdbc.update(MARK_QUEUED, DocumentContract.QUEUED, document.documentId(), document.tenantId(),
                DocumentContract.UPLOADED);
        return jdbc.query(SELECT_BY_ID, DOCUMENT_MAPPER, document.documentId(), document.tenantId())
                .stream().findFirst().orElseThrow();
    }

    private static DocumentRecord mapDocument(ResultSet result, int rowNumber) throws SQLException {
        Timestamp createdAt = result.getTimestamp("created_at");
        Timestamp updatedAt = result.getTimestamp("updated_at");
        Integer pageCount = (Integer) result.getObject("page_count");
        return new DocumentRecord(result.getString("document_id"), result.getString("tenant_id"),
                result.getString("course_id"), result.getString("uploader_user_id"),
                result.getString("idempotency_key"), result.getString("file_name"),
                result.getString("checksum_sha256"), result.getString("storage_key"),
                result.getString("status"), result.getInt("document_version"), pageCount,
                result.getString("failure_code"), createdAt.toInstant(), updatedAt.toInstant());
    }
}
