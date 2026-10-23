import type { Course, EvaluationSummary, FeedbackItem, LearningDocument, PageId } from "../types";
import { courseName, formatNumber } from "../data/mockData";
import { Icon } from "../components/Icon";
import { PageHeading, SectionCard, StatCard, StatusBadge } from "../components/Primitives";

export function OverviewPage({
  documents,
  courses,
  feedback,
  evaluation,
  onNavigate,
}: {
  documents: LearningDocument[];
  courses: Course[];
  feedback: FeedbackItem[];
  evaluation: EvaluationSummary;
  onNavigate: (page: PageId) => void;
}) {
  const totalChunks = documents.reduce((sum, document) => sum + document.chunks, 0);
  const statusCounts = [
    { key: "completed" as const, label: "Hoàn tất", color: "#3eb58a" },
    { key: "processing" as const, label: "Đang xử lý", color: "#e9a73d" },
    { key: "pending" as const, label: "Chờ xử lý", color: "#8190b0" },
    { key: "failed" as const, label: "Thất bại", color: "#e36b71" },
  ].map((item) => ({ ...item, count: documents.filter((doc) => doc.status === item.key).length }));
  const positiveCount = feedback.filter((item) => item.rating === "positive").length;
  const negativeCount = feedback.length - positiveCount;
  const recentDocs = [...documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).slice(0, 4);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="THỨ BẢY, 17 THÁNG 10, 2026"
        title="Tổng quan"
        description="Theo dõi hoạt động của trợ lý học tập trong một nơi."
        action={<span className="date-pill"><Icon name="calendar" size={15} /> Học kỳ 1 · 2026–2027</span>}
      />

      <div className="demo-banner"><span className="demo-pulse" />Đang xem dữ liệu minh họa <span className="demo-banner-separator">·</span> Các thao tác chỉ lưu trong phiên trình duyệt này</div>

      <div className="stats-grid">
        <StatCard label="Tổng tài liệu" value={formatNumber(documents.length)} hint="+12%" icon="file" tone="violet" />
        <StatCard label="Môn học" value={formatNumber(courses.length)} hint="+2" icon="course" tone="blue" />
        <StatCard label="Tổng chunks" value={formatNumber(totalChunks)} hint="+8.4%" icon="overview" tone="green" />
        <StatCard label="Câu hỏi tháng này" value="2.486" hint="+18%" icon="feedback" tone="amber" />
      </div>

      <div className="overview-grid">
        <SectionCard title="Trạng thái tài liệu" subtitle="Phân bố xử lý trong kho tài liệu" action={<button className="text-button" type="button" onClick={() => onNavigate("documents")}>Xem tài liệu <Icon name="arrow" size={14} /></button>}>
          <div className="status-chart" role="img" aria-label={statusCounts.map((item) => `${item.label}: ${item.count}`).join(", ")}>
            <div className="status-chart-total"><strong>{documents.length}</strong><span>tài liệu</span></div>
            {statusCounts.map((item) => <span key={item.key} className="status-chart-segment" style={{ width: documents.length ? `${Math.max(item.count / documents.length * 100, item.count ? 4 : 0)}%` : "0%", background: item.color }} />)}
          </div>
          <div className="chart-legend">
            {statusCounts.map((item) => <div className="legend-row" key={item.key}><span className="legend-dot" style={{ background: item.color }} /><span>{item.label}</span><strong>{item.count}</strong></div>)}
          </div>
        </SectionCard>

        <SectionCard title="Phản hồi học viên" subtitle="Đánh giá trên câu trả lời AI">
          <div className="feedback-chart-wrap">
            <div className="feedback-donut" style={{ background: `conic-gradient(#6c63df 0 ${feedback.length ? positiveCount / feedback.length * 100 : 0}%, #f0a34a 0 100%)` }} role="img" aria-label={`${positiveCount} phản hồi tích cực, ${negativeCount} phản hồi cần xem lại`}>
              <div><strong>{feedback.length ? Math.round(positiveCount / feedback.length * 100) : 0}%</strong><span>hữu ích</span></div>
            </div>
            <div className="feedback-legend">
              <div><span className="legend-dot legend-violet" /><span>Tích cực</span><strong>{positiveCount}</strong></div>
              <div><span className="legend-dot legend-amber" /><span>Cần xem lại</span><strong>{negativeCount}</strong></div>
              <p>Tổng cộng {feedback.length} phản hồi trong dữ liệu mẫu</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="overview-grid overview-grid-bottom">
        <SectionCard title="Tài liệu mới tải lên" subtitle="Hoạt động gần đây" action={<button className="text-button" type="button" onClick={() => onNavigate("documents")}>Tất cả <Icon name="arrow" size={14} /></button>}>
          {recentDocs.length === 0 ? <p className="muted-copy">Chưa có tài liệu trong dữ liệu mẫu.</p> : <div className="recent-list">
            {recentDocs.map((doc) => <div className="recent-item" key={doc.id}>
              <span className={`file-type-icon ${doc.format === "PDF" ? "file-pdf" : "file-docx"}`}>{doc.format === "PDF" ? "PDF" : "DOC"}</span>
              <div className="recent-main"><strong title={doc.name}>{doc.name}</strong><span>{courseName(courses, doc.courseId)} · {doc.uploadedAt}</span></div>
              <StatusBadge status={doc.status} />
            </div>)}
          </div>}
        </SectionCard>

        <SectionCard title="Đánh giá AI gần nhất" subtitle={evaluation.setName} action={<button className="text-button" type="button" onClick={() => onNavigate("evaluation")}>Chi tiết <Icon name="arrow" size={14} /></button>}>
          <div className="evaluation-overview">
            <div className="evaluation-score"><strong>{evaluation.answerQuality}<small>%</small></strong><span>Chất lượng câu trả lời</span></div>
            <div className="evaluation-metrics">
              <div><span>Recall@k</span><strong>{evaluation.recall}%</strong></div>
              <div><span>Độ chính xác citation</span><strong>{evaluation.citationAccuracy}%</strong></div>
              <div><span>Từ chối đúng</span><strong>{evaluation.refusalAccuracy}%</strong></div>
            </div>
            <p className="evaluation-date"><Icon name="clock" size={14} /> Chạy gần nhất {evaluation.lastRun}</p>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
