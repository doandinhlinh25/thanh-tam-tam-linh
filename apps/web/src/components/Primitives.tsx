import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";
import type { DocumentStatus } from "../types";
import { statusLabels } from "../data/mockData";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: IconName;
}

export function Button({ variant = "secondary", icon, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`button button-${variant} ${className}`.trim()} {...props}>
      {icon && <Icon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function SearchInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`search-field ${className}`.trim()}>
      <Icon name="search" size={17} />
      <input {...props} type="search" />
    </label>
  );
}

export function SelectField({ className = "", children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`select-field ${className}`.trim()}>
      <select {...props}>{children}</select>
      <Icon name="chevron" size={15} className="select-chevron" />
    </label>
  );
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>;
}

export function RatingBadge({ positive }: { positive: boolean }) {
  return <span className={`rating-badge ${positive ? "rating-positive" : "rating-negative"}`}>
    <span className="rating-symbol" aria-hidden="true">{positive ? "↑" : "↓"}</span>
    {positive ? "Tích cực" : "Chưa tốt"}
  </span>;
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  action,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div className="panel-action">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
  tone: "violet" | "blue" | "green" | "amber";
}) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-${tone}`}><Icon name={icon} size={19} /></div>
      <p className="stat-label">{label}</p>
      <div className="stat-value-row"><strong>{value}</strong><span className="stat-hint"><Icon name="trend" size={13} />{hint}</span></div>
    </article>
  );
}

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  size = "medium",
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "medium" | "large";
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal-${size}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="modal-header">
        <div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>
        <button className="icon-button" type="button" aria-label="Đóng hộp thoại" onClick={onClose}><Icon name="close" /></button>
      </div>
      <div className="modal-content">{children}</div>
    </dialog>
  );
}

export function Toast({ message, onClose }: { message: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 3600);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast-check"><Icon name="check" size={16} /></span>
      <span>{message}</span>
      <button className="icon-button toast-close" type="button" aria-label="Ẩn thông báo" onClick={onClose}><Icon name="close" size={15} /></button>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="pagination">
      <span>Hiển thị <strong>{start}–{end}</strong> trong <strong>{total}</strong> kết quả</span>
      <div className="pagination-controls">
        <button className="page-button" type="button" disabled={page <= 1} aria-label="Trang trước" onClick={() => onPageChange(page - 1)}>‹</button>
        <span className="page-number">{page} / {pageCount}</span>
        <button className="page-button" type="button" disabled={page >= pageCount} aria-label="Trang sau" onClick={() => onPageChange(page + 1)}>›</button>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="file" size={22} /></span><strong>{title}</strong><p>{description}</p></div>;
}
