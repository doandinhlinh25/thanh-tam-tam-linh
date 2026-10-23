import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon, type IconName } from "./components/Icon";
import { SearchInput, Toast } from "./components/Primitives";
import { AuthPage } from "./components/AuthPage";
import { demoRoleLabels } from "./data/demoData";
import { initialCourses, initialDocuments, initialEvaluation, initialFeedback, initialQuestions, initialSettings } from "./data/mockData";
import { CoursesPage } from "./pages/CoursesPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { FeedbackPage } from "./pages/FeedbackPage";
import { OverviewPage } from "./pages/OverviewPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StudentWorkspace } from "./pages/StudentWorkspace";
import { TeacherWorkspace } from "./pages/TeacherWorkspace";
import type { Course, DemoUser, LearningDocument, PageId } from "./types";

const navigation: { id: PageId; label: string; icon: IconName; group: "workspace" | "admin" }[] = [
  { id: "overview", label: "Tổng quan", icon: "overview", group: "workspace" },
  { id: "documents", label: "Tài liệu", icon: "file", group: "workspace" },
  { id: "evaluation", label: "Đánh giá AI", icon: "sparkles", group: "workspace" },
  { id: "feedback", label: "Feedback", icon: "feedback", group: "workspace" },
  { id: "courses", label: "Môn học", icon: "course", group: "admin" },
  { id: "settings", label: "Cài đặt", icon: "settings", group: "admin" },
];

const titles: Record<PageId, string> = {
  overview: "Tổng quan", documents: "Quản lý tài liệu", evaluation: "Đánh giá AI", feedback: "Feedback", courses: "Quản lý môn học", settings: "Cài đặt",
};

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function AdminWorkspace({ user, onLogout }: { user: DemoUser; onLogout: () => void }) {
  const [page, setPage] = useState<PageId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const [courses, setCourses] = useState(initialCourses);
  const [documents, setDocuments] = useState(initialDocuments);
  const [questions, setQuestions] = useState(initialQuestions);
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [settings, setSettings] = useState(initialSettings);
  const [toast, setToast] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerWasOpen = useRef(false);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (sidebarOpen) {
      drawerWasOpen.current = true;
      sidebarRef.current?.querySelector<HTMLButtonElement>(".nav-item")?.focus();
    } else if (drawerWasOpen.current) {
      drawerWasOpen.current = false;
      menuButtonRef.current?.focus();
    }
  }, [sidebarOpen]);

  const navigate = (destination: PageId) => { setPage(destination); setSidebarOpen(false); };

  const pageContent = useMemo(() => {
    switch (page) {
      case "overview": return <OverviewPage documents={documents} courses={courses} feedback={initialFeedback} evaluation={evaluation} onNavigate={navigate} />;
      case "documents": return <DocumentsPage documents={documents} courses={courses} initialSearch={quickSearch} onAddDocument={(draft) => {
        const now = new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
        const added: LearningDocument = { id: makeId("doc"), ...draft, status: "processing", uploadedAt: now, chunks: 0, pages: 0, extractedText: "Tài liệu demo đã được ghi nhận và đang chờ xử lý." };
        setDocuments((current) => [added, ...current]);
        setCourses((current) => current.map((course) => course.id === draft.courseId ? { ...course, documentCount: course.documentCount + 1, updatedAt: now.split(" ")[0] } : course));
        setToast("Tài liệu được thêm vào danh sách demo.");
      }} onDeleteDocument={(id) => {
        const removed = documents.find((document) => document.id === id);
        setDocuments((current) => current.filter((document) => document.id !== id));
        if (removed) setCourses((current) => current.map((course) => course.id === removed.courseId ? { ...course, documentCount: Math.max(0, course.documentCount - 1) } : course));
        setToast("Đã xóa tài liệu khỏi dữ liệu demo.");
      }} onReprocess={(id) => {
        setDocuments((current) => current.map((document) => document.id === id ? { ...document, status: "processing", error: undefined } : document));
        setToast("Đã mô phỏng yêu cầu xử lý lại.");
      }} />;
      case "evaluation": return <EvaluationPage questions={questions} evaluation={evaluation} onAddQuestion={(question) => {
        setQuestions((current) => [...current, { ...question, id: makeId("q"), score: 0 }]);
        setToast("Đã thêm câu hỏi vào bộ dữ liệu demo.");
      }} onCreateSet={(name) => {
        setEvaluation((current) => ({ ...current, setName: name }));
        setToast("Đã cập nhật tên bộ đánh giá mẫu.");
      }} onRun={() => {
        setEvaluation((current) => {
          const nextQuality = Math.min(99, Math.max(70, current.answerQuality + (Math.random() > 0.5 ? 1 : -1)));
          const history = [...current.history.slice(-5), nextQuality];
          return { ...current, answerQuality: nextQuality, history, lastRun: new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "") };
        });
        setToast("Đánh giá demo đã hoàn tất.");
      }} />;
      case "feedback": return <FeedbackPage feedback={initialFeedback} />;
      case "courses": return <CoursesPage courses={courses} documents={documents} onSave={(draft, id) => {
        if (id) {
          setCourses((current) => current.map((course) => course.id === id ? { ...course, ...draft, updatedAt: new Date().toLocaleDateString("vi-VN") } : course));
          setToast("Đã cập nhật môn học demo.");
        } else {
          const added: Course = { id: makeId("course"), ...draft, documentCount: 0, studentCount: 0, updatedAt: new Date().toLocaleDateString("vi-VN") };
          setCourses((current) => [...current, added]);
          setToast("Đã thêm môn học demo.");
        }
      }} onDelete={(id) => {
        const relatedIds = new Set(documents.filter((document) => document.courseId === id).map((document) => document.id));
        setDocuments((current) => current.filter((document) => !relatedIds.has(document.id)));
        setCourses((current) => current.filter((course) => course.id !== id));
        setToast("Đã xóa môn học và tài liệu mẫu liên quan.");
      }} />;
      case "settings": return <SettingsPage settings={settings} onSave={(next) => { setSettings(next); setToast("Đã lưu cài đặt demo."); }} onReset={() => { setSettings({ ...initialSettings }); setToast("Đã khôi phục cài đặt demo mặc định."); }} />;
    }
  }, [page, documents, courses, questions, evaluation, settings, quickSearch]);

  const navItems = (group: "workspace" | "admin") => navigation.filter((item) => item.group === group).map((item) => <button type="button" key={item.id} className={`nav-item ${page === item.id ? "nav-item-active" : ""}`} aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{item.id === "documents" && documents.some((document) => document.status === "failed") && <span className="nav-alert-dot" aria-label="Có tài liệu cần kiểm tra" />}</button>);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Đến nội dung chính</a>
      {sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label="Đóng điều hướng" onClick={() => setSidebarOpen(false)} />}
      <aside ref={sidebarRef} className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`} role={sidebarOpen ? "dialog" : undefined} aria-modal={sidebarOpen || undefined} aria-label="Điều hướng chính" onKeyDown={(event) => {
        if (event.key === "Escape" && sidebarOpen) { setSidebarOpen(false); return; }
        if (event.key !== "Tab" || !sidebarOpen || !sidebarRef.current) return;
        const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
        <div className="brand"><span className="brand-mark"><Icon name="sparkles" size={20} /></span><span><strong>Minh Tâm</strong><small>AI Learning Assistant</small></span><span className="brand-demo">DEMO</span></div>
        <div className="workspace-picker"><span className="workspace-avatar">TT</span><span><strong>Trường Thành Tâm</strong><small>Không gian quản trị</small></span><Icon name="chevron" size={15} className="workspace-chevron" /></div>
        <nav className="side-nav"><p className="nav-section-label">KHÔNG GIAN LÀM VIỆC</p>{navItems("workspace")}<p className="nav-section-label nav-section-admin">QUẢN TRỊ</p>{navItems("admin")}</nav>
        <div className="sidebar-bottom"><div className="sidebar-help"><span className="help-symbol">?</span><div><strong>Không gian quản trị</strong><small>Quản trị viên tổ chức</small></div><Icon name="arrow" size={15} /></div><div className="account-row"><span className="account-avatar">{user.name.split(" ").slice(-2).map((part) => part[0]).join("")}</span><div><strong>{user.name}</strong><small>{demoRoleLabels[user.role]}</small></div><button className="icon-button account-menu" type="button" aria-label="Đăng xuất phiên demo" title="Đăng xuất phiên demo" onClick={onLogout}><Icon name="logout" size={16} /></button></div></div>
      </aside>

      <div className="app-main" inert={sidebarOpen}>
        <header className="topbar"><div className="topbar-left"><button ref={menuButtonRef} className="mobile-menu icon-button" type="button" aria-label="Mở điều hướng" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button><div className="breadcrumbs"><span>Không gian quản trị</span><Icon name="chevron" size={14} /><strong>{titles[page]}</strong></div></div><div className="topbar-actions"><SearchInput className="topbar-search" aria-label="Tìm nhanh tài liệu" placeholder="Tìm nhanh tài liệu..." value={quickSearch} onChange={(event) => { setQuickSearch(event.target.value); setPage("documents"); }} /><span className="topbar-status"><i /> Hệ thống demo</span><button type="button" className="topbar-avatar" aria-label={`Tài khoản ${user.name}`}>{user.name.split(" ").slice(-2).map((part) => part[0]).join("")}</button></div></header>
        <main className="main-content" id="main-content">{pageContent}</main>
        <footer className="app-footer"><span>Minh Tâm AI Learning Assistant</span><span>Giao diện minh họa · 2026</span></footer>
      </div>
      <Toast message={toast} onClose={dismissToast} />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<DemoUser | null>(null);
  if (!session) return <AuthPage onLogin={setSession} onSignup={setSession} />;
  const logout = () => setSession(null);
  if (session.role === "student") return <StudentWorkspace user={session} onLogout={logout} />;
  if (session.role === "teacher") return <TeacherWorkspace user={session} onLogout={logout} />;
  return <AdminWorkspace user={session} onLogout={logout} />;
}
