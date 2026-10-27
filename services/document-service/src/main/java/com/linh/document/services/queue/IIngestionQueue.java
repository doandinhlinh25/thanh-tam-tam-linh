package com.linh.document.services.queue;

import com.linh.document.entity.Documents;

/** Gửi yêu cầu xử lý dữ liệu cho một phiên bản tài liệu. */
public interface IIngestionQueue {
    /**
     * Gửi hoặc dùng lại một tác vụ cho mỗi phiên bản tài liệu.
     *
     * @param document tài liệu
     */
    void enqueue(Documents document);
}
