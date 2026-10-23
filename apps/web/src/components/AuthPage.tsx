import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./Icon";
import { demoAccounts, demoPassword, demoRoleLabels } from "../data/demoData";
import type { DemoAccount, DemoRole, DemoUser } from "../types";

type AuthMode = "login" | "signup";

function publicDemoUser(account: DemoAccount): DemoUser {
  return { id: account.id, name: account.name, email: account.email, role: account.role, courseIds: account.courseIds };
}

export function AuthPage({ onLogin, onSignup }: {
  onLogin: (user: DemoUser) => void;
  onSignup: (user: DemoUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submitTimer = useRef<number | null>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (submitTimer.current) window.clearTimeout(submitTimer.current); }, []);

  const enterWithDemo = (user: DemoUser) => onLogin(user);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setConfirmError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLocaleLowerCase("vi");
    const password = String(form.get("password") ?? "");
    setSubmitting(true);

    submitTimer.current = window.setTimeout(() => {
      submitTimer.current = null;
      if (mode === "login") {
        const account = demoAccounts.find((candidate) => candidate.email === email && candidate.password === password);
        if (!account) {
          setError("Email hoặc mật khẩu demo chưa đúng. Bạn có thể dùng một trong các tài khoản trải nghiệm bên dưới.");
          setSubmitting(false);
          return;
        }
        setSubmitting(false);
        onLogin(publicDemoUser(account));
        return;
      }

      const name = String(form.get("name") ?? "").trim();
      const confirmPassword = String(form.get("confirmPassword") ?? "");
      const requestedRole = String(form.get("role") ?? "student");
      const role: DemoRole = requestedRole === "teacher" ? "teacher" : "student";
      if (demoAccounts.some((account) => account.email === email)) {
        setError("Email này thuộc persona demo có sẵn. Hãy dùng một địa chỉ khác để mở phiên trải nghiệm.");
        setSubmitting(false);
        return;
      }
      if (password.length < 8) {
        setError("Mật khẩu demo cần có ít nhất 8 ký tự.");
        setSubmitting(false);
        return;
      }
      if (password !== confirmPassword) {
        setConfirmError("Mật khẩu xác nhận chưa khớp.");
        setSubmitting(false);
        confirmPasswordRef.current?.focus();
        return;
      }
      const courseIds = role === "teacher" ? ["course-3", "course-4"] : ["course-1", "course-2", "course-3"];
      const user: DemoUser = { id: `signup-${Date.now().toString(36)}`, name, email, role, courseIds };
      setSubmitting(false);
      onSignup(user);
    }, 280);
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase" aria-label="Giới thiệu Minh Tâm">
        <div className="auth-showcase-glow auth-showcase-glow-one" />
        <div className="auth-showcase-glow auth-showcase-glow-two" />
        <div className="auth-brand"><span className="auth-brand-mark"><Icon name="sparkles" size={21} /></span><span><strong>Minh Tâm</strong><small>AI Learning Assistant</small></span></div>
        <div className="auth-showcase-copy">
          <span className="auth-overline"><i /> KHÔNG GIAN HỌC TẬP THÔNG MINH</span>
          <h1>Tri thức của bạn,<br /><span>luôn trong tầm tay.</span></h1>
          <p>Học cùng tài liệu môn học, đặt câu hỏi và xem câu trả lời đi kèm nguồn tham khảo.</p>
          <div className="auth-product-card">
            <div className="auth-product-top"><span className="auth-product-icon"><Icon name="sparkles" size={18} /></span><span><strong>Trợ lý môn học</strong><small>Trả lời dựa trên học liệu</small></span><span className="auth-online"><i /> Sẵn sàng</span></div>
            <div className="auth-sample-question">Mạng nơ-ron cập nhật trọng số như thế nào?</div>
            <div className="auth-sample-answer"><span className="auth-answer-mark"><Icon name="sparkles" size={14} /></span><p>Mô hình dùng lan truyền ngược để điều chỉnh trọng số nhằm giảm sai số dự đoán.</p></div>
            <div className="auth-sample-citation"><Icon name="file" size={14} /><span>Bài giảng Neural Networks</span><strong>Trang 12</strong></div>
          </div>
        </div>
        <div className="auth-showcase-footer"><span>Học tập có ngữ cảnh</span><span>·</span><span>Nguồn rõ ràng</span><span>·</span><span>Demo nội bộ</span></div>
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand"><span className="auth-brand-mark"><Icon name="sparkles" size={19} /></span><span><strong>Minh Tâm</strong><small>AI Learning Assistant</small></span></div>
        <div className="auth-card">
          <div className="auth-form-heading">
            <span className="auth-kicker">CHÀO MỪNG BẠN</span>
            <h2>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản demo"}</h2>
            <p>{mode === "login" ? "Tiếp tục đến không gian học tập của bạn." : "Chọn vai trò để xem thử đúng giao diện."}</p>
          </div>

          <div className="auth-mode-switch" role="group" aria-label="Chọn đăng nhập hoặc đăng ký">
            <button type="button" aria-pressed={mode === "login"} className={mode === "login" ? "auth-mode-active" : ""} disabled={submitting} onClick={() => { setMode("login"); setError(""); setConfirmError(""); }}>Đăng nhập</button>
            <button type="button" aria-pressed={mode === "signup"} className={mode === "signup" ? "auth-mode-active" : ""} disabled={submitting} onClick={() => { setMode("signup"); setError(""); setConfirmError(""); }}>Đăng ký</button>
          </div>

          <form key={mode} className="auth-form" onSubmit={submit} aria-busy={submitting}>
            {mode === "signup" && <div className="auth-field"><label htmlFor="signup-name">Họ và tên</label><input id="signup-name" name="name" type="text" autoComplete="name" placeholder="Ví dụ: Nguyễn Minh Anh" required maxLength={80} /></div>}
            <div className="auth-field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" autoComplete="email" placeholder="ban@truong.edu.vn" required maxLength={120} /></div>
            <div className="auth-field"><div className="auth-field-label-row"><label htmlFor="auth-password">Mật khẩu</label>{mode === "login" && <span className="auth-field-hint">Dùng tài khoản demo bên dưới</span>}</div><input id="auth-password" name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Ít nhất 8 ký tự" required minLength={mode === "signup" ? 8 : 1} /></div>
            {mode === "signup" && <>
              <div className="auth-field"><label htmlFor="auth-confirm-password">Xác nhận mật khẩu</label><input ref={confirmPasswordRef} id="auth-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" required minLength={8} aria-invalid={Boolean(confirmError)} aria-describedby={confirmError ? "confirm-password-error" : undefined} onChange={() => setConfirmError("")} />{confirmError && <span id="confirm-password-error" className="auth-field-error" role="alert">{confirmError}</span>}</div>
              <fieldset className="auth-role-field"><legend>Vai trò trải nghiệm</legend><div className="auth-role-options">
                {(["student", "teacher"] as const).map((role) => <label className="auth-role-choice" key={role}><input type="radio" name="role" value={role} defaultChecked={role === "student"} /><span className="auth-role-icon"><Icon name={role === "student" ? "course" : "users"} size={17} /></span><span><strong>{demoRoleLabels[role]}</strong><small>{role === "student" ? "Học theo tài liệu môn" : "Quản lý môn được phân công"}</small></span></label>)}
              </div><p className="auth-field-hint">Tài khoản admin chỉ có trong persona demo, không mở đăng ký công khai.</p></fieldset>
            </>}

            {error && <p className="auth-error" role="alert"><Icon name="feedback" size={16} />{error}</p>}
            {mode === "signup" && <p className="auth-demo-note">Đăng ký chỉ mở phiên demo tạm thời trên trang này. Không gửi dữ liệu lên máy chủ và không lưu sau khi thoát.</p>}
            <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? <><span className="auth-spinner" /> Đang mở phiên demo…</> : <>{mode === "login" ? "Đăng nhập" : "Tạo phiên demo"}<Icon name="arrow" size={17} /></>}</button>
          </form>

          {mode === "login" && <div className="demo-access">
            <div className="demo-access-heading"><span>TRẢI NGHIỆM NHANH</span><span>Không cần nhập mật khẩu</span></div>
            <div className="demo-access-list">{demoAccounts.map((account) => {
              const user = publicDemoUser(account);
              return <button type="button" key={account.id} className="demo-access-row" onClick={() => enterWithDemo(user)}>
                <span className={`demo-role-avatar demo-role-${account.role}`}>{account.name.split(" ").slice(-2).map((part) => part[0]).join("")}</span>
                <span className="demo-access-person"><strong>{demoRoleLabels[account.role]}</strong><small>{account.email}</small></span>
                <span className="demo-access-open">Mở <Icon name="arrow" size={14} /></span>
              </button>;
            })}</div>
            <p className="demo-password-hint">Hoặc nhập thủ công: email tài khoản demo + mật khẩu <code>{demoPassword}</code></p>
          </div>}
          <p className="auth-terms">Bằng cách tiếp tục, bạn đang trải nghiệm <strong>bản demo nội bộ</strong> của Minh Tâm.</p>
        </div>
        <footer className="auth-copyright"><span>© 2026 Minh Tâm AI Learning Assistant</span><span>Trợ giúp <span aria-hidden="true">·</span> Quyền riêng tư</span></footer>
      </section>
    </main>
  );
}
