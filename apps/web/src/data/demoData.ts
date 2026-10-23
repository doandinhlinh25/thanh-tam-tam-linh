import type { ChatMessage, DemoAccount, DemoRole, MockCitation } from "../types";

export const demoRoleLabels: Record<DemoRole, string> = {
  student: "Sinh viên",
  teacher: "Giáo viên",
  admin: "Quản trị viên",
};

export const demoPassword = "demo1234";

export const demoAccounts: DemoAccount[] = [
  { id: "user-student-demo", name: "Nguyễn Minh Anh", email: "minhanh@minhtam.demo", role: "student", courseIds: ["course-1", "course-2", "course-3"], password: demoPassword },
  { id: "user-teacher-demo", name: "Cô Lan Nguyễn", email: "colan@minhtam.demo", role: "teacher", courseIds: ["course-3", "course-4"], password: demoPassword },
  { id: "user-admin-demo", name: "Admin Tâm", email: "admin@minhtam.demo", role: "admin", courseIds: ["course-1", "course-2", "course-3", "course-4", "course-5"], password: demoPassword },
];

export const demoChatAnswers: Record<string, { keywords: string[]; answer: string; citations: MockCitation[] }> = {
  "course-1": {
    keywords: ["hướng đối tượng", "oop", "lớp và đối tượng"],
    answer: "Lập trình hướng đối tượng tổ chức phần mềm thành các lớp và đối tượng. Cách tiếp cận này gom dữ liệu với hành vi liên quan, giúp cấu trúc chương trình dễ mở rộng và bảo trì hơn.",
    citations: [{ id: "cite-oop-1", documentId: "doc-1001", documentName: "Lập trình hướng đối tượng.pdf", page: 8, snippet: "Lập trình hướng đối tượng tổ chức phần mềm thành các lớp và đối tượng, kết hợp dữ liệu với hành vi." }],
  },
  "course-2": {
    keywords: ["index", "chỉ mục", "tối ưu truy vấn"],
    answer: "Chỉ mục phù hợp với cột thường được dùng để lọc hoặc nối bảng. Chỉ mục có thể giảm số lần đọc dữ liệu khi truy vấn, nhưng cũng làm tăng chi phí khi thêm hoặc cập nhật bản ghi.",
    citations: [{ id: "cite-sql-1", documentId: "doc-1003", documentName: "SQL Query Optimization.pdf", page: 8, snippet: "Chỉ mục là cấu trúc dữ liệu hỗ trợ tìm kiếm và giúp giảm số lần đọc dữ liệu khi truy vấn." }],
  },
  "course-3": {
    keywords: ["nơ-ron", "trọng số", "backpropagation", "lan truyền ngược"],
    answer: "Trong quá trình huấn luyện, mô hình dùng lan truyền ngược để truyền sai số từ đầu ra về các lớp trước. Bộ tối ưu sau đó điều chỉnh trọng số nhằm giảm hàm mất mát qua từng vòng lặp.",
    citations: [{ id: "cite-neural-1", documentId: "doc-1008", documentName: "Bài giảng tuần 06 - Neural Networks.pdf", page: 12, snippet: "Mạng nơ-ron nhân tạo gồm các lớp nút được kết nối với nhau. Trong quá trình huấn luyện, mô hình cập nhật trọng số để giảm sai số dự đoán." }],
  },
  "course-5": {
    keywords: ["tcp", "số thứ tự", "ack", "đúng thứ tự"],
    answer: "TCP dùng số thứ tự cho các phần dữ liệu và xác nhận ACK để theo dõi phần dữ liệu đã nhận. Nhờ vậy bên nhận có thể sắp xếp dữ liệu và yêu cầu gửi lại khi phát hiện thiếu.",
    citations: [{ id: "cite-network-1", documentId: "doc-1004", documentName: "Computer Networks - Transport.pdf", page: 31, snippet: "TCP cung cấp khả năng truyền dữ liệu tin cậy và có kiểm soát giữa các tiến trình." }],
  },
};

export function createInitialStudentChats(): Record<string, ChatMessage[]> {
  const answer = demoChatAnswers["course-3"];
  return {
    "course-3": [
      { id: "sample-question-1", author: "student", text: "Mạng nơ-ron cập nhật trọng số như thế nào?", createdAt: "09:18" },
      { id: "sample-answer-1", author: "assistant", text: answer.answer, createdAt: "09:18", status: "answered", citations: answer.citations },
    ],
  };
}
