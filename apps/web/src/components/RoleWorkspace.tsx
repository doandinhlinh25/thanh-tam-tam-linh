import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { demoRoleLabels } from "../data/demoData";
import type { DemoUser } from "../types";

export interface PortalNavigationItem {
  id: string;
  label: string;
  icon: IconName;
}

export function RoleWorkspace({
  user,
  activePage,
  title,
  navigation,
  onNavigate,
  onLogout,
  children,
}: {
  user: DemoUser;
  activePage: string;
  title: string;
  navigation: PortalNavigationItem[];
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const initials = user.name.split(" ").slice(-2).map((part) => part[0]).join("").toLocaleUpperCase("vi");

  return (
    <div className={`role-shell role-shell-${user.role}`}>
      <a className="skip-link" href="#role-main">Đến nội dung chính</a>
      <aside className="role-sidebar" aria-label={`Điều hướng ${demoRoleLabels[user.role].toLocaleLowerCase("vi")}`}>
        <div className="role-brand"><span className="role-brand-mark"><Icon name="sparkles" size={19} /></span><span><strong>Minh Tâm</strong><small>AI Learning Assistant</small></span></div>
        <div className="role-workspace-card"><span className="role-workspace-icon">TT</span><span><strong>Trường Thành Tâm</strong><small>{demoRoleLabels[user.role]} · Không gian demo</small></span><span className="role-demo-pill">DEMO</span></div>
        <nav className="role-navigation" aria-label="Điều hướng chính">
          <p className="role-nav-label">KHÔNG GIAN CỦA BẠN</p>
          {navigation.map((item) => <button key={item.id} type="button" className={`role-nav-item ${activePage === item.id ? "role-nav-active" : ""}`} aria-current={activePage === item.id ? "page" : undefined} onClick={() => onNavigate(item.id)}><Icon name={item.icon} size={18} /><span>{item.label}</span>{activePage === item.id && <i />}</button>)}
        </nav>
        <div className="role-sidebar-bottom"><div className="role-help-card"><span className="role-help-icon">?</span><span><strong>Đang dùng dữ liệu demo</strong><small>Các thay đổi chỉ có trong phiên này</small></span></div><div className="role-sidebar-account"><span className={`demo-role-avatar demo-role-${user.role}`}>{initials}</span><span><strong>{user.name}</strong><small>{demoRoleLabels[user.role]}</small></span><button type="button" className="icon-button" aria-label="Đăng xuất" onClick={onLogout}><Icon name="logout" size={16} /></button></div></div>
      </aside>
      <div className="role-main-column">
        <header className="role-topbar"><div className="role-breadcrumb"><span>Trường Thành Tâm</span><Icon name="chevron" size={14} /><strong>{title}</strong></div><div className="role-topbar-actions"><span className="role-session-tag"><i /> Phiên demo</span><span className="role-topbar-identity"><strong>{user.name}</strong><small>{demoRoleLabels[user.role]}</small></span><span className={`demo-role-avatar demo-role-${user.role}`} aria-hidden="true">{initials}</span><button type="button" className="role-logout-button" onClick={onLogout}><Icon name="logout" size={15} /><span>Đăng xuất</span></button></div></header>
        <main className="role-main-content" id="role-main">{children}</main>
        <footer className="role-footer"><span>Minh Tâm AI Learning Assistant</span><span>Giao diện minh họa · Không kết nối dịch vụ thật</span></footer>
      </div>
    </div>
  );
}
