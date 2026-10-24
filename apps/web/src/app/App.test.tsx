import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";
import { renderApp } from "../test/renderApp";

describe("role-based demo routes", () => {
  it("opens the login route for a visitor", () => {
    renderApp(<App />);
    expect(screen.getByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("does not offer admin as a public signup role", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: "Đăng ký" }));
    expect(screen.getByRole("heading", { name: "Tạo tài khoản demo" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Sinh viên/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Giáo viên/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Quản trị viên/ })).not.toBeInTheDocument();
  });

  it("rejects an invalid demo login with an announced error", async () => {
    const { user } = renderApp(<App />);
    await user.type(screen.getByLabelText("Email"), "wrong@example.test");
    await user.type(screen.getByLabelText("Mật khẩu"), "wrong-password");
    const form = screen.getByLabelText("Email").closest("form");
    expect(form).not.toBeNull();
    await user.click(form!.querySelector<HTMLButtonElement>('button[type="submit"]')!);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Email hoặc mật khẩu demo chưa đúng/);
  });

  it("redirects a protected student URL to login without a demo session", () => {
    renderApp(<App />, "/student/courses");
    expect(screen.getByRole("heading", { name: "Đăng nhập" })).toBeInTheDocument();
  });

  it("enters the student home through the demo quick-entry", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    expect(await screen.findByText(/hôm nay bạn muốn học gì/)).toBeInTheDocument();
  });

  it("opens the student courses page from URL navigation", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Môn học của tôi" }));
    expect(await screen.findByRole("heading", { name: "Môn học của tôi" })).toBeInTheDocument();
  });

  it("opens the student's personal document destination", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Tài liệu cá nhân" }));
    expect(await screen.findByRole("heading", { name: "Thêm tài liệu của bạn" })).toBeInTheDocument();
  });

  it("rejects unsupported files in the student personal library", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Tài liệu cá nhân" }));
    const input = screen.getByLabelText("Chọn tệp PDF hoặc DOCX");
    Object.defineProperty(input, "files", { configurable: true, value: [new File(["text"], "notes.txt", { type: "text/plain" })] });
    fireEvent.change(input);
    expect(await screen.findByRole("alert")).toHaveTextContent("Chọn tệp có định dạng PDF hoặc DOCX.");
    expect(screen.getByText("Thư viện cá nhân đang trống")).toBeInTheDocument();
  });

  it("shows mock transfer progress and can cancel without adding the file", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Tài liệu cá nhân" }));
    await user.upload(screen.getByLabelText("Chọn tệp PDF hoặc DOCX"), new File(["pdf"], "notes.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Thêm vào tài liệu cá nhân" }));
    expect(await screen.findByRole("progressbar", { name: "Tiến trình mô phỏng" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Đã hủy thao tác mô phỏng");
    expect(screen.getByText("Thư viện cá nhân đang trống")).toBeInTheDocument();
  });

  it("adds selected student file metadata after the demo progress completes", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Tài liệu cá nhân" }));
    await user.upload(screen.getByLabelText("Chọn tệp PDF hoặc DOCX"), new File(["pdf content"], "lecture.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Thêm vào tài liệu cá nhân" }));
    expect(await screen.findByText("lecture.pdf", {}, { timeout: 2500 })).toBeInTheDocument();
    expect(screen.getByText(/Mô phỏng demo · Chỉ lưu tên, định dạng và dung lượng/)).toBeInTheDocument();
  });

  it("keeps the teacher course list within assigned demo courses", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Giáo viên/ }));
    await user.click(await screen.findByRole("button", { name: "Môn được phân công" }));
    expect(await screen.findByText("SE210")).toBeInTheDocument();
    expect(screen.queryByText("CS101")).not.toBeInTheDocument();
  });

  it("shows the admin evaluation demo route and its synthetic disclosure", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Quản trị viên/ }));
    await user.click(await screen.findByRole("button", { name: "Đánh giá AI" }));
    expect(await screen.findByRole("heading", { name: "Đánh giá AI" })).toBeInTheDocument();
    expect(screen.getByText(/Không gọi mô hình AI hoặc dịch vụ đánh giá thật/)).toBeInTheDocument();
  });

  it("uses the same fixed sample score when an admin runs evaluation", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Quản trị viên/ }));
    await user.click(await screen.findByRole("button", { name: "Đánh giá AI" }));
    const sampleRow = screen.getByRole("row", { name: /Mạng nơ-ron cập nhật trọng số/ });
    await user.click(screen.getByRole("button", { name: "Chạy đánh giá" }));
    expect(await within(sampleRow).findByText("94%", {}, { timeout: 2500 })).toBeInTheDocument();
  });

  it("leaves an unmatched admin evaluation question without an invented score", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Quản trị viên/ }));
    await user.click(await screen.findByRole("button", { name: "Đánh giá AI" }));
    await user.click(screen.getByRole("button", { name: "Thêm câu hỏi" }));
    await user.type(screen.getByPlaceholderText("Nhập câu hỏi cần đánh giá"), "Câu hỏi kiểm thử chưa có fixture");
    await user.type(screen.getByPlaceholderText("Nhập đáp án mong đợi"), "Đáp án tham chiếu mẫu");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Thêm câu hỏi" }));
    const newRow = screen.getByRole("row", { name: /Câu hỏi kiểm thử chưa có fixture/ });
    expect(within(newRow).getByText("Chưa chạy")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chạy đánh giá" }));
    expect(await within(newRow).findByText("Chưa chạy", {}, { timeout: 2500 })).toBeInTheDocument();
  });

  it("shows a not-found page for an unknown URL", () => {
    renderApp(<App />, "/missing-route");
    expect(screen.getByRole("heading", { name: "Trang này chưa có trong bản demo." })).toBeInTheDocument();
  });

  it("keeps the assistant's unsupported question separate from technical error", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(await screen.findByRole("button", { name: "Trợ lý AI" }));
    await user.click(screen.getByRole("button", { name: "Câu hỏi chưa có nguồn" }));
    expect(await screen.findByText(/chưa tìm thấy đủ thông tin/)).toBeInTheDocument();
    expect(screen.queryByText(/Không thể hoàn tất câu hỏi/)).not.toBeInTheDocument();
  });

  it("shows a sample citation for a matching assistant question", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Trợ lý AI" }));
    await user.click(screen.getByRole("button", { name: /Mạng nơ-ron cập nhật trọng số/ }));
    expect(await screen.findByText("Nguồn tham khảo mẫu")).toBeInTheDocument();
    expect(screen.getByRole("log").querySelector(".student-citation summary strong")?.textContent).toContain("Neural Networks");
  });

  it("records answer feedback in the current demo session", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Trợ lý AI" }));
    const positiveRating = screen.getByRole("button", { name: "Câu trả lời hữu ích" });
    await user.click(positiveRating);
    expect(positiveRating).toHaveAttribute("aria-pressed", "true");
    expect(await screen.findByText("Đã ghi nhận đánh giá trong phiên demo.")).toBeInTheDocument();
  });

  it("keeps the assistant's technical failure distinct from a refusal", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    await user.click(within(await screen.findByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name: "Trợ lý AI" }));
    await user.click(screen.getByRole("button", { name: "Mô phỏng lỗi kỹ thuật" }));
    expect(await screen.findByText(/Không thể hoàn tất câu hỏi/)).toBeInTheDocument();
    expect(screen.queryByText(/chưa tìm thấy đủ thông tin/)).not.toBeInTheDocument();
  });

  it("does not let a student visit the admin URL", async () => {
    const { user } = renderApp(<App />);
    await user.click(screen.getByRole("button", { name: /Sinh viên/ }));
    window.history.pushState({}, "", "/admin/evaluation");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Đánh giá AI" })).not.toBeInTheDocument());
    expect(await screen.findByText(/hôm nay bạn muốn học gì/)).toBeInTheDocument();
  });
});
