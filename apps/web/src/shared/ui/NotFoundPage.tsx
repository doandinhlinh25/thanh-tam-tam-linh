import { Link } from "react-router-dom";
import { routes } from "../../app/routes";

export function NotFoundPage() {
  return <main className="route-not-found"><span className="eyebrow">404 · KHÔNG TÌM THẤY TRANG</span><h1>Trang này chưa có trong bản demo.</h1><p>Đường dẫn có thể đã thay đổi hoặc không nằm trong các màn hình hiện có.</p><Link className="button button-primary" to={routes.login}>Về trang đăng nhập</Link></main>;
}
