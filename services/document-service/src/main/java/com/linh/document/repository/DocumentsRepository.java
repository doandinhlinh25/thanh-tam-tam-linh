package com.linh.document.repository;

import com.linh.document.constants.DocumentContract;
import com.linh.document.entity.Documents;
import com.linh.document.utils.IngestionJobIds;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

/** Truy vấn và ghi tài liệu cùng tác vụ xử lý dữ liệu bằng Spring Data JPA. */
public interface DocumentsRepository extends JpaRepository<Documents, String> {
    String INSERT_DOCUMENT = """
            INSERT INTO documents (document_id, tenant_id, course_id, uploader_user_id,
              idempotency_key, file_name, byte_size, checksum_sha256, storage_key,
              status, document_version, access_scope)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            ON CONFLICT (tenant_id, course_id, uploader_user_id, idempotency_key) DO NOTHING
            """;
    String INSERT_JOB = """
            INSERT INTO ingestion_jobs (job_id, document_id, tenant_id, document_version, status)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ON CONFLICT (job_id) DO NOTHING
            """;
    String MARK_QUEUED = """
            UPDATE documents SET status = ?1, updated_at = CURRENT_TIMESTAMP
            WHERE document_id = ?2 AND tenant_id = ?3 AND status = ?4
            """;

    /**
     * Tìm tài liệu theo khóa tải lên trong phạm vi đã xác minh.
     *
     * @param tenantId mã tenant sở hữu
     * @param courseId mã khóa học
     * @param uploaderUserId mã người tải lên
     * @param idempotencyKey khóa chống trùng của lượt tải lên
     * @return tài liệu phù hợp nếu tồn tại
     */
    Optional<Documents> findByTenantIdAndCourseIdAndUploaderUserIdAndIdempotencyKey(
            String tenantId, String courseId, String uploaderUserId, String idempotencyKey);

    /**
     * Nạp tài liệu hiện tại thuộc tenant đã xác minh.
     *
     * @param documentId mã tài liệu
     * @param tenantId mã tenant sở hữu
     * @return tài liệu phù hợp nếu tồn tại
     */
    Optional<Documents> findByDocumentIdAndTenantId(String documentId, String tenantId);

    /**
     * Ghi tài liệu nếu chưa có khóa tải lên tương ứng.
     *
     * @param document tài liệu đã kiểm tra dữ liệu
     * @return tài liệu vừa tạo hoặc null nếu khóa đã tồn tại
     */
    @Transactional
    default Documents createIfAbsent(Documents document) {
        int inserted = insertDocumentIfAbsent(document.documentId(), document.tenantId(), document.courseId(),
                document.uploaderUserId(), document.idempotencyKey(), document.fileName(), document.byteSize(),
                document.checksumSha256(), document.storageKey(), document.status(), document.documentVersion(),
                document.accessScope());
        if (inserted == 0) {
            return null;
        }
        return findById(document.documentId()).orElseThrow();
    }

    /**
     * Ghi nhận tác vụ và chuyển tài liệu sang trạng thái chờ xử lý trong một transaction.
     *
     * @param document tài liệu đã gửi vào hàng đợi
     * @return trạng thái hiện tại của tài liệu
     */
    @Transactional
    default Documents markQueued(Documents document) {
        insertIngestionJobIfAbsent(IngestionJobIds.forDocument(document), document.documentId(),
                document.tenantId(), document.documentVersion(), DocumentContract.QUEUED);
        markQueuedIfUploaded(DocumentContract.QUEUED, document.documentId(), document.tenantId(),
                DocumentContract.UPLOADED);
        return findByDocumentIdAndTenantId(document.documentId(), document.tenantId()).orElseThrow();
    }

    /**
     * Thêm bản ghi tài liệu nguyên tử để xử lý các lượt tải lên đồng thời.
     *
     * @param documentId mã tài liệu
     * @param tenantId mã tenant sở hữu
     * @param courseId mã khóa học
     * @param uploaderUserId mã người tải lên
     * @param idempotencyKey khóa chống trùng
     * @param fileName tên tệp
     * @param byteSize dung lượng tệp
     * @param checksumSha256 mã kiểm tra nội dung
     * @param storageKey khóa lưu trữ đối tượng
     * @param status trạng thái ban đầu
     * @param documentVersion phiên bản tài liệu
     * @param accessScope phạm vi truy cập
     * @return số bản ghi được thêm
     */
    @Modifying
    @Query(value = INSERT_DOCUMENT, nativeQuery = true)
    int insertDocumentIfAbsent(String documentId, String tenantId, String courseId, String uploaderUserId,
            String idempotencyKey, String fileName, long byteSize, String checksumSha256, String storageKey,
            String status, int documentVersion, String accessScope);

    /**
     * Thêm tác vụ xử lý dữ liệu nếu tác vụ cùng mã chưa tồn tại.
     *
     * @param jobId mã tác vụ
     * @param documentId mã tài liệu
     * @param tenantId mã tenant sở hữu
     * @param documentVersion phiên bản tài liệu
     * @param status trạng thái tác vụ
     * @return số bản ghi được thêm
     */
    @Modifying
    @Query(value = INSERT_JOB, nativeQuery = true)
    int insertIngestionJobIfAbsent(String jobId, String documentId, String tenantId, int documentVersion,
            String status);

    /**
     * Chuyển trạng thái tài liệu đã tải lên và làm mới thực thể trong JPA.
     *
     * @param queuedStatus trạng thái chờ xử lý
     * @param documentId mã tài liệu
     * @param tenantId mã tenant sở hữu
     * @param uploadedStatus trạng thái đã tải lên
     * @return số bản ghi được cập nhật
     */
    @Modifying(clearAutomatically = true)
    @Query(value = MARK_QUEUED, nativeQuery = true)
    int markQueuedIfUploaded(String queuedStatus, String documentId, String tenantId, String uploadedStatus);
}
