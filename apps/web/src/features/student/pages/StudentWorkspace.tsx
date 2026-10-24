import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../../../shared/ui/Icon";
import { RoleWorkspace, type PortalNavigationItem } from "../../../shared/layout/RoleWorkspace";
import { Button, EmptyState, PageHeading, StatCard, Toast } from "../../../shared/ui/Primitives";
import { createInitialStudentChats, demoChatAnswers, demoPersonalDocumentAnswer } from "../../demo/adapters/demoData";
import { demoRoleLabels } from "../../../shared/domain/roles";
import { initialCourses, initialDocuments } from "../../demo/adapters/mockData";
import type { ChatMessage, ChatResultStatus, Course, DemoUser, LearningDocument, PersonalStudentDocument } from "../../../shared/domain/types";
import { StudentDocumentsPage } from "./StudentDocumentsPage";
import { NotFoundPage } from "../../../shared/ui/NotFoundPage";
import { getRouteId, studentRoutes, type StudentPage } from "../../../app/routes";

const navigation: PortalNavigationItem[] = [
  { id: "home", label: "Tổng quan", icon: "overview" },
  { id: "courses", label: "Môn học của tôi", icon: "course" },
  { id: "documents", label: "Tài liệu cá nhân", icon: "file" },
  { id: "assistant", label: "Trợ lý AI", icon: "sparkles" },
  { id: "history", label: "Lịch sử hỏi đáp", icon: "clock" },
  { id: "account", label: "Tài khoản", icon: "users" },
];

const titles: Record<StudentPage, string> = {
  home: "Tổng quan",
  courses: "Môn học của tôi",
  documents: "Tài liệu cá nhân",
  assistant: "Trợ lý AI",
  history: "Lịch sử hỏi đáp",
  account: "Tài khoản",
};

const suggestedQuestions: Record<string, string> = {
  "course-1": "Lập trình hướng đối tượng là gì?",
  "course-2": "Khi nào nên dùng index?",
  "course-3": "Mạng nơ-ron cập nhật trọng số như thế nào?",
  "course-5": "TCP đảm bảo dữ liệu đúng thứ tự bằng cách nào?",
};

function formatTime() {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

function createId() {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function answerFor(courseId: string, question: string, hasPersonalDocuments: boolean): Pick<ChatMessage, "text" | "status" | "citations"> {
  const normalized = question.trim().toLocaleLowerCase("vi");
  if (normalized.includes("lỗi demo") || normalized.includes("mô phỏng lỗi")) {
    return { status: "error", text: "Không thể hoàn tất câu hỏi trong lần mô phỏng này. Nội dung bạn vừa nhập vẫn được giữ trong lịch sử demo; hãy thử gửi một câu hỏi khác." };
  }
  const personalQuestion = question.trim().toLocaleLowerCase("vi");
  if (hasPersonalDocuments && demoPersonalDocumentAnswer.keywords.some((keyword) => personalQuestion.includes(keyword))) {
    return { status: "answered", text: demoPersonalDocumentAnswer.answer, citations: demoPersonalDocumentAnswer.citations };
  }
  const scenario = demoChatAnswers[courseId];
  if (scenario && scenario.keywords.some((keyword) => normalized.includes(keyword))) {
    return { status: "answered", text: scenario.answer, citations: scenario.citations };
  }
  return { status: "insufficient_evidence", text: "Mình chưa tìm thấy đủ thông tin trong tài liệu mẫu của môn học này để trả lời chính xác. Hãy thử hỏi về nội dung đã có trong học liệu." };
}

function messageStatusLabel(status: ChatResultStatus) {
  if (status === "answered") return "Có nguồn tham khảo";
  if (status === "insufficient_evidence") return "Chưa đủ bằng chứng";
  return "Lỗi mô phỏng";
}

function CourseCard({ course, documents, onOpenAssistant }: { course: Course; documents: LearningDocument[]; onOpenAssistant: (courseId: string) => void }) {
  const courseDocuments = documents.filter((document) => document.courseId === course.id);
  const readyCount = courseDocuments.filter((document) => document.status === "completed").length;
  const palette = ["course-art-violet", "course-art-blue", "course-art-teal", "course-art-amber", "course-art-rose"];
  const tone = palette[Number(course.id.replace("course-", "")) % palette.length];
  return <article className="student-course-card">
    <div className={`student-course-art ${tone}`}><span>{course.code.slice(0, 2)}</span><Icon name="course" size={29} /></div>
    <div className="student-course-content"><span className="student-course-code">{course.code}</span><h3>{course.name}</h3><p>{course.description}</p>
      <div className="student-course-meta"><span><Icon name="file" size={15} />{readyCount} tài liệu sẵn sàng</span><span><i /> Đã ghi danh demo</span></div>
      <Button variant="secondary" icon="sparkles" onClick={() => onOpenAssistant(course.id)}>Hỏi trợ lý môn học</Button>
    </div>
  </article>;
}

export function StudentWorkspace({ user, onLogout }: { user: DemoUser; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = getRouteId(location.pathname, studentRoutes);
  const setPage = (destination: StudentPage) => navigate(studentRoutes[destination]);
  const scopedCourses = useMemo(() => initialCourses.filter((course) => user.courseIds.includes(course.id)), [user.courseIds]);
  const scopedDocuments = useMemo(() => initialDocuments.filter((document) => user.courseIds.includes(document.courseId)), [user.courseIds]);
  const [selectedCourseId, setSelectedCourseId] = useState(() => user.courseIds.includes("course-3") ? "course-3" : (user.courseIds[0] ?? ""));
  const [messagesByCourse, setMessagesByCourse] = useState<Record<string, ChatMessage[]>>(createInitialStudentChats);
  const [personalDocuments, setPersonalDocuments] = useState<PersonalStudentDocument[]>([]);
  const [draft, setDraft] = useState("");
  const [pendingCourseIds, setPendingCourseIds] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<Map<string, number>>(new Map());
  const listEndRef = useRef<HTMLDivElement>(null);
  const currentCourse = scopedCourses.find((course) => course.id === selectedCourseId);
  const messages = messagesByCourse[selectedCourseId] ?? [];
  const conversations = scopedCourses.map((course) => ({ course, messages: messagesByCourse[course.id] ?? [] })).filter((item) => item.messages.some((message) => message.author === "student"));
  const totalMessages = conversations.reduce((sum, item) => sum + item.messages.filter((message) => message.author === "student").length, 0);

  useEffect(() => () => { timerRef.current.forEach((timer) => window.clearTimeout(timer)); timerRef.current.clear(); }, []);
  useEffect(() => { listEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [messages.length, pendingCourseIds]);

  const openAssistant = (courseId?: string) => {
    if (courseId) setSelectedCourseId(courseId);
    setPage("assistant");
  };

  const sendQuestion = (event?: FormEvent<HTMLFormElement>, suggested?: string) => {
    event?.preventDefault();
    const text = (suggested ?? draft).trim();
    if (!text || !selectedCourseId || pendingCourseIds.has(selectedCourseId)) return;
    const courseId = selectedCourseId;
    const userMessage: ChatMessage = { id: createId(), author: "student", text, createdAt: formatTime() };
    setMessagesByCourse((current) => ({ ...current, [courseId]: [...(current[courseId] ?? []), userMessage] }));
    setDraft("");
    setPendingCourseIds((current) => new Set(current).add(courseId));
    const timer = window.setTimeout(() => {
      const response = answerFor(courseId, text, personalDocuments.some((document) => document.ownerId === user.id && document.courseId === courseId));
      const assistantMessage: ChatMessage = { id: createId(), author: "assistant", createdAt: formatTime(), ...response };
      setMessagesByCourse((current) => ({ ...current, [courseId]: [...(current[courseId] ?? []), assistantMessage] }));
      setPendingCourseIds((current) => { const next = new Set(current); next.delete(courseId); return next; });
      timerRef.current.delete(courseId);
    }, 520);
    timerRef.current.set(courseId, timer);
  };

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendQuestion(undefined);
    }
  };

  const rateAnswer = (courseId: string, messageId: string, rating: "positive" | "negative") => {
    setMessagesByCourse((current) => ({
      ...current,
      [courseId]: (current[courseId] ?? []).map((message) => message.id === messageId ? { ...message, rating } : message),
    }));
    setToast("Đã ghi nhận đánh giá trong phiên demo.");
  };

  const addPersonalDocument = (draft: Omit<PersonalStudentDocument, "id" | "ownerId" | "uploadedAt" | "status" | "demoOnly">) => {
    const uploadedAt = new Date().toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(",", "");
    setPersonalDocuments((current) => [{ ...draft, id: createId(), ownerId: user.id, uploadedAt, status: "added", demoOnly: true }, ...current]);
    setToast("Đã thêm thông tin tài liệu vào thư viện demo cá nhân.");
  };

  const pageContent = () => {
    if (!page) return <NotFoundPage />;
    if (page === "home") return <StudentHome user={user} courses={scopedCourses} documents={scopedDocuments} conversations={conversations} totalMessages={totalMessages} onOpenAssistant={openAssistant} onNavigate={setPage} />;
    if (page === "courses") return <StudentCourses courses={scopedCourses} documents={scopedDocuments} onOpenAssistant={openAssistant} />;
    if (page === "documents") return <StudentDocumentsPage user={user} courses={scopedCourses} documents={personalDocuments} onAddDocument={addPersonalDocument} onRemoveDocument={(id) => { setPersonalDocuments((current) => current.filter((document) => document.id !== id)); setToast("Đã xóa thông tin tài liệu khỏi phiên demo."); }} />;
    if (page === "assistant") return <StudentAssistant user={user} courses={scopedCourses} course={currentCourse} documents={scopedDocuments} personalDocuments={personalDocuments.filter((document) => document.ownerId === user.id)} messages={messages} draft={draft} pending={pendingCourseIds.has(selectedCourseId)} onCourseChange={setSelectedCourseId} onDraftChange={setDraft} onSubmit={sendQuestion} onEnter={sendOnEnter} onRate={rateAnswer} listEndRef={listEndRef} />;
    if (page === "history") return <StudentHistory conversations={conversations} onOpen={(courseId) => openAssistant(courseId)} />;
    return <StudentAccount user={user} courses={scopedCourses} onLogout={onLogout} />;
  };

  return <>
    <RoleWorkspace user={user} activePage={page ?? ""} title={page ? titles[page] : "Không tìm thấy trang"} navigation={navigation} onNavigate={(destination) => { if (destination in studentRoutes) setPage(destination as StudentPage); }} onLogout={onLogout}>{pageContent()}</RoleWorkspace>
    <Toast message={toast} onClose={() => setToast(null)} />
  </>;
}

function StudentHome({ user, courses, documents, conversations, totalMessages, onOpenAssistant, onNavigate }: {
  user: DemoUser;
  courses: Course[];
  documents: LearningDocument[];
  conversations: { course: Course; messages: ChatMessage[] }[];
  totalMessages: number;
  onOpenAssistant: (courseId?: string) => void;
  onNavigate: (page: StudentPage) => void;
}) {
  const firstName = user.name.trim().split(/\s+/).slice(-1)[0] ?? user.name;
  const readyDocuments = documents.filter((document) => document.status === "completed").length;
  const recent = [...conversations].sort((left, right) => right.messages.at(-1)?.createdAt.localeCompare(left.messages.at(-1)?.createdAt ?? "") ?? 0).slice(0, 3);
  return <div className="page-stack student-page-stack">
    <section className="student-welcome-panel"><div className="student-welcome-copy"><span className="student-welcome-kicker"><Icon name="sparkles" size={15} /> GÓC HỌC TẬP CỦA BẠN</span><h1>Chào {firstName},<br /><span>hôm nay bạn muốn học gì?</span></h1><p>Hỏi trợ lý AI về nội dung trong tài liệu môn học và xem nguồn tham khảo đi kèm.</p><div className="student-welcome-actions"><Button variant="primary" icon="sparkles" onClick={() => onOpenAssistant()}>Bắt đầu hỏi AI</Button><Button variant="secondary" icon="upload" onClick={() => onNavigate("documents")}>Tài liệu cá nhân</Button></div></div><div className="student-welcome-art" aria-hidden="true"><div className="student-orbit student-orbit-one" /><div className="student-orbit student-orbit-two" /><div className="student-orbit student-orbit-three" /><span className="student-welcome-gem"><Icon name="sparkles" size={42} /></span><span className="student-art-note student-art-note-one"><Icon name="file" size={15} /> Học liệu môn học</span><span className="student-art-note student-art-note-two"><Icon name="check" size={14} /> Có dẫn nguồn</span></div><span className="student-welcome-demo">TRẢI NGHIỆM DEMO</span></section>

    <div className="stats-grid student-stats-grid"><StatCard label="Môn học của tôi" value={String(courses.length)} hint="đã ghi danh mẫu" icon="course" tone="violet" /><StatCard label="Tài liệu sẵn sàng" value={String(readyDocuments)} hint="trong các môn học" icon="file" tone="blue" /><StatCard label="Câu hỏi đã thử" value={String(totalMessages)} hint="trong phiên demo" icon="feedback" tone="green" /></div>

    <section className="student-section"><div className="student-section-heading"><div><span className="eyebrow">KHÔNG GIAN HỌC TẬP</span><h2>Môn học của tôi</h2><p>Chọn môn để xem học liệu hoặc đặt câu hỏi cho trợ lý.</p></div><button className="text-button" type="button" onClick={() => onNavigate("courses")}>Xem tất cả <Icon name="arrow" size={15} /></button></div>
      {courses.length === 0 ? <EmptyState title="Chưa có môn học" description="Môn học được ghi danh sẽ xuất hiện ở đây." /> : <div className="student-course-grid">{courses.slice(0, 3).map((course) => <CourseCard key={course.id} course={course} documents={documents} onOpenAssistant={onOpenAssistant} />)}</div>}
    </section>

    <section className="student-lower-grid"><div className="student-section student-recent-section"><div className="student-section-heading"><div><span className="eyebrow">TIẾP TỤC HỌC</span><h2>Hỏi đáp gần đây</h2></div><button className="text-button" type="button" onClick={() => onNavigate("history")}>Lịch sử <Icon name="arrow" size={15} /></button></div>
        {recent.length === 0 ? <EmptyState title="Chưa có câu hỏi nào" description="Bắt đầu cuộc trò chuyện đầu tiên với trợ lý môn học." /> : <div className="student-recent-list">{recent.map(({ course, messages: courseMessages }) => { const latestQuestion = [...courseMessages].reverse().find((message) => message.author === "student"); const latestAnswer = [...courseMessages].reverse().find((message) => message.author === "assistant"); return <button className="student-recent-item" type="button" key={course.id} onClick={() => onOpenAssistant(course.id)}><span className="student-recent-icon"><Icon name="sparkles" size={17} /></span><span className="student-recent-text"><strong>{latestQuestion?.text ?? "Cuộc trò chuyện môn học"}</strong><small>{course.code} · {course.name}</small></span><span className={`student-recent-status student-status-${latestAnswer?.status ?? "answered"}`}>{latestAnswer ? messageStatusLabel(latestAnswer.status ?? "answered") : "Đang xem"}</span><Icon name="chevron" size={16} /></button>; })}</div>}
      </div><aside className="student-tip-card"><span className="student-tip-icon"><Icon name="file" size={19} /></span><span className="eyebrow">MẸO HỌC TẬP</span><h3>Hỏi đúng trọng tâm</h3><p>Nêu khái niệm hoặc chủ đề trong môn học. Trợ lý demo sẽ chỉ trả lời khi có nguồn mẫu phù hợp.</p><button type="button" className="text-button" onClick={() => onOpenAssistant()}>Thử đặt câu hỏi <Icon name="arrow" size={14} /></button></aside></section>
    <div className="demo-banner"><span className="demo-pulse" />Tài khoản, ghi danh, câu trả lời và lịch sử đều là dữ liệu minh họa trong phiên này.</div>
  </div>;
}

function StudentCourses({ courses, documents, onOpenAssistant }: { courses: Course[]; documents: LearningDocument[]; onOpenAssistant: (courseId?: string) => void }) {
  return <div className="page-stack student-page-stack"><PageHeading eyebrow="KHÔNG GIAN HỌC TẬP" title="Môn học của tôi" description="Các môn học mẫu được ghi danh cho tài khoản sinh viên này." action={<span className="date-pill"><Icon name="course" size={15} />{courses.length} môn học demo</span>} /><div className="demo-banner"><span className="demo-pulse" />Danh sách chỉ hiển thị các môn được gán cho persona demo hiện tại.</div>{courses.length ? <div className="student-course-grid student-course-grid-page">{courses.map((course) => <CourseCard key={course.id} course={course} documents={documents} onOpenAssistant={onOpenAssistant} />)}</div> : <EmptyState title="Chưa có môn học" description="Môn học được ghi danh sẽ xuất hiện tại đây." />}</div>;
}

export function StudentAssistant({ user, courses, course, documents, personalDocuments, messages, draft, pending, onCourseChange, onDraftChange, onSubmit, onEnter, onRate, listEndRef }: {
  user: DemoUser;
  courses: Course[];
  course?: Course;
  documents: LearningDocument[];
  personalDocuments: PersonalStudentDocument[];
  messages: ChatMessage[];
  draft: string;
  pending: boolean;
  onCourseChange: (courseId: string) => void;
  onDraftChange: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>, suggested?: string) => void;
  onEnter: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onRate: (courseId: string, messageId: string, rating: "positive" | "negative") => void;
  listEndRef: RefObject<HTMLDivElement | null>;
}) {
  const readyDocuments = documents.filter((document) => document.courseId === course?.id && document.status === "completed");
  const suggested = course ? suggestedQuestions[course.id] : undefined;
  return <div className="page-stack student-chat-page">
    <PageHeading eyebrow="TRỢ LÝ HỌC TẬP" title="Hỏi đáp cùng AI" description="Câu trả lời mẫu được giới hạn trong tài liệu của môn học đã chọn." action={<span className="demo-chat-badge"><span className="demo-pulse" />Mô phỏng demo</span>} />
    <div className="student-chat-layout">
      <aside className="student-chat-context"><div className="student-chat-context-heading"><span className="student-chat-context-icon"><Icon name="course" size={18} /></span><div><span>PHẠM VI CÂU HỎI</span><strong>Môn học</strong></div></div>
        <label className="field-label" htmlFor="student-chat-course">Chọn môn học</label><select className="form-control student-course-select" id="student-chat-course" value={course?.id ?? ""} onChange={(event) => onCourseChange(event.target.value)} disabled={courses.length === 0}>{courses.map((item) => <option value={item.id} key={item.id}>{item.code} · {item.name}</option>)}</select>
        {course ? <><div className="student-context-course"><span className="student-course-code">{course.code}</span><h3>{course.name}</h3><p>{course.description}</p></div><div className="student-context-rule"><span><Icon name="file" size={15} />Tài liệu môn học mẫu</span><strong>{readyDocuments.length}</strong></div><ul className="student-source-list">{readyDocuments.map((document) => <li key={document.id}><Icon name="file" size={14} /><span>{document.name}</span></li>)}</ul><div className="student-context-rule"><span><Icon name="file" size={15} />Tài liệu cá nhân demo</span><strong>{personalDocuments.filter((document) => document.courseId === course.id).length}</strong></div>{personalDocuments.filter((document) => document.courseId === course.id).length > 0 && <ul className="student-source-list">{personalDocuments.filter((document) => document.courseId === course.id).map((document) => <li key={document.id}><Icon name="file" size={14} /><span>{document.name} · tệp chưa được đọc</span></li>)}</ul>}<p className="student-personal-disclosure">Tệp cá nhân chỉ được liệt kê trong demo. Trợ lý không phân tích nội dung tệp đã chọn.</p></> : <EmptyState title="Chưa có môn học" description="Không có môn học để đặt câu hỏi." />}
        {suggested && <div className="student-suggestion-card"><span>GỢI Ý CÂU HỎI</span><button type="button" onClick={() => onSubmit(undefined, suggested)} disabled={pending || !course}>{suggested}</button></div>}
        <div className="student-scope-note"><Icon name="settings" size={14} /><span>Dữ liệu hội thoại được tách theo từng môn trong phiên demo.</span></div>
        <div className="student-demo-state-actions"><span>THỬ CÁC TRẠNG THÁI DEMO</span><button type="button" onClick={() => onSubmit(undefined, "Chủ đề này không xuất hiện trong tài liệu môn học.")} disabled={pending || !course}>Câu hỏi chưa có nguồn</button><button type="button" onClick={() => onSubmit(undefined, "Mô phỏng lỗi demo")} disabled={pending || !course}>Mô phỏng lỗi kỹ thuật</button></div>
      </aside>

      <section className="student-chat-panel" aria-label={`Trò chuyện môn ${course?.name ?? "học"}`}>
        <div className="student-chat-header"><span className="student-chat-bot-icon"><Icon name="sparkles" size={19} /></span><span><strong>Trợ lý học tập</strong><small>{course?.code ?? "Chưa chọn môn"} · Nguồn từ học liệu mẫu</small></span><span className="student-chat-header-status"><i /> Đang hoạt động</span></div>
        {!course ? <EmptyState title="Chưa có môn học khả dụng" description="Hãy đăng nhập bằng persona sinh viên có môn học demo." /> : <>
          <div className="student-message-list" role="log" aria-label="Lịch sử trò chuyện" aria-live="polite" aria-relevant="additions text">
            <div className="student-chat-day-label"><span />HÔM NAY<span /></div>
            {messages.map((message) => <ChatMessageView key={message.id} message={message} user={user} courseId={course.id} onRate={onRate} />)}
            {pending && <div className="student-message-row assistant-message-row"><span className="student-message-avatar"><Icon name="sparkles" size={14} /></span><div className="student-message-body"><span className="student-message-author">Trợ lý học tập <small>đang tra cứu tài liệu mẫu</small></span><div className="student-pending-bubble" role="status"><span /><span /><span />Đang tìm câu trả lời…</div></div></div>}
            <div ref={listEndRef} />
          </div>
          <div className="student-chat-compose-area"><p className="student-chat-disclosure"><Icon name="info" size={14} />Đây là phản hồi cố định từ fixture; chưa gọi mô hình AI hoặc API thật. Nội dung tệp bạn chọn không được đọc.</p><form className="student-chat-composer" onSubmit={(event) => onSubmit(event)}><label className="sr-only" htmlFor="student-chat-input">Câu hỏi của bạn</label><textarea id="student-chat-input" value={draft} rows={1} maxLength={500} placeholder="Hỏi về nội dung trong tài liệu môn học…" onChange={(event) => onDraftChange(event.target.value)} onKeyDown={onEnter} disabled={pending} /><button className="student-send-button" type="submit" aria-label="Gửi câu hỏi" disabled={pending || !draft.trim()}><Icon name="arrow" size={18} /></button></form><span className="student-chat-key-hint">Enter để gửi · Shift + Enter để xuống dòng · Tối đa 500 ký tự</span></div>
        </>}
      </section>
    </div>
    <div className="demo-banner"><span className="demo-pulse" />Chỉ các citation cố định trong dữ liệu demo mới được hiển thị như nguồn tham khảo.</div>
  </div>;
}

function ChatMessageView({ message, user, courseId, onRate }: { message: ChatMessage; user: DemoUser; courseId: string; onRate: (courseId: string, messageId: string, rating: "positive" | "negative") => void }) {
  if (message.author === "student") return <div className="student-message-row student-user-message"><div className="student-user-bubble">{message.text}<span>{message.createdAt}</span></div><span className="student-user-avatar" aria-hidden="true">{user.name.split(" ").slice(-2).map((part) => part[0]).join("")}</span></div>;
  const status = message.status ?? "answered";
  return <div className={`student-message-row assistant-message-row student-answer-${status}`}><span className="student-message-avatar"><Icon name="sparkles" size={14} /></span><div className="student-message-body"><span className="student-message-author">Trợ lý học tập <small>{message.createdAt}</small></span><div className="student-answer-bubble"><span className={`student-answer-status student-answer-status-${status}`}><i />{messageStatusLabel(status)}</span><p>{message.text}</p>
      {status === "answered" && message.citations && message.citations.length > 0 && <div className="student-citations"><span className="student-citations-label"><Icon name="file" size={14} />Nguồn tham khảo mẫu</span>{message.citations.map((citation) => <details className="student-citation" key={citation.id}><summary><span><strong>{citation.documentName}</strong><small>Trang {citation.page}</small></span><Icon name="chevron" size={15} /></summary><p>{citation.snippet}</p></details>)}</div>}
      {status === "answered" && <div className="student-answer-feedback"><span>Câu trả lời này có hữu ích không?</span><button type="button" aria-pressed={message.rating === "positive"} aria-label="Câu trả lời hữu ích" title="Hữu ích" className={message.rating === "positive" ? "student-rating-active" : ""} onClick={() => onRate(courseId, message.id, "positive")}>👍</button><button type="button" aria-pressed={message.rating === "negative"} aria-label="Câu trả lời chưa hữu ích" title="Chưa hữu ích" className={message.rating === "negative" ? "student-rating-active" : ""} onClick={() => onRate(courseId, message.id, "negative")}>👎</button></div>}
    </div></div></div>;
}

function StudentHistory({ conversations, onOpen }: { conversations: { course: Course; messages: ChatMessage[] }[]; onOpen: (courseId: string) => void }) {
  const items = conversations.flatMap(({ course, messages }) => {
    const question = [...messages].reverse().find((message) => message.author === "student");
    const answer = [...messages].reverse().find((message) => message.author === "assistant");
    return question ? [{ course, question, answer }] : [];
  }).reverse();
  return <div className="page-stack student-page-stack"><PageHeading eyebrow="CÂU HỎI CỦA BẠN" title="Lịch sử hỏi đáp" description="Mở lại cuộc trò chuyện mẫu theo từng môn học." action={<span className="date-pill"><Icon name="clock" size={15} />{items.length} cuộc trò chuyện</span>} /><div className="demo-banner"><span className="demo-pulse" />Lịch sử chỉ tồn tại trong phiên demo đang mở.</div>{items.length ? <div className="student-history-list">{items.map(({ course, question, answer }) => <button className="student-history-item" key={course.id} type="button" onClick={() => onOpen(course.id)}><span className="student-history-icon"><Icon name="sparkles" size={18} /></span><span className="student-history-content"><span className="student-history-course">{course.code} · {course.name}</span><strong>{question.text}</strong><small>{answer ? messageStatusLabel(answer.status ?? "answered") : "Chưa có phản hồi"} · {question.createdAt}</small></span><Icon name="arrow" size={17} /></button>)}</div> : <EmptyState title="Chưa có lịch sử hỏi đáp" description="Câu hỏi của bạn sẽ xuất hiện tại đây." />}</div>;
}

function StudentAccount({ user, courses, onLogout }: { user: DemoUser; courses: Course[]; onLogout: () => void }) {
  const initials = user.name.split(" ").slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi");
  return <div className="page-stack student-page-stack"><PageHeading eyebrow="THÔNG TIN CÁ NHÂN" title="Tài khoản" description="Thông tin persona đang được dùng trong phiên demo." /><div className="student-account-layout"><section className="student-profile-card"><span className={`student-profile-avatar demo-role-avatar demo-role-${user.role}`}>{initials}</span><h2>{user.name}</h2><span className="student-profile-role">{demoRoleLabels[user.role]}</span><p>{user.email}</p><div className="student-profile-demo-note"><Icon name="info" size={16} /><span>Đây là hồ sơ minh họa. Thông tin không đồng bộ hoặc lưu vào hệ thống.</span></div><Button variant="secondary" icon="logout" onClick={onLogout}>Đăng xuất phiên demo</Button></section><section className="panel student-account-details"><div className="panel-heading"><div><h2>Phạm vi học tập mẫu</h2><p>Các môn học được gán sẵn cho persona này.</p></div></div>{courses.length ? <ul className="student-account-course-list">{courses.map((course) => <li key={course.id}><span className="student-account-course-code">{course.code.slice(0, 2)}</span><span><strong>{course.name}</strong><small>{course.code} · ghi danh mẫu</small></span><Icon name="check" size={16} /></li>)}</ul> : <EmptyState title="Chưa có môn học" description="Không có môn học mẫu được gán." />}<div className="student-account-meta"><span>Vai trò</span><strong>{demoRoleLabels[user.role]}</strong><span>Kiểu phiên</span><strong>Demo · chỉ trong bộ nhớ</strong></div></section></div></div>;
}
