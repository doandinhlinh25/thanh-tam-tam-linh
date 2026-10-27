package com.linh.document.services.storage;

/** Lưu tệp PDF trong kho đối tượng riêng tư. */
public interface IDocumentObjectStore {
    /**
     * Tải dữ liệu PDF đã kiểm tra lên kho lưu trữ.
     *
     * @param key khóa lưu trữ đối tượng riêng tư
     * @param content dữ liệu tệp PDF
     */
    void put(String key, byte[] content);

    /**
     * Xóa đối tượng còn lại do các yêu cầu cùng khóa chống trùng cạnh tranh.
     *
     * @param key khóa lưu trữ đối tượng riêng tư
     */
    void remove(String key);
}
