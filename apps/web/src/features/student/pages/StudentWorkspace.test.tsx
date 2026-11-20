import { act, cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "../../../test/renderApp";
import { demoAccounts } from "../../demo/adapters/demoData";
import { StudentWorkspace } from "./StudentWorkspace";

const student = demoAccounts.find((account) => account.role === "student")!;

function renderWorkspace() {
  return renderApp(<StudentWorkspace user={student} onLogout={vi.fn()} />, "/student/assistant");
}

function courseSelector() {
  return screen.getByRole("combobox", { name: "Chọn môn học" });
}

function composer() {
  return screen.getByRole("textbox", { name: "Câu hỏi của bạn" });
}

function chatLog() {
  return screen.getByRole("log", { name: "Lịch sử trò chuyện" });
}

function navigateTo(name: string) {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Điều hướng chính" })).getByRole("button", { name }));
}

async function finishResponse() {
  await act(async () => { await vi.advanceTimersByTimeAsync(520); });
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("course-scoped student conversations", () => {
  it("restores each course draft and clears only the submitted course draft", async () => {
    const { user } = renderWorkspace();
    await user.type(composer(), "Bản nháp của môn trí tuệ nhân tạo");
    await user.selectOptions(courseSelector(), "course-1");
    expect(composer()).toHaveValue("");
    expect(within(chatLog()).getByText("Chưa có câu hỏi trong môn này")).toBeInTheDocument();

    await user.type(composer(), "Giải thích oop trong lập trình");
    await user.selectOptions(courseSelector(), "course-3");
    expect(composer()).toHaveValue("Bản nháp của môn trí tuệ nhân tạo");
    await user.selectOptions(courseSelector(), "course-1");
    expect(composer()).toHaveValue("Giải thích oop trong lập trình");

    await user.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    expect(composer()).toHaveValue("");
    await user.selectOptions(courseSelector(), "course-3");
    expect(composer()).toHaveValue("Bản nháp của môn trí tuệ nhân tạo");
    expect(within(chatLog()).queryByText("Giải thích oop trong lập trình")).not.toBeInTheDocument();
  });

  it("keeps a pending question single and disables competing submission controls", async () => {
    vi.useFakeTimers();
    renderWorkspace();
    fireEvent.change(courseSelector(), { target: { value: "course-1" } });
    const question = "Giải thích oop để tránh gửi lặp";
    fireEvent.change(composer(), { target: { value: question } });
    const form = composer().closest("form")!;

    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
      fireEvent.keyDown(composer(), { key: "Enter", code: "Enter" });
    });

    expect(composer()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Gửi câu hỏi" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lập trình hướng đối tượng là gì?" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mô phỏng lỗi kỹ thuật" })).toBeDisabled();
    expect(within(chatLog()).getAllByText(question)).toHaveLength(1);
    expect(within(chatLog()).getByRole("status")).toHaveTextContent("Đang tìm câu trả lời");

    await finishResponse();

    expect(within(chatLog()).getAllByText(question)).toHaveLength(1);
    expect(within(chatLog()).getAllByText(/Lập trình hướng đối tượng tổ chức phần mềm/)).toHaveLength(1);
    expect(within(chatLog()).queryByRole("status")).not.toBeInTheDocument();
    expect(composer()).toBeEnabled();
  });

  it("keeps a delayed answer in its original course while another course stays usable", async () => {
    vi.useFakeTimers();
    renderWorkspace();
    fireEvent.change(courseSelector(), { target: { value: "course-1" } });
    const question = "Giải thích oop trong môn lập trình";
    fireEvent.change(composer(), { target: { value: question } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    fireEvent.change(courseSelector(), { target: { value: "course-2" } });

    expect(composer()).toBeEnabled();
    expect(within(chatLog()).queryByText(question)).not.toBeInTheDocument();
    expect(within(chatLog()).queryByRole("status")).not.toBeInTheDocument();
    fireEvent.change(composer(), { target: { value: "Bản nháp riêng của môn cơ sở dữ liệu" } });
    await finishResponse();

    expect(within(chatLog()).queryByText(/Lập trình hướng đối tượng tổ chức phần mềm/)).not.toBeInTheDocument();
    expect(within(chatLog()).queryByRole("button", { name: /Lập trình hướng đối tượng.pdf/ })).not.toBeInTheDocument();
    fireEvent.change(courseSelector(), { target: { value: "course-1" } });
    expect(within(chatLog()).getByText(question)).toBeInTheDocument();
    expect(within(chatLog()).getByRole("button", { name: /Lập trình hướng đối tượng.pdf/ })).toBeInTheDocument();
    expect(composer()).toHaveValue("");
    fireEvent.change(courseSelector(), { target: { value: "course-2" } });
    expect(composer()).toHaveValue("Bản nháp riêng của môn cơ sở dữ liệu");
  });

  it("does not label a new pending history question with the previous answer status", async () => {
    vi.useFakeTimers();
    renderWorkspace();
    const question = "Một câu hỏi nơ-ron mới đang chờ";
    fireEvent.change(composer(), { target: { value: question } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi câu hỏi" }));
    navigateTo("Lịch sử hỏi đáp");

    const pendingConversation = screen.getByRole("button", { name: new RegExp(question) });
    expect(pendingConversation).toHaveTextContent("Chưa có phản hồi");
    expect(pendingConversation).not.toHaveTextContent("Có nguồn tham khảo");
    await finishResponse();
    expect(pendingConversation).toHaveTextContent("Có nguồn tham khảo");

    fireEvent.click(pendingConversation);
    expect(courseSelector()).toHaveValue("course-3");
    expect(within(chatLog()).getByText(question)).toBeInTheDocument();
  });

  it("restores the chosen course from history and keeps its answer rating isolated", async () => {
    const { user } = renderWorkspace();
    await user.click(within(chatLog()).getByRole("button", { name: "Câu trả lời hữu ích" }));
    await user.click(within(chatLog()).getByRole("button", { name: "Câu trả lời chưa hữu ích" }));
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời hữu ích" })).toHaveAttribute("aria-pressed", "false");
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời chưa hữu ích" })).toHaveAttribute("aria-pressed", "true");
    await user.selectOptions(courseSelector(), "course-1");
    await user.click(screen.getByRole("button", { name: "Lập trình hướng đối tượng là gì?" }));
    const courseOneRating = await within(chatLog()).findByRole("button", { name: "Câu trả lời hữu ích" });
    expect(courseOneRating).toHaveAttribute("aria-pressed", "false");
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời chưa hữu ích" })).toHaveAttribute("aria-pressed", "false");
    await user.click(courseOneRating);

    navigateTo("Lịch sử hỏi đáp");
    await user.click(screen.getByRole("button", { name: /CS101/ }));
    expect(courseSelector()).toHaveValue("course-1");
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời hữu ích" })).toHaveAttribute("aria-pressed", "true");
    expect(within(chatLog()).queryByText("Mạng nơ-ron cập nhật trọng số như thế nào?")).not.toBeInTheDocument();

    navigateTo("Lịch sử hỏi đáp");
    await user.click(screen.getByRole("button", { name: /AI302/ }));
    expect(courseSelector()).toHaveValue("course-3");
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời chưa hữu ích" })).toHaveAttribute("aria-pressed", "true");
    expect(within(chatLog()).getByRole("button", { name: "Câu trả lời hữu ích" })).toHaveAttribute("aria-pressed", "false");
    expect(within(chatLog()).queryByText("Lập trình hướng đối tượng là gì?")).not.toBeInTheDocument();
  });

  it("offers no answer rating for a technical failure or insufficient evidence", async () => {
    vi.useFakeTimers();
    renderWorkspace();
    fireEvent.change(courseSelector(), { target: { value: "course-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Mô phỏng lỗi kỹ thuật" }));
    await finishResponse();
    expect(within(chatLog()).getByText(/Không thể hoàn tất câu hỏi/)).toBeInTheDocument();
    expect(within(chatLog()).queryByRole("button", { name: "Câu trả lời hữu ích" })).not.toBeInTheDocument();
    expect(within(chatLog()).queryByRole("button", { name: "Câu trả lời chưa hữu ích" })).not.toBeInTheDocument();

    fireEvent.click(within(chatLog()).getByRole("button", { name: "Thử lại câu hỏi" }));
    await finishResponse();
    expect(within(chatLog()).getByText(/chưa tìm thấy đủ thông tin/)).toBeInTheDocument();
    expect(within(chatLog()).queryByRole("button", { name: "Câu trả lời hữu ích" })).not.toBeInTheDocument();
    expect(within(chatLog()).queryByRole("button", { name: "Câu trả lời chưa hữu ích" })).not.toBeInTheDocument();
  });
});
