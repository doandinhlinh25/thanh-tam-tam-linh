package com.linh.document.services.support;

import com.linh.document.constants.DocumentContract;
import com.linh.document.model.DocumentRecord;

/** Stable job identifiers shared by the queue and database. */
public final class IngestionJobIds {
    private static final String SEPARATOR = "-";

    private IngestionJobIds() {
    }

    /**
     * Creates the deterministic ID for a document version.
     *
     * @param document source document
     * @return ingestion job ID
     */
    public static String forDocument(DocumentRecord document) {
        return String.join(SEPARATOR, DocumentContract.JOB_PREFIX, document.documentId(),
                DocumentContract.VERSION_PREFIX, Integer.toString(document.documentVersion()));
    }
}
