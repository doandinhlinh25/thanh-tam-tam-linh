package com.linh.document.services;

import com.linh.document.model.DocumentRecord;
import com.linh.document.services.ports.UploadPorts.AuthorizedUploader;

/** Coordinates an authorized PDF upload and returns stored document metadata. */
public interface UploadService {
    /**
     * Stores a validated PDF and requests ingestion.
     *
     * @param courseId authorized course
     * @param idempotencyKey client upload key
     * @param fileName original file name
     * @param bytes validated PDF bytes
     * @param uploader verified tenant and user
     * @return stored document metadata
     */
    DocumentRecord upload(String courseId, String idempotencyKey, String fileName,
            byte[] bytes, AuthorizedUploader uploader);
}
