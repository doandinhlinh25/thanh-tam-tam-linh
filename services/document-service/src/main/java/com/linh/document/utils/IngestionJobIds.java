package com.linh.document.utils;

import com.linh.document.constants.DocumentContract;
import com.linh.document.entity.Documents;

/** Mã tác vụ cố định dùng chung cho hàng đợi và cơ sở dữ liệu. */
public final class IngestionJobIds {
    private static final String SEPARATOR = "-";

    private IngestionJobIds() {
    }

    /**
     * Tạo mã xác định cho một phiên bản tài liệu.
     *
     * @param document tài liệu
     * @return mã tác vụ xử lý dữ liệu
     */
    public static String forDocument(Documents document) {
        return String.join(SEPARATOR, DocumentContract.JOB_PREFIX, document.documentId(),
                DocumentContract.VERSION_PREFIX, Integer.toString(document.documentVersion()));
    }
}
