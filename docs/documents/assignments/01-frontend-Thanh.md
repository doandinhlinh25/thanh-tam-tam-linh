# Người 1 — Frontend Lead

**Trạng thái:** Chưa triển khai.<br>
**Nguồn:** Sổ tay AI-01, mục 9.1, 10, 12 và 14.<br>
**Phạm vi mã nguồn:** `apps/web/` sẽ được tạo khi bắt đầu frontend. Chỉ gọi API công khai qua Kong; không gọi endpoint nội bộ của service.

## Mục tiêu

Xây giao diện React + TypeScript cho đăng nhập, tenant/course, tài liệu và hỏi đáp có trích dẫn. Giao diện phản ánh quyền để thuận tiện sử dụng; backend vẫn là nơi quyết định quyền truy cập.

## Công việc theo thứ tự

1. **Tuần 1–2 — nền tảng:** thống nhất wireframe và API mapping với Người 2; tạo React/Vite/TypeScript, routing, theme, API client, query cache, xử lý loading/error và test frontend. Dùng mock theo OpenAPI khi backend chưa có.
2. **Tuần 2 — danh tính và tenant:** làm trang đăng nhập/đăng xuất, trạng thái phiên, tenant switcher và redirect theo membership/role. Không lưu session token trong `localStorage`; luồng cookie/CSRF theo contract Auth đã chốt.
3. **Tuần 2–3 — course và tài liệu:** dashboard theo vai trò; danh sách course, tài liệu và trạng thái ingestion; upload PDF có tiến độ, polling và thông báo file sai định dạng, PDF scan, quota hoặc xử lý lỗi.
4. **Tuần 4 — chat:** giao diện chọn course, lịch sử, trạng thái answered/insufficient evidence/error, citation mở đúng file/trang/snippet và feedback. Không hiển thị citation chưa được backend xác nhận.
5. **Tuần 4–5 — quản trị và E2E:** màn hình tenant/gói/usage tối thiểu theo API thực có; viết Playwright cho luồng lecturer upload → READY → student hỏi → citation → feedback và tình huống truy cập chéo tenant bị từ chối.

## Phụ thuộc cần trao đổi

| Cần từ | Nội dung | Mốc trong sổ tay |
|---|---|---|
| Người 2 | OpenAPI Auth, Tenant/Course, cookie/CSRF, response lỗi chung, quyền và tenant switch | Cuối tuần 1 |
| Người 3 | API upload, trạng thái tài liệu, citation metadata và các mã lỗi ingestion | Trước luồng E2E tuần 5 |
| Người 4 | Contract chat answer/refusal/error, citation và feedback | Cuối tuần 2 |

## Bàn giao và nghiệm thu

- `apps/web/`, hướng dẫn chạy, wireframe, bảng ánh xạ màn hình ↔ API, ảnh demo.
- Ít nhất 10 test UI có giá trị: phiên hợp lệ/hết hạn, đổi tenant, course bị cấm, upload hợp lệ, file sai, scan không hỗ trợ, quota, ingestion lỗi, chat có citation, thiếu evidence, lỗi provider và feedback. Có thể kết hợp ca khi test vẫn chứng minh đủ hành vi.
- E2E không nhận dữ liệu hoặc source của tenant khác; không gọi API nội bộ; mọi lỗi quan trọng có trạng thái UI rõ ràng.
- Frontend build, typecheck và test đạt; không hard-code route, role, message hay giá trị nghiệp vụ rải rác trong component.

## Ngoài phạm vi

Không tự xác thực quyền tại frontend, không tự dựng citation từ text LLM, không triển khai backend hoặc model AI.
