CREATE TABLE IF NOT EXISTS documents (
    document_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    uploader_user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    checksum_sha256 CHAR(64) NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    access_scope TEXT NOT NULL,
    status TEXT NOT NULL,
    document_version INTEGER NOT NULL CHECK (document_version > 0),
    page_count INTEGER,
    failure_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, course_id, uploader_user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS documents_tenant_course_idx ON documents (tenant_id, course_id);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents (document_id),
    tenant_id TEXT NOT NULL,
    document_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (document_id, document_version)
);
