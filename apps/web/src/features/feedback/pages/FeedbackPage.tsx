import { useMemo, useState } from "react";
import type { FeedbackItem } from "../../../shared/domain/types";
import { Icon } from "../../../shared/ui/Icon";
import { EmptyState, Modal, PageHeading, Pagination, RatingBadge, SearchInput, SelectField } from "../../../shared/ui/Primitives";

function parseDemoDate(value: string) {
  const [date = "", time = "00:00"] = value.split(" ");
  const [day, month, year] = date.split("/").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function FeedbackPage({ feedback }: { feedback: FeedbackItem[] }) {
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const pageSize = 5;
  const filtered = useMemo(() => feedback.filter((item) => {
    const needle = search.trim().toLocaleLowerCase("vi");
    const matchesText = !needle || `${item.student} ${item.course} ${item.question}`.toLocaleLowerCase("vi").includes(needle);
    const matchesRating = rating === "all" || item.rating === rating;
    const days = period === "7" ? 7 : period === "30" ? 30 : 0;
    const recordDate = parseDemoDate(item.createdAt);
    const now = new Date(2026, 9, 17, 23, 59).getTime();
    const matchesPeriod = days === 0 || recordDate >= now - days * 24 * 60 * 60 * 1000;
    return matchesText && matchesRating && matchesPeriod;
  }), [feedback, search, rating, period]);
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const positives = feedback.filter((item) => item.rating === "positive").length;

  return (
    <div className="page-stack">
      <PageHeading eyebrow="TIẾNG NÓI HỌC VIÊN" title="Feedback" description="Theo dõi phản hồi để cải thiện chất lượng câu trả lời." action={<span className="date-pill"><Icon name="feedback" size={15} /> {feedback.length} phản hồi mẫu</span>} />
      <div className="demo-banner"><span className="demo-pulse" />Phản hồi minh họa <span className="demo-banner-separator">·</span> Nội dung không gắn với tài khoản thật</div>

      <div className="feedback-summary-grid">
        <div className="feedback-summary-card"><span className="summary-icon summary-violet"><Icon name="feedback" /></span><div><span>Tổng phản hồi</span><strong>{feedback.length}</strong></div></div>
        <div className="feedback-summary-card"><span className="summary-icon summary-green"><Icon name="check" /></span><div><span>Đánh giá tích cực</span><strong>{positives}</strong></div><span className="summary-percent">{feedback.length ? Math.round(positives / feedback.length * 100) : 0}%</span></div>
        <div className="feedback-summary-card"><span className="summary-icon summary-amber"><Icon name="filter" /></span><div><span>Cần xem lại</span><strong>{feedback.length - positives}</strong></div><span className="summary-percent">{feedback.length ? Math.round((feedback.length - positives) / feedback.length * 100) : 0}%</span></div>
      </div>

      <section className="panel document-panel">
        <div className="document-toolbar">
          <div><h2>Danh sách phản hồi</h2><p>Xem câu hỏi, câu trả lời và nguồn được trích dẫn.</p></div>
          <div className="filter-row">
            <SearchInput aria-label="Tìm phản hồi" placeholder="Tìm học viên, câu hỏi..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
            <SelectField aria-label="Lọc theo đánh giá" value={rating} onChange={(event) => { setRating(event.target.value); setPage(1); }}><option value="all">Tất cả đánh giá</option><option value="positive">Tích cực</option><option value="negative">Chưa tốt</option></SelectField>
            <SelectField aria-label="Lọc theo thời gian" value={period} onChange={(event) => { setPeriod(event.target.value); setPage(1); }}><option value="all">Tất cả thời gian</option><option value="7">7 ngày gần đây</option><option value="30">30 ngày gần đây</option></SelectField>
          </div>
        </div>
        {visible.length === 0 ? <EmptyState title="Không tìm thấy phản hồi" description="Thay đổi bộ lọc hoặc từ khóa để xem phản hồi khác." /> : <>
          <div className="table-scroll" role="region" aria-label="Bảng phản hồi, có thể cuộn ngang" tabIndex={0}>
            <table className="data-table feedback-table"><thead><tr><th>Học viên</th><th>Câu hỏi</th><th>Đánh giá</th><th>Phân loại</th><th>Thời gian</th><th><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>{visible.map((item) => <tr key={item.id}>
                <td><div className="person-cell"><span className="person-avatar">{item.student.split(" ").slice(-2).map((part) => part[0]).join("")}</span><div><strong>{item.student}</strong><span>{item.course}</span></div></div></td>
                <td><span className="feedback-question">{item.question}</span></td>
                <td><RatingBadge positive={item.rating === "positive"} /></td>
                <td><span className={`category-tag ${item.rating === "negative" ? "category-review" : ""}`}>{item.category}</span></td>
                <td className="date-cell">{item.createdAt}</td>
                <td><button className="icon-button" type="button" aria-label={`Xem phản hồi của ${item.student}`} title="Xem chi tiết" onClick={() => setSelected(item)}><Icon name="eye" size={16} /></button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
        </>}
      </section>

      <Modal open={Boolean(selected)} title="Chi tiết phản hồi" description={selected?.course} onClose={() => setSelected(null)} size="large">
        {selected && <div className="feedback-detail">
          <div className="feedback-detail-meta"><div className="person-cell"><span className="person-avatar person-avatar-large">{selected.student.split(" ").slice(-2).map((part) => part[0]).join("")}</span><div><strong>{selected.student}</strong><span>{selected.createdAt}</span></div></div><RatingBadge positive={selected.rating === "positive"} /></div>
          <div className="detail-section"><h4>Câu hỏi của học viên</h4><p className="quote-box">{selected.question}</p></div>
          <div className="detail-section"><h4>Câu trả lời AI</h4><p className="answer-box">{selected.answer}</p></div>
          <div className="source-reference"><span className="source-ref-icon"><Icon name="file" size={16} /></span><div><span>Nguồn được trích dẫn</span><strong>{selected.source}</strong></div><span className="source-ref-page">Nguồn mẫu</span></div>
          <div className="feedback-classification"><span>Phân loại</span><span className={`category-tag ${selected.rating === "negative" ? "category-review" : ""}`}>{selected.category}</span></div>
        </div>}
      </Modal>
    </div>
  );
}
