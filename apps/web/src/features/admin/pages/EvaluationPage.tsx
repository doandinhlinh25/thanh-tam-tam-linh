import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EvaluationQuestion, EvaluationSummary } from "../../../shared/domain/types";
import { Icon } from "../../../shared/ui/Icon";
import { Button, Modal, PageHeading, SectionCard } from "../../../shared/ui/Primitives";

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function EvaluationPage({
  questions,
  evaluation,
  onAddQuestion,
  onCreateSet,
  onRun,
}: {
  questions: EvaluationQuestion[];
  evaluation: EvaluationSummary;
  onAddQuestion: (question: Omit<EvaluationQuestion, "id" | "score">) => void;
  onCreateSet: (name: string) => void;
  onRun: () => void;
}) {
  const [questionOpen, setQuestionOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [setName, setSetName] = useState(evaluation.setName);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [questionError, setQuestionError] = useState("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); }, []);

  const runEvaluation = () => {
    if (running) return;
    setRunning(true);
    setProgress(0);
    let next = 0;
    timerRef.current = window.setInterval(() => {
      next = Math.min(100, next + 10);
      setProgress(next);
      if (next >= 100) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        onRun();
        setRunning(false);
      }
    }, 95);
  };

  const submitQuestion = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const question = String(form.get("question") ?? "").trim();
    const answer = String(form.get("answer") ?? "").trim();
    const evidence = String(form.get("evidence") ?? "").trim();
    if (!question || !answer) {
      setQuestionError("Nhập câu hỏi và đáp án tham chiếu để tiếp tục.");
      return;
    }
    onAddQuestion({ question, referenceAnswer: answer, evidence: evidence || "Chưa gắn nguồn kỳ vọng", answerable: form.get("answerable") === "yes" });
    setQuestionError("");
    setQuestionOpen(false);
  };

  const exportData = (format: "csv" | "json") => {
    if (format === "json") {
      downloadFile("evaluation-demo.json", JSON.stringify({ setName: evaluation.setName, lastRun: evaluation.lastRun, questions }, null, 2), "application/json;charset=utf-8");
      return;
    }
    const rows = [["Câu hỏi", "Đáp án tham chiếu", "Nguồn", "Có thể trả lời", "Điểm"], ...questions.map((item) => [item.question, item.referenceAnswer, item.evidence, item.answerable ? "Có" : "Không", item.score === null ? "Chưa chạy" : `${item.score}%`])];
    downloadFile("evaluation-demo.csv", rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), "text/csv;charset=utf-8");
  };

  const chartPoints = evaluation.history.map((value, index) => {
    const x = 20 + index * (320 / Math.max(1, evaluation.history.length - 1));
    const y = 132 - value * 1.08;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="page-stack">
      <PageHeading eyebrow="CHẤT LƯỢNG TRẢ LỜI" title="Đánh giá AI" description="Theo dõi độ chính xác của câu trả lời và nguồn trích dẫn." action={<Button icon="plus" disabled={running} onClick={() => { setSetName(evaluation.setName); setSetOpen(true); }}>Tạo bộ đánh giá</Button>} />
      <div className="demo-banner"><span className="demo-pulse" />Kết quả mô phỏng cố định <span className="demo-banner-separator">·</span> Không gọi mô hình AI hoặc dịch vụ đánh giá thật</div>

      <section className="evaluation-run-card">
        <div className="run-card-copy"><span className="run-card-icon"><Icon name="sparkles" size={20} /></span><div><span className="eyebrow">BỘ ĐANG CHỌN</span><h2>{evaluation.setName}</h2><p>{questions.length} câu hỏi · Chạy gần nhất {evaluation.lastRun}</p></div></div>
        <div className="run-card-actions"><Button onClick={() => setQuestionOpen(true)} icon="plus" disabled={running}>Thêm câu hỏi</Button><Button variant="primary" icon="sparkles" disabled={running || questions.length === 0} onClick={runEvaluation}>{running ? "Đang đánh giá..." : "Chạy đánh giá"}</Button></div>
        {running && <div className="run-progress" role="progressbar" aria-label="Tiến trình đánh giá demo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="progress-caption"><span>Đang chuẩn bị kết quả cố định từ bộ dữ liệu mẫu</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div></div>}
      </section>

      <div className="evaluation-metric-grid">
        <div className="evaluation-metric-card"><span>Recall@k</span><strong>{evaluation.recall}<small>%</small></strong><div className="metric-track"><i style={{ width: `${evaluation.recall}%` }} /></div><p>Chỉ số minh họa · khả năng tìm đúng nguồn</p></div>
        <div className="evaluation-metric-card"><span>Chất lượng câu trả lời</span><strong>{evaluation.answerQuality}<small>%</small></strong><div className="metric-track metric-blue"><i style={{ width: `${evaluation.answerQuality}%` }} /></div><p>Mức độ phù hợp đáp án</p></div>
        <div className="evaluation-metric-card"><span>Độ chính xác citation</span><strong>{evaluation.citationAccuracy}<small>%</small></strong><div className="metric-track metric-green"><i style={{ width: `${evaluation.citationAccuracy}%` }} /></div><p>Chỉ số minh họa · nguồn khớp nội dung</p></div>
        <div className="evaluation-metric-card"><span>Từ chối đúng</span><strong>{evaluation.refusalAccuracy}<small>%</small></strong><div className="metric-track metric-amber"><i style={{ width: `${evaluation.refusalAccuracy}%` }} /></div><p>Chỉ số minh họa · câu hỏi thiếu bằng chứng</p></div>
      </div>

      <div className="evaluation-content-grid">
        <SectionCard title="Câu hỏi trong bộ đánh giá" subtitle="Đáp án tham chiếu và nguồn bằng chứng kỳ vọng" action={<span className="count-pill">{questions.length} câu</span>}>
          {questions.length === 0 ? <div className="empty-state"><span className="empty-icon"><Icon name="sparkles" /></span><strong>Chưa có câu hỏi</strong><p>Thêm câu hỏi đầu tiên để tạo bộ đánh giá mẫu.</p></div> : <div className="table-scroll" role="region" aria-label="Danh sách câu hỏi đánh giá" tabIndex={0}>
            <table className="data-table evaluation-table"><thead><tr><th>Câu hỏi</th><th>Nguồn kỳ vọng</th><th>Khả năng trả lời</th><th>Điểm mẫu</th></tr></thead>
              <tbody>{questions.map((item) => <tr key={item.id}><td><div className="question-cell"><strong>{item.question}</strong><span>{item.referenceAnswer}</span></div></td><td className="evidence-cell">{item.evidence}</td><td><span className={`answerable-badge ${item.answerable ? "answerable-yes" : "answerable-no"}`}>{item.answerable ? "Có thể trả lời" : "Thiếu bằng chứng"}</span></td><td><strong className="score-value">{item.score === null ? "Chưa chạy" : `${item.score}%`}</strong></td></tr>)}</tbody>
            </table>
          </div>}
        </SectionCard>
        <SectionCard title="Xu hướng chất lượng" subtitle="Điểm câu trả lời qua 6 lần chạy gần nhất" action={<span className="chart-period">6 lần chạy</span>}>
          <div className="line-chart" role="img" aria-label={`Điểm câu trả lời qua các lần chạy: ${evaluation.history.join(", ")} phần trăm`}>
            <div className="line-chart-labels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>
            <svg viewBox="0 0 360 150" preserveAspectRatio="none" aria-hidden="true">
              {[24, 51, 78, 105, 132].map((y) => <line key={y} x1="18" x2="342" y1={y} y2={y} className="chart-gridline" />)}
              <polyline points={chartPoints} className="chart-line" />
              {evaluation.history.map((value, index) => { const x = 20 + index * (320 / Math.max(1, evaluation.history.length - 1)); const y = 132 - value * 1.08; return <circle key={`${index}-${value}`} cx={x} cy={y} r="4" className="chart-point" />; })}
            </svg>
            <div className="line-chart-x"><span>Lần 1</span><span>Lần 2</span><span>Lần 3</span><span>Lần 4</span><span>Lần 5</span><span>Gần nhất</span></div>
          </div>
          <div className="evaluation-export"><span><Icon name="download" size={15} /> Xuất kết quả mẫu</span><div><button type="button" onClick={() => exportData("csv")}>CSV</button><button type="button" onClick={() => exportData("json")}>JSON</button></div></div>
        </SectionCard>
      </div>

      <Modal open={setOpen} title="Tạo bộ đánh giá" description="Tạo tên bộ câu hỏi mới trong dữ liệu demo." onClose={() => setSetOpen(false)}>
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); if (setName.trim()) { onCreateSet(setName.trim()); setSetOpen(false); } }}>
          <label className="field-label" htmlFor="evaluation-set-name">Tên bộ đánh giá <span className="required-mark">*</span></label>
          <input className="form-control" id="evaluation-set-name" value={setName} onChange={(event) => setSetName(event.target.value)} required />
          <div className="modal-footer"><Button type="button" onClick={() => setSetOpen(false)}>Hủy</Button><Button type="submit" variant="primary">Tạo bộ đánh giá</Button></div>
        </form>
      </Modal>

      <Modal open={questionOpen} title="Thêm câu hỏi đánh giá" description="Bổ sung câu hỏi và bằng chứng tham chiếu mẫu." onClose={() => setQuestionOpen(false)} size="large">
        <form className="form-stack" onSubmit={submitQuestion}>
          <label className="field-label" htmlFor="eval-question">Câu hỏi <span className="required-mark">*</span></label>
          <textarea className="form-control textarea-control" id="eval-question" name="question" placeholder="Nhập câu hỏi cần đánh giá" required />
          <label className="field-label" htmlFor="eval-answer">Đáp án tham chiếu <span className="required-mark">*</span></label>
          <textarea className="form-control textarea-control" id="eval-answer" name="answer" placeholder="Nhập đáp án mong đợi" required />
          <label className="field-label" htmlFor="eval-evidence">Nguồn bằng chứng kỳ vọng</label>
          <input className="form-control" id="eval-evidence" name="evidence" placeholder="Ví dụ: Bài giảng tuần 06, trang 12" />
          <fieldset className="radio-fieldset"><legend>Câu hỏi có thể trả lời từ tài liệu?</legend><label><input type="radio" name="answerable" value="yes" defaultChecked /> Có thể trả lời</label><label><input type="radio" name="answerable" value="no" /> Cần từ chối</label></fieldset>
          {questionError && <p className="field-error" role="alert">{questionError}</p>}
          <div className="modal-footer"><Button type="button" onClick={() => setQuestionOpen(false)}>Hủy</Button><Button type="submit" variant="primary" icon="plus">Thêm câu hỏi</Button></div>
        </form>
      </Modal>
    </div>
  );
}
