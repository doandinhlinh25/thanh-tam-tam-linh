import { useMemo, useState } from "react";
import { Icon } from "../components/Icon";
import { RoleWorkspace, type PortalNavigationItem } from "../components/RoleWorkspace";
import { Button, EmptyState, PageHeading, StatCard, Toast } from "../components/Primitives";
import { DocumentsPage } from "./DocumentsPage";
import { FeedbackPage } from "./FeedbackPage";
import { initialCourses, initialDocuments, initialFeedback } from "../data/mockData";
import type { Course, DemoUser, FeedbackItem, LearningDocument } from "../types";

type TeacherPage = "home" | "courses" | "documents" | "feedback";

const navigation: PortalNavigationItem[] = [
  { id: "home", label: "Tổng quan", icon: "overview" },
  { id: "courses", label: "Môn được phân công", icon: "course" },
  { id: "documents", label: "Tài liệu môn học", icon: "file" },
  { id: "feedback", label: "Phản hồi học viên", icon: "feedback" },
];

const titles: Record<TeacherPage, string> = { home: "Tổng quan giảng dạy", courses: "Môn được phân công", documents: "Tài liệu môn học", feedback: "Phản hồi học viên" };

function makeDocumentId() {
  return `teacher-doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function currentTime() {
  return new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
}

export function TeacherWorkspace({ user, onLogout }: { user: DemoUser; onLogout: () => void }) {
  const [page, setPage] = useState<TeacherPage>("home");
  const [documents, setDocuments] = useState(initialDocuments);
  const [toast, setToast] = useState<string | null>(null);
  const courses = useMemo(() => initialCourses.filter((course) => user.courseIds.includes(course.id)), [user.courseIds]);
  const assignedIds = new Set(courses.map((course) => course.id));
  const assignedDocuments = documents.filter((document) => assignedIds.has(document.courseId));
  const courseNames = new Set(courses.map((course) => course.name));
  const feedback = initialFeedback.filter((item) => courseNames.has(item.course));
  const addDocument = (draft: { name: string; format: "PDF" | "DOCX"; size: string; courseId: string }) => {
    if (!assignedIds.has(draft.courseId)) return;
    const now = currentTime();
    const added: LearningDocument = { id: makeDocumentId(), ...draft, status: "processing", uploadedAt: now, chunks: 0, pages: 0, extractedText: "Tài liệu demo đã được ghi nhận và đang chờ xử lý." };
    setDocuments((current) => [added, ...current]);
    setToast("Đã mô phỏng thêm tài liệu vào môn được phân công.");
  };

  const deleteDocument = (id: string) => {
    const target = assignedDocuments.find((document) => document.id === id);
    if (!target || !assignedIds.has(target.courseId)) return;
    setDocuments((current) => current.filter((document) => document.id !== id));
    setToast("Đã xóa tài liệu khỏi danh sách demo của môn học.");
  };

  const reprocessDocument = (id: string) => {
    const target = assignedDocuments.find((document) => document.id === id);
    if (!target || !assignedIds.has(target.courseId)) return;
    setDocuments((current) => current.map((document) => document.id === id ? { ...document, status: "processing", error: undefined } : document));
    setToast("Đã mô phỏng yêu cầu xử lý lại tài liệu.");
  };

  const content = page === "home" ? <TeacherHome user={user} courses={courses} documents={assignedDocuments} feedback={feedback} onNavigate={setPage} />
    : page === "courses" ? <TeacherCourses courses={courses} documents={assignedDocuments} onNavigate={setPage} />
      : page === "documents" ? <DocumentsPage documents={assignedDocuments} courses={courses} onAddDocument={addDocument} onDeleteDocument={deleteDocument} onReprocess={reprocessDocument} />
        : <FeedbackPage feedback={feedback} />;

  return <>
    <RoleWorkspace user={user} activePage={page} title={titles[page]} navigation={navigation} onNavigate={(destination) => setPage(destination as TeacherPage)} onLogout={onLogout}>{content}</RoleWorkspace>
    <Toast message={toast} onClose={() => setToast(null)} />
  </>;
}

function TeacherHome({ user, courses, documents, feedback, onNavigate }: { user: DemoUser; courses: Course[]; documents: LearningDocument[]; feedback: FeedbackItem[]; onNavigate: (page: TeacherPage) => void }) {
  const firstName = user.name.trim().split(/\s+/).slice(-1)[0] ?? user.name;
  const completed = documents.filter((document) => document.status === "completed").length;
  const needsReview = documents.filter((document) => document.status === "failed" || document.status === "processing").length;
  const negativeFeedback = feedback.filter((item) => item.rating === "negative").length;
  return <div className="page-stack teacher-page-stack">
    <section className="teacher-welcome-panel"><div className="teacher-welcome-icon"><Icon name="users" size={25} /></div><div><span className="student-welcome-kicker">KHÔNG GIAN GIẢNG DẠY DEMO</span><h1>Chào {firstName},<br /><span>cùng chuẩn bị học liệu nhé.</span></h1><p>Quản lý tài liệu và theo dõi phản hồi của các môn được phân công cho persona giáo viên.</p></div><Button variant="primary" icon="upload" onClick={() => onNavigate("documents")}>Quản lý tài liệu</Button></section>
    <div className="stats-grid student-stats-grid"><StatCard label="Môn được phân công" value={String(courses.length)} hint="trong phiên demo" icon="course" tone="violet" /><StatCard label="Tài liệu sẵn sàng" value={String(completed)} hint="có thể tham khảo" icon="file" tone="green" /><StatCard label="Cần xem lại" value={String(needsReview)} hint="đang xử lý hoặc lỗi" icon="clock" tone="amber" /><StatCard label="Feedback cần đọc" value={String(negativeFeedback)} hint="đánh giá chưa tốt" icon="feedback" tone="blue" /></div>
    <section className="student-section"><div className="student-section-heading"><div><span className="eyebrow">PHẠM VI PHỤ TRÁCH</span><h2>Môn học được phân công</h2><p>Quyền thao tác demo chỉ mở với các môn dưới đây.</p></div><button className="text-button" type="button" onClick={() => onNavigate("courses")}>Xem danh sách <Icon name="arrow" size={15} /></button></div>
      {courses.length ? <div className="teacher-course-overview-grid">{courses.map((course, index) => { const courseDocs = documents.filter((document) => document.courseId === course.id); const courseFeedback = feedback.filter((item) => item.course === course.name); return <article className="teacher-course-overview-card" key={course.id}><div className={`teacher-course-mark teacher-course-mark-${index % 4}`}>{course.code.slice(0, 2)}</div><div className="teacher-course-overview-main"><span className="student-course-code">{course.code}</span><h3>{course.name}</h3><p>{course.description}</p><div className="teacher-course-stats"><span><Icon name="file" size={14} />{courseDocs.length} tài liệu</span><span><Icon name="feedback" size={14} />{courseFeedback.length} phản hồi</span></div></div><button className="icon-button" type="button" aria-label={`Xem tài liệu ${course.name}`} onClick={() => onNavigate("documents")}><Icon name="arrow" size={17} /></button></article>; })}</div> : <EmptyState title="Chưa được phân công môn học" description="Các môn được gán sẽ xuất hiện trong không gian giáo viên." />}
    </section>
    <section className="teacher-home-bottom"><div className="panel teacher-activity-panel"><div className="panel-heading"><div><h2>Trạng thái học liệu</h2><p>Theo dõi tài liệu trong các môn phụ trách.</p></div><button type="button" className="text-button" onClick={() => onNavigate("documents")}>Mở danh sách <Icon name="arrow" size={14} /></button></div><div className="teacher-status-list"><div><span className="teacher-status-icon teacher-status-ready"><Icon name="check" size={15} /></span><span><strong>Đã sẵn sàng</strong><small>Có thể dùng trong trợ lý môn học</small></span><b>{completed}</b></div><div><span className="teacher-status-icon teacher-status-pending"><Icon name="clock" size={15} /></span><span><strong>Đang chờ xử lý</strong><small>Đang xử lý hoặc chờ trong demo</small></span><b>{documents.filter((document) => document.status === "pending" || document.status === "processing").length}</b></div><div><span className="teacher-status-icon teacher-status-failed"><Icon name="feedback" size={15} /></span><span><strong>Cần kiểm tra</strong><small>Không thể trích xuất trong dữ liệu mẫu</small></span><b>{documents.filter((document) => document.status === "failed").length}</b></div></div></div><aside className="teacher-feedback-callout"><span className="student-tip-icon"><Icon name="feedback" size={18} /></span><span className="eyebrow">TIẾNG NÓI HỌC VIÊN</span><h3>{feedback.length} phản hồi mẫu</h3><p>{negativeFeedback ? `${negativeFeedback} phản hồi được đánh dấu cần xem lại trong các môn bạn phụ trách.` : "Xem phản hồi của học viên trong phạm vi môn được phân công."}</p><Button variant="secondary" icon="arrow" onClick={() => onNavigate("feedback")}>Xem phản hồi</Button></aside></section>
    <div className="demo-banner"><span className="demo-pulse" />Vai trò giáo viên ánh xạ tới giảng viên phụ trách môn; phạm vi này chỉ minh họa trên giao diện.</div>
  </div>;
}

function TeacherCourses({ courses, documents, onNavigate }: { courses: Course[]; documents: LearningDocument[]; onNavigate: (page: TeacherPage) => void }) {
  return <div className="page-stack teacher-page-stack"><PageHeading eyebrow="PHẠM VI PHỤ TRÁCH" title="Môn được phân công" description="Danh sách môn học thuộc persona giáo viên hiện tại." action={<span className="date-pill"><Icon name="course" size={15} />{courses.length} môn demo</span>} /><div className="demo-banner"><span className="demo-pulse" />Giáo viên chỉ xem và thao tác với các môn đã được gán trong dữ liệu mẫu.</div>{courses.length ? <div className="teacher-course-list">{courses.map((course, index) => { const courseDocuments = documents.filter((document) => document.courseId === course.id); const ready = courseDocuments.filter((document) => document.status === "completed").length; return <article className="teacher-course-row" key={course.id}><div className={`teacher-course-mark teacher-course-mark-${index % 4}`}>{course.code.slice(0, 2)}</div><div className="teacher-course-row-main"><span className="student-course-code">{course.code}</span><h2>{course.name}</h2><p>{course.description}</p></div><div className="teacher-course-row-stats"><span><strong>{courseDocuments.length}</strong> tài liệu</span><span><strong>{ready}</strong> sẵn sàng</span></div><Button variant="secondary" icon="file" onClick={() => onNavigate("documents")}>Xem tài liệu</Button></article>; })}</div> : <EmptyState title="Chưa có môn học được phân công" description="Thông tin phân công sẽ xuất hiện khi có dữ liệu." />}</div>;
}
