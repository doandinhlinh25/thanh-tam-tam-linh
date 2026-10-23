import { useMemo, useState, type FormEvent } from "react";
import type { Course, LearningDocument } from "../types";
import { Icon } from "../components/Icon";
import { Button, Modal, PageHeading, SearchInput } from "../components/Primitives";

type CourseDraft = Pick<Course, "code" | "name" | "description">;

export function CoursesPage({
  courses,
  documents,
  onSave,
  onDelete,
}: {
  courses: Course[];
  documents: LearningDocument[];
  onSave: (draft: CourseDraft, id?: string) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState<Course | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    return courses.filter((course) => `${course.code} ${course.name} ${course.description}`.toLocaleLowerCase("vi").includes(query));
  }, [courses, search]);

  const openCreate = () => { setEditing(null); setError(""); setModalOpen(true); };
  const openEdit = (course: Course) => { setEditing(course); setError(""); setModalOpen(true); };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const draft = {
      code: String(form.get("code") ?? "").trim().toLocaleUpperCase("vi"),
      name: String(form.get("name") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
    };
    if (!draft.code || !draft.name) return;
    if (courses.some((course) => course.code.toLocaleLowerCase("vi") === draft.code.toLocaleLowerCase("vi") && course.id !== editing?.id)) {
      setError("Mã môn học đã tồn tại trong dữ liệu demo.");
      return;
    }
    onSave(draft, editing?.id);
    setModalOpen(false);
  };

  return (
    <div className="page-stack">
      <PageHeading eyebrow="KHÔNG GIAN HỌC TẬP" title="Quản lý môn học" description="Tổ chức kho tài liệu và dữ liệu trợ lý theo từng môn học." action={<Button variant="primary" icon="plus" onClick={openCreate}>Thêm môn học</Button>} />
      <div className="demo-banner"><span className="demo-pulse" />Dữ liệu môn học minh họa <span className="demo-banner-separator">·</span> Thay đổi chỉ được giữ trong phiên này</div>

      <div className="course-toolbar">
        <div className="course-count"><strong>{courses.length}</strong><span>môn học đang quản lý</span></div>
        <SearchInput aria-label="Tìm môn học" placeholder="Tìm theo mã hoặc tên môn học..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {filtered.length === 0 ? <div className="panel course-empty"><span className="empty-icon"><Icon name="course" size={22} /></span><strong>{courses.length ? "Không tìm thấy môn học" : "Chưa có môn học"}</strong><p>{courses.length ? "Thử một từ khóa khác." : "Thêm môn học đầu tiên để bắt đầu tổ chức tài liệu."}</p>{courses.length === 0 && <Button variant="primary" icon="plus" onClick={openCreate}>Thêm môn học</Button>}</div> :
        <div className="course-grid">{filtered.map((course, index) => {
          const documentCount = documents.filter((document) => document.courseId === course.id).length;
          const colors = ["course-art-violet", "course-art-blue", "course-art-teal", "course-art-amber", "course-art-rose"];
          return <article className="course-card" key={course.id}>
            <div className={`course-card-art ${colors[index % colors.length]}`}><span className="course-code-mark">{course.code.slice(0, 2)}</span><Icon name="course" size={30} /><button className="icon-button course-edit" type="button" aria-label={`Sửa ${course.name}`} title="Sửa môn học" onClick={() => openEdit(course)}><Icon name="settings" size={16} /></button></div>
            <div className="course-card-body"><div className="course-title-line"><span className="course-code">{course.code}</span><span className="course-updated">Cập nhật {course.updatedAt}</span></div><h2>{course.name}</h2><p>{course.description}</p>
              <div className="course-card-stats"><span><Icon name="file" size={15} /><strong>{Math.max(course.documentCount, documentCount)}</strong> tài liệu</span><span><Icon name="users" size={15} /><strong>{course.studentCount}</strong> học viên</span></div>
              <div className="course-card-footer"><span><span className="course-live-dot" />Đang hoạt động</span><button className="text-button course-delete" type="button" onClick={() => setDeleting(course)}>Xóa môn học</button></div>
            </div>
          </article>;
        })}</div>}

      <Modal open={modalOpen} title={editing ? "Sửa môn học" : "Thêm môn học"} description="Thông tin chỉ được cập nhật trong dữ liệu demo." onClose={() => setModalOpen(false)}>
        <form key={editing?.id ?? "new-course"} className="form-stack" onSubmit={submit}>
          <label className="field-label" htmlFor="course-code">Mã môn học <span className="required-mark">*</span></label>
          <input className="form-control" id="course-code" name="code" placeholder="Ví dụ: CS101" defaultValue={editing?.code ?? ""} required maxLength={16} />
          <label className="field-label" htmlFor="course-name">Tên môn học <span className="required-mark">*</span></label>
          <input className="form-control" id="course-name" name="name" placeholder="Nhập tên môn học" defaultValue={editing?.name ?? ""} required maxLength={100} />
          <label className="field-label" htmlFor="course-description">Mô tả</label>
          <textarea className="form-control textarea-control" id="course-description" name="description" placeholder="Mô tả ngắn về nội dung môn học" defaultValue={editing?.description ?? ""} maxLength={240} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="modal-footer"><Button type="button" onClick={() => setModalOpen(false)}>Hủy</Button><Button variant="primary" icon="check" type="submit">{editing ? "Lưu thay đổi" : "Tạo môn học"}</Button></div>
        </form>
      </Modal>

      <Modal open={Boolean(deleting)} title="Xóa môn học mẫu?" description="Thao tác này chỉ thay đổi dữ liệu demo trên giao diện." onClose={() => setDeleting(null)}>
        <p className="confirm-copy">Bạn có chắc muốn xóa <strong>{deleting?.name}</strong>? Tài liệu mẫu thuộc môn học cũng sẽ bị xóa khỏi danh sách demo.</p>
        <div className="modal-footer"><Button onClick={() => setDeleting(null)}>Giữ lại</Button><Button variant="danger" icon="trash" onClick={() => { if (deleting) onDelete(deleting.id); setDeleting(null); }}>Xóa môn học</Button></div>
      </Modal>
    </div>
  );
}
