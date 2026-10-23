import { useEffect, useState, type FormEvent } from "react";
import type { SystemSettings } from "../../../shared/domain/types";
import { Icon } from "../../../shared/ui/Icon";
import { Button, PageHeading, SectionCard } from "../../../shared/ui/Primitives";

export function SettingsPage({ settings, onSave, onReset }: { settings: SystemSettings; onSave: (settings: SystemSettings) => void; onReset: () => void }) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(settings); }, [settings]);

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(draft);
    setSaved(true);
  };

  return (
    <div className="page-stack">
      <PageHeading eyebrow="CẤU HÌNH HỆ THỐNG" title="Cài đặt" description="Điều chỉnh cách trợ lý tìm kiếm và trả lời dựa trên tài liệu." />
      <div className="demo-banner"><span className="demo-pulse" />Cài đặt mẫu <span className="demo-banner-separator">·</span> Không kết nối tới mô hình AI thật</div>

      <form className="settings-layout" onSubmit={submit}>
        <div className="settings-main">
          <SectionCard title="Mô hình AI" subtitle="Các lựa chọn dưới đây chỉ dùng để minh họa giao diện cấu hình.">
            <div className="settings-fields">
              <label className="settings-field" htmlFor="llm-model"><span><strong>Mô hình ngôn ngữ</strong><small>Dùng để tạo câu trả lời cho học viên.</small></span><select className="form-control" id="llm-model" value={draft.llmModel} onChange={(event) => update("llmModel", event.target.value)}><option>LLM Demo - Balanced</option><option>LLM Demo - Fast</option><option>LLM Demo - Accurate</option></select></label>
              <label className="settings-field" htmlFor="embedding-model"><span><strong>Mô hình embedding</strong><small>Dùng để tìm đoạn nội dung liên quan.</small></span><select className="form-control" id="embedding-model" value={draft.embeddingModel} onChange={(event) => update("embeddingModel", event.target.value)}><option>Embedding Demo - v2</option><option>Embedding Demo - Multilingual</option><option>Embedding Demo - Lightweight</option></select></label>
            </div>
          </SectionCard>

          <SectionCard title="Tìm kiếm tài liệu" subtitle="Cân bằng giữa độ liên quan của nội dung và số lượng ngữ cảnh đưa vào câu trả lời.">
            <div className="settings-fields">
              <label className="settings-field" htmlFor="setting-top-k"><span><strong>Số đoạn nội dung (Top K)</strong><small>Số đoạn có điểm cao nhất được dùng làm ngữ cảnh.</small></span><span className="number-input-wrap"><input className="form-control" id="setting-top-k" type="number" min="1" max="20" value={draft.topK} onChange={(event) => update("topK", Number(event.target.value))} /><small>đoạn</small></span></label>
              <label className="settings-field" htmlFor="setting-chunk-size"><span><strong>Kích thước mỗi đoạn</strong><small>Số ký tự tối đa trong một đoạn nội dung.</small></span><span className="number-input-wrap"><input className="form-control" id="setting-chunk-size" type="number" min="100" max="4000" step="100" value={draft.chunkSize} onChange={(event) => update("chunkSize", Number(event.target.value))} /><small>ký tự</small></span></label>
              <label className="settings-field" htmlFor="setting-overlap"><span><strong>Phần nội dung trùng lặp</strong><small>Giúp giữ ngữ cảnh giữa hai đoạn liền kề.</small></span><span className="number-input-wrap"><input className="form-control" id="setting-overlap" type="number" min="0" max={Math.max(0, draft.chunkSize - 1)} step="20" value={draft.overlap} onChange={(event) => update("overlap", Number(event.target.value))} /><small>ký tự</small></span></label>
              <div className="settings-field threshold-field"><div><strong>Ngưỡng liên quan</strong><small>Chỉ dùng đoạn nội dung vượt mức này trong kết quả tìm kiếm.</small></div><label className="range-control"><input type="range" min="0.4" max="0.95" step="0.01" value={draft.retrievalThreshold} onChange={(event) => update("retrievalThreshold", Number(event.target.value))} aria-label="Ngưỡng liên quan" /><span>{draft.retrievalThreshold.toFixed(2)}</span></label></div>
            </div>
          </SectionCard>

          <SectionCard title="Hành vi trợ lý" subtitle="Thiết lập cách hệ thống phản hồi khi không tìm được bằng chứng phù hợp.">
            <label className="toggle-row" htmlFor="refusal-enabled"><span className="toggle-copy"><strong>Từ chối khi thiếu bằng chứng</strong><small>Không tự tạo câu trả lời khi tài liệu môn học chưa cung cấp thông tin liên quan.</small></span><input className="toggle-input" id="refusal-enabled" type="checkbox" checked={draft.refusalEnabled} onChange={(event) => update("refusalEnabled", event.target.checked)} /><span className="toggle-track" aria-hidden="true" /></label>
          </SectionCard>
          <div className="settings-actions"><Button type="button" onClick={onReset}>Khôi phục mặc định</Button><Button variant="primary" type="submit" icon="check">Lưu cài đặt demo</Button></div>
          {saved && <p className="settings-saved" role="status"><Icon name="check" size={15} /> Đã lưu cài đặt trong phiên trình duyệt này.</p>}
        </div>
        <aside className="settings-aside"><div className="settings-note-icon"><Icon name="sparkles" size={19} /></div><h2>Về cấu hình này</h2><p>Các giá trị hiện tại mô phỏng thiết lập cho trợ lý RAG. Thay đổi không gửi tới máy chủ hoặc thay đổi mô hình thực tế.</p><div className="settings-aside-rule" /><div className="settings-aside-stat"><span>Top K hiện tại</span><strong>{draft.topK} đoạn</strong></div><div className="settings-aside-stat"><span>Kích thước đoạn</span><strong>{draft.chunkSize} ký tự</strong></div><div className="settings-aside-stat"><span>Ngưỡng liên quan</span><strong>{draft.retrievalThreshold.toFixed(2)}</strong></div></aside>
      </form>
    </div>
  );
}
