package com.linh.document.constants;

/** Stable upload, storage, and event names owned by Document Service. */
public final class DocumentContract {
    public static final String UPLOAD_PATH = "/api/v1/courses/{courseId}/documents";
    public static final String UPLOAD_PREFIX = "/api/v1/courses/";
    public static final String UPLOAD_SUFFIX = "/documents";
    public static final String FILE_FIELD = "file";
    public static final String IDEMPOTENCY_HEADER = "Idempotency-Key";
    public static final String UPLOADER_ATTRIBUTE = "authorizedUploader";
    public static final String PDF_MIME = "application/pdf";
    public static final String PDF_MAGIC = "%PDF-";
    public static final String PDF_EXTENSION = ".pdf";
    public static final String UPLOADED = "UPLOADED";
    public static final String QUEUED = "QUEUED";
    public static final String COURSE_SCOPE = "COURSE";
    public static final String INGEST_EVENT = "document.ingest.requested";
    public static final String INGEST_STREAM = "document-ingestion";
    public static final String JOB_PREFIX = "ingest";
    public static final String VERSION_PREFIX = "v";
    public static final int EVENT_VERSION = 1;
    public static final int INITIAL_DOCUMENT_VERSION = 1;
    public static final int MAX_KEY_LENGTH = 128;
    public static final int MAX_FILE_NAME_LENGTH = 512;

    private DocumentContract() {
    }
}
