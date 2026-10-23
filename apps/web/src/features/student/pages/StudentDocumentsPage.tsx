import { useEffect, useRef, useState } from "react";
import type { Course, DemoUser, PersonalStudentDocument } from "../../../shared/domain/types";
import { Icon } from "../../../shared/ui/Icon";
import { Button, EmptyState, PageHeading } from "../../../shared/ui/Primitives";

type UploadDraft = Pick<PersonalStudentDocument, "name" | "courseId" | "format" | "size">;

function readableFileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function StudentDocumentsPage({ user, courses, documents, onAddDocument, onRemoveDocument }: {
  user: DemoUser;
  courses: Course[];
  documents: PersonalStudentDocument[];
  onAddDocument: (draft: UploadDraft) => void;
  onRemoveDocument: (id: string) => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); }, []);

  const selectFile = (file?: File) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "pdf" && extension !== "docx") {
      setSelectedFile(null);
      setError("Chọn tệp có định dạng PDF hoặc DOCX.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
    setError("");
  };

  const cancelUpload = () => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setUploading(false);
    setProgress(0);
    setError("Đã hủy thao tác mô phỏng; tài liệu chưa được thêm.");
  };

  const startUpload = () => {
    if (uploading) return;
    if (!selectedFile) { setError("Chọn một tệp trước khi tiếp tục."); return; }
    if (!courses.some((course) => course.id === courseId && user.courseIds.includes(course.id))) {
      setError("Chọn một môn học đang được ghi danh trong tài khoản này.");
      return;
    }
    setError("");
    setUploading(true);
    setProgress(0);
    let nextProgress = 0;
    timerRef.current = window.setInterval(() => {
      nextProgress = Math.min(100, nextProgress + 12);
      setProgress(nextProgress);
      if (nextProgress === 100) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        const format = selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
        onAddDocument({ name: selectedFile.name, courseId, format, size: readableFileSize(selectedFile.size) });
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = "";
        setUploading(false);
      }
    }, 90);
  };

  const courseName = (id: string) => courses.find((course) => course.id === id)?.name ?? "Môn học của tôi";

  return <div className="page-stack student-page-stack">
    <PageHeading eyebrow="THƯ VIỆN RIÊNG" title="Tài liệu cá nhân" description="Thêm thông tin tài liệu để quản lý trong phiên học demo của bạn." action={<span className="date-pill"><Icon name="file" size={15} />{documents.length} tài liệu</span>} />
    <div className="demo-banner"><span className="demo-pulse" />Mô phỏng demo · Chỉ lưu tên, định dạng và dung lượng trong phiên này. Nội dung tệp không được tải lên hoặc phân tích.</div>

    <section className="panel student-upload-panel" aria-labelledby="student-upload-heading">
      <div className="panel-heading"><div><h2 id="student-upload-heading">Thêm tài liệu của bạn</h2><p>Chọn môn đang theo học và tệp PDF hoặc DOCX.</p></div></div>
      {courses.length === 0 ? <EmptyState title="Chưa có môn học để chọn" description="Tài khoản demo này chưa được ghi danh môn học nên chưa thể thêm tài liệu." /> : <>
        <label className="field-label" htmlFor="student-upload-course">Môn học <span className="required-mark">*</span></label>
        <select className="form-control student-upload-course" id="student-upload-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={uploading}>
          {courses.filter((course) => user.courseIds.includes(course.id)).map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
        </select>
        <input ref={inputRef} className="visually-hidden" type="file" tabIndex={-1} accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" aria-label="Chọn tệp PDF hoặc DOCX" onChange={(event) => selectFile(event.currentTarget.files?.[0])} />
        <div className={`drop-zone student-drop-zone ${selectedFile ? "drop-zone-selected" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files?.[0]); }}>
          <span className="drop-zone-icon"><Icon name={selectedFile ? "check" : "upload"} size={21} /></span>
          {selectedFile ? <><strong>{selectedFile.name}</strong><span>{readableFileSize(selectedFile.size)} · {selectedFile.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX"}</span><button className="inline-link" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>Đổi tệp</button></> : <><strong>Kéo thả tệp vào đây</strong><span>hoặc <button className="inline-link" type="button" onClick={() => inputRef.current?.click()}>chọn từ thiết bị</button></span><small>PDF hoặc DOCX</small></>}
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
        {uploading && <div className="upload-progress" role="progressbar" aria-label="Tiến trình mô phỏng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${progress}%`}><div className="progress-caption"><span>Đang mô phỏng thao tác; không truyền tệp</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
        <div className="student-upload-actions">{uploading && <Button type="button" onClick={cancelUpload}>Hủy</Button>}<Button type="button" variant="primary" icon="upload" disabled={uploading || !courses.length} onClick={startUpload}>{uploading ? "Đang xử lý demo…" : "Thêm vào tài liệu cá nhân"}</Button></div>
      </>}
    </section>

    <section className="panel" aria-labelledby="personal-document-list-heading">
      <div className="panel-heading"><div><h2 id="personal-document-list-heading">Tài liệu trong phiên này</h2><p>Danh sách này chỉ thuộc workspace sinh viên đang đăng nhập.</p></div></div>
      {documents.length === 0 ? <EmptyState title="Thư viện cá nhân đang trống" description="Chọn tệp ở phía trên để thêm một mục demo." /> : <ul className="personal-document-list">{documents.map((document) => <li className="personal-document-item" key={document.id}>
        <span className={`file-type-icon ${document.format === "PDF" ? "file-pdf" : "file-docx"}`}>{document.format}</span>
        <span className="personal-document-copy"><strong>{document.name}</strong><small>{courseName(document.courseId)} · {document.size} · {document.uploadedAt}</small><small>Chỉ là metadata demo; chưa được tải lên, đọc hoặc đưa vào AI.</small></span>
        <button className="icon-button icon-button-danger" type="button" aria-label={`Xóa ${document.name} khỏi phiên demo`} onClick={() => onRemoveDocument(document.id)}><Icon name="trash" size={16} /></button>
      </li>)}</ul>}
    </section>
  </div>;
}
