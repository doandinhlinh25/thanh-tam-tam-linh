import { useEffect, useMemo, useRef, useState } from "react";
import type { Course, DocumentStatus, LearningDocument } from "../../../shared/domain/types";
import { courseName } from "../../../shared/lib/format";
import { statusLabels } from "../../../shared/domain/documentStatus";
import { Icon } from "../../../shared/ui/Icon";
import { Button, EmptyState, Modal, PageHeading, Pagination, SearchInput, SelectField, StatusBadge } from "../../../shared/ui/Primitives";

interface DocumentDraft {
  name: string;
  format: "PDF" | "DOCX";
  size: string;
  courseId: string;
}

function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function DocumentsPage({
  documents,
  courses,
  initialSearch = "",
  onAddDocument,
  onDeleteDocument,
  onReprocess,
}: {
  documents: LearningDocument[];
  courses: Course[];
  initialSearch?: string;
  onAddDocument: (draft: DocumentDraft) => void;
  onDeleteDocument: (id: string) => void;
  onReprocess: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCourse, setSelectedCourse] = useState(courses[0]?.id ?? "");
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detailDocument, setDetailDocument] = useState<LearningDocument | null>(null);
  const [deleteDocument, setDeleteDocument] = useState<LearningDocument | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);
  useEffect(() => { setSearch(initialSearch); setPage(1); }, [initialSearch]);

  const filteredDocuments = useMemo(() => documents.filter((document) => {
    const matchesSearch = document.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"));
    return matchesSearch && (courseFilter === "all" || document.courseId === courseFilter) && (statusFilter === "all" || document.status === statusFilter);
  }), [documents, search, courseFilter, statusFilter]);
  const pageSize = 5;
  const visibleDocuments = filteredDocuments.slice((page - 1) * pageSize, page * pageSize);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setFileError("Vui lòng chọn tệp PDF hoặc DOCX.");
      setSelectedFile(null);
      return;
    }
    setFileError("");
    setSelectedFile(file);
  };

  const startUpload = () => {
    if (!selectedFile) {
      setFileError("Chọn một tệp trước khi tải lên.");
      return;
    }
    if (!selectedCourse) {
      setFileError("Chọn môn học cho tài liệu.");
      return;
    }
    setUploading(true);
    setProgress(0);
    let current = 0;
    timerRef.current = window.setInterval(() => {
      current = Math.min(100, current + 12);
      setProgress(current);
      if (current >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        const format = selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
        onAddDocument({ name: selectedFile.name, format, size: fileSize(selectedFile.size), courseId: selectedCourse });
        setUploading(false);
        setUploadOpen(false);
        setSelectedFile(null);
        setProgress(0);
      }
    }, 110);
  };

  const closeUpload = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setUploading(false);
    setProgress(0);
    setUploadOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteDocument) return;
    onDeleteDocument(deleteDocument.id);
    setDeleteDocument(null);
  };

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="KHO HỌC LIỆU"
        title="Quản lý tài liệu"
        description="Theo dõi tài liệu môn học và trạng thái xử lý nội dung."
        action={<Button variant="primary" icon="plus" onClick={() => { setUploadOpen(true); setFileError(""); }}>Tải tài liệu</Button>}
      />

      <div className="demo-banner"><span className="demo-pulse" />Chế độ demo <span className="demo-banner-separator">·</span> Không có tệp nào được gửi lên máy chủ</div>

      <section className="upload-summary-grid" aria-label="Tóm tắt tài liệu">
        <div className="upload-summary"><span className="summary-icon summary-violet"><Icon name="file" /></span><div><span>Tổng tài liệu</span><strong>{documents.length}</strong></div></div>
        <div className="upload-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><span>Hoàn tất</span><strong>{documents.filter((item) => item.status === "completed").length}</strong></div></div>
        <div className="upload-summary"><span className="summary-icon summary-amber"><Icon name="clock" /></span><div><span>Đang xử lý</span><strong>{documents.filter((item) => item.status === "processing" || item.status === "pending").length}</strong></div></div>
        <div className="upload-summary"><span className="summary-icon summary-red"><Icon name="refresh" /></span><div><span>Cần kiểm tra</span><strong>{documents.filter((item) => item.status === "failed").length}</strong></div></div>
      </section>

      <section className="panel document-panel">
        <div className="document-toolbar">
          <div><h2>Danh sách tài liệu</h2><p>Tìm kiếm và lọc tài liệu theo môn học hoặc trạng thái.</p></div>
          <div className="filter-row">
            <SearchInput aria-label="Tìm kiếm tài liệu" placeholder="Tìm tên tài liệu..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <SelectField aria-label="Lọc theo môn học" value={courseFilter} onChange={(event) => { setCourseFilter(event.target.value); setPage(1); }}>
              <option value="all">Tất cả môn học</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
            </SelectField>
            <SelectField aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}>
              <option value="all">Tất cả trạng thái</option>{(Object.keys(statusLabels) as DocumentStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </SelectField>
          </div>
        </div>

        {visibleDocuments.length === 0 ? <EmptyState title="Không tìm thấy tài liệu" description="Thử thay đổi từ khóa hoặc bộ lọc để xem kết quả khác." /> : <>
          <div className="table-scroll" role="region" aria-label="Bảng tài liệu, có thể cuộn ngang" tabIndex={0}>
            <table className="data-table documents-table">
              <thead><tr><th>Tài liệu</th><th>Môn học</th><th>Kích thước</th><th>Trạng thái</th><th>Ngày tải lên</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>{visibleDocuments.map((document) => <tr key={document.id}>
                <td><div className="document-name-cell"><span className={`file-type-icon ${document.format === "PDF" ? "file-pdf" : "file-docx"}`}>{document.format === "PDF" ? "PDF" : "DOC"}</span><div><strong title={document.name}>{document.name}</strong><span>{document.id.toUpperCase()} · {document.pages || "—"} trang</span></div></div></td>
                <td><span className="table-course">{courseName(courses, document.courseId)}</span></td>
                <td className="nowrap-cell">{document.size}</td>
                <td><StatusBadge status={document.status} /></td>
                <td className="date-cell">{document.uploadedAt}</td>
                <td><div className="table-actions">
                  <button type="button" className="icon-button" aria-label={`Xem ${document.name}`} title="Xem chi tiết" onClick={() => setDetailDocument(document)}><Icon name="eye" size={16} /></button>
                  {document.status === "failed" && <button type="button" className="icon-button" aria-label={`Xử lý lại ${document.name}`} title="Xử lý lại" onClick={() => onReprocess(document.id)}><Icon name="refresh" size={16} /></button>}
                  <button type="button" className="icon-button icon-button-danger" aria-label={`Xóa ${document.name}`} title="Xóa" onClick={() => setDeleteDocument(document)}><Icon name="trash" size={16} /></button>
                </div></td>
              </tr>)}</tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filteredDocuments.length} onPageChange={setPage} />
        </>}
      </section>

      <Modal open={uploadOpen} title="Tải tài liệu mẫu" description="Mô phỏng tải tài liệu vào môn học đã chọn." onClose={closeUpload}>
        <div className="demo-inline-note"><Icon name="sparkles" size={15} /> Bản demo chỉ đọc tên và dung lượng tệp; nội dung không được tải lên.</div>
        <label className="field-label" htmlFor="document-course">Môn học <span className="required-mark">*</span></label>
        <SelectField id="document-course" className="field-control" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)}>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
        </SelectField>
        <input ref={inputRef} className="visually-hidden" type="file" tabIndex={-1} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => handleFile(event.target.files?.[0])} aria-label="Chọn tệp PDF hoặc DOCX" />
        <div className={`drop-zone ${selectedFile ? "drop-zone-selected" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}>
          <span className="drop-zone-icon"><Icon name={selectedFile ? "check" : "upload"} size={21} /></span>
          {selectedFile ? <><strong>{selectedFile.name}</strong><span>{fileSize(selectedFile.size)} · {selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}</span></> : <><strong>Kéo thả tệp vào đây</strong><span>hoặc <button className="inline-link" type="button" onClick={() => inputRef.current?.click()}>chọn từ thiết bị</button></span><small>PDF hoặc DOCX</small></>}
          {selectedFile && <button className="inline-link" type="button" onClick={() => { setSelectedFile(null); if (inputRef.current) inputRef.current.value = ""; }}>Đổi tệp</button>}
        </div>
        {fileError && <p className="field-error" role="alert">{fileError}</p>}
        {uploading && <div className="upload-progress"><div className="progress-caption"><span>Đang mô phỏng tải lên...</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
        <div className="modal-footer"><Button onClick={closeUpload} disabled={uploading}>Hủy</Button><Button variant="primary" icon="upload" onClick={startUpload} disabled={uploading || courses.length === 0}>{uploading ? "Đang tải..." : "Tải lên demo"}</Button></div>
      </Modal>

      <Modal open={Boolean(detailDocument)} title="Chi tiết tài liệu" description={detailDocument?.id.toUpperCase()} onClose={() => setDetailDocument(null)} size="large">
        {detailDocument && <div className="document-detail">
          <div className="detail-title-row"><span className={`file-type-icon file-type-large ${detailDocument.format === "PDF" ? "file-pdf" : "file-docx"}`}>{detailDocument.format}</span><div><h3>{detailDocument.name}</h3><p>{courseName(courses, detailDocument.courseId)} · {detailDocument.size}</p></div><StatusBadge status={detailDocument.status} /></div>
          <div className="detail-metrics"><div><span>Số trang</span><strong>{detailDocument.pages || "—"}</strong></div><div><span>Chunks</span><strong>{detailDocument.chunks || "—"}</strong></div><div><span>Tải lên</span><strong>{detailDocument.uploadedAt}</strong></div><div><span>Hoàn tất</span><strong>{detailDocument.processedAt ?? "Đang chờ"}</strong></div></div>
          {detailDocument.error && <div className="alert alert-error"><strong>Không xử lý được tài liệu</strong><span>{detailDocument.error}</span></div>}
          <div className="detail-section"><h4>Nội dung trích xuất mẫu</h4>{detailDocument.extractedText ? <p className="extracted-preview">{detailDocument.extractedText}</p> : <p className="muted-copy">Nội dung sẽ hiển thị sau khi tài liệu được xử lý.</p>}</div>
          <div className="detail-section"><h4>Chunks minh họa</h4><div className="chunk-preview"><span className="chunk-index">01</span><p>{detailDocument.extractedText || "Nội dung đang được chuẩn bị trong dữ liệu mẫu."}</p><span className="chunk-page">Trang 1</span></div>{detailDocument.chunks > 1 && <p className="muted-copy">Và {detailDocument.chunks - 1} chunks khác trong dữ liệu mẫu.</p>}</div>
        </div>}
      </Modal>

      <Modal open={Boolean(deleteDocument)} title="Xóa tài liệu mẫu?" description="Thao tác này chỉ xóa bản ghi trong giao diện demo." onClose={() => setDeleteDocument(null)}>
        <p className="confirm-copy">Bạn có chắc muốn xóa <strong>{deleteDocument?.name}</strong> khỏi danh sách mẫu?</p>
        <div className="modal-footer"><Button onClick={() => setDeleteDocument(null)}>Giữ lại</Button><Button variant="danger" icon="trash" onClick={confirmDelete}>Xóa bản ghi</Button></div>
      </Modal>
    </div>
  );
}
