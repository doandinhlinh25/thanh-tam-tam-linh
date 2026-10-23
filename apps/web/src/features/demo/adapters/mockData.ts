import type {
  Course,
  EvaluationQuestion,
  EvaluationSummary,
  FeedbackItem,
  LearningDocument,
  SystemSettings,
} from "../../../shared/domain/types";

export const initialCourses: Course[] = [
  { id: "course-1", code: "CS101", name: "Nhập môn lập trình", description: "Kiến thức nền tảng về tư duy lập trình và Python.", documentCount: 18, studentCount: 142, updatedAt: "16/10/2026" },
  { id: "course-2", code: "CS204", name: "Cơ sở dữ liệu", description: "Mô hình dữ liệu quan hệ, SQL và thiết kế cơ sở dữ liệu.", documentCount: 12, studentCount: 96, updatedAt: "15/10/2026" },
  { id: "course-3", code: "AI302", name: "Trí tuệ nhân tạo", description: "Các khái niệm AI, học máy và ứng dụng thực tế.", documentCount: 24, studentCount: 128, updatedAt: "14/10/2026" },
  { id: "course-4", code: "SE210", name: "Công nghệ phần mềm", description: "Quy trình phát triển và đảm bảo chất lượng phần mềm.", documentCount: 9, studentCount: 74, updatedAt: "12/10/2026" },
  { id: "course-5", code: "NET205", name: "Mạng máy tính", description: "Kiến trúc mạng, giao thức và bảo mật căn bản.", documentCount: 15, studentCount: 110, updatedAt: "10/10/2026" },
];

export const initialDocuments: LearningDocument[] = [
  { id: "doc-1008", name: "Bài giảng tuần 06 - Neural Networks.pdf", courseId: "course-3", format: "PDF", size: "4.8 MB", status: "completed", uploadedAt: "17/10/2026 09:42", processedAt: "17/10/2026 09:44", chunks: 42, pages: 36, extractedText: "Mạng nơ-ron nhân tạo gồm các lớp nút được kết nối với nhau. Trong quá trình huấn luyện, mô hình cập nhật trọng số để giảm sai số dự đoán..." },
  { id: "doc-1007", name: "Database Design - Chapter 4.docx", courseId: "course-2", format: "DOCX", size: "1.2 MB", status: "processing", uploadedAt: "17/10/2026 09:18", chunks: 0, pages: 18, extractedText: "Tài liệu đang được phân tích và chia thành các đoạn nội dung để lập chỉ mục." },
  { id: "doc-1006", name: "Python căn bản - bài tập.pdf", courseId: "course-1", format: "PDF", size: "2.6 MB", status: "pending", uploadedAt: "17/10/2026 08:56", chunks: 0, pages: 22, extractedText: "Tài liệu đang chờ xử lý." },
  { id: "doc-1005", name: "Software Testing Overview.pdf", courseId: "course-4", format: "PDF", size: "3.1 MB", status: "failed", uploadedAt: "16/10/2026 16:31", chunks: 0, pages: 0, extractedText: "", error: "Không trích xuất được văn bản. Tài liệu có thể là bản scan." },
  { id: "doc-1004", name: "Computer Networks - Transport.pdf", courseId: "course-5", format: "PDF", size: "5.4 MB", status: "completed", uploadedAt: "16/10/2026 14:12", processedAt: "16/10/2026 14:15", chunks: 57, pages: 48, extractedText: "Giao thức TCP cung cấp khả năng truyền dữ liệu tin cậy, có kiểm soát luồng và kiểm soát tắc nghẽn giữa các tiến trình..." },
  { id: "doc-1003", name: "SQL Query Optimization.pdf", courseId: "course-2", format: "PDF", size: "2.1 MB", status: "completed", uploadedAt: "15/10/2026 11:03", processedAt: "15/10/2026 11:05", chunks: 31, pages: 27, extractedText: "Tối ưu truy vấn giúp giảm số lần đọc đĩa và cải thiện thời gian phản hồi. Chỉ mục là cấu trúc dữ liệu hỗ trợ tìm kiếm..." },
  { id: "doc-1002", name: "Machine Learning - Đề cương.docx", courseId: "course-3", format: "DOCX", size: "860 KB", status: "completed", uploadedAt: "14/10/2026 10:28", processedAt: "14/10/2026 10:30", chunks: 19, pages: 16, extractedText: "Học máy là một nhánh của trí tuệ nhân tạo, tập trung vào việc xây dựng hệ thống học từ dữ liệu..." },
  { id: "doc-1001", name: "Lập trình hướng đối tượng.pdf", courseId: "course-1", format: "PDF", size: "3.7 MB", status: "completed", uploadedAt: "13/10/2026 08:40", processedAt: "13/10/2026 08:43", chunks: 38, pages: 32, extractedText: "Lập trình hướng đối tượng tổ chức phần mềm thành các lớp và đối tượng, kết hợp dữ liệu với hành vi..." },
];

export const initialQuestions: EvaluationQuestion[] = [
  { id: "q-1", question: "Mạng nơ-ron cập nhật trọng số như thế nào trong quá trình huấn luyện?", referenceAnswer: "Thông qua lan truyền ngược và tối ưu hóa hàm mất mát.", evidence: "Neural Networks, trang 12", answerable: true, score: 94 },
  { id: "q-2", question: "Khác nhau giữa INNER JOIN và LEFT JOIN là gì?", referenceAnswer: "INNER JOIN chỉ lấy bản ghi khớp ở cả hai bảng; LEFT JOIN giữ toàn bộ bản ghi bảng trái.", evidence: "Database Design, trang 24", answerable: true, score: 88 },
  { id: "q-3", question: "Python được tạo ra vào năm nào?", referenceAnswer: "Không có trong tài liệu môn học.", evidence: "Không có nguồn kỳ vọng", answerable: false, score: 91 },
  { id: "q-4", question: "TCP đảm bảo dữ liệu đến đúng thứ tự bằng cách nào?", referenceAnswer: "Sử dụng số thứ tự và xác nhận ACK.", evidence: "Computer Networks, trang 31", answerable: true, score: 82 },
];

export const demoEvaluationMetrics = {
  recall: 87,
  citationAccuracy: 94,
  refusalAccuracy: 89,
} as const;

export const demoEvaluationQuestionScores: Record<string, number> = {
  "q-1": 94,
  "q-2": 88,
  "q-3": 91,
  "q-4": 82,
};

export const initialFeedback: FeedbackItem[] = [
  { id: "fb-1", student: "Nguyễn Minh Anh", course: "Trí tuệ nhân tạo", question: "Backpropagation hoạt động ra sao?", answer: "Backpropagation truyền sai số ngược từ đầu ra về các lớp trước để cập nhật trọng số nhằm giảm loss.", source: "Neural Networks, trang 14", rating: "positive", category: "Hữu ích", createdAt: "17/10/2026 09:21" },
  { id: "fb-2", student: "Trần Quốc Bảo", course: "Cơ sở dữ liệu", question: "Khi nào nên dùng index?", answer: "Index phù hợp với cột thường dùng trong điều kiện lọc hoặc phép nối, nhưng có thể làm tăng chi phí ghi.", source: "SQL Query Optimization, trang 8", rating: "negative", category: "Thiếu chi tiết", createdAt: "17/10/2026 08:52" },
  { id: "fb-3", student: "Lê Thu Hà", course: "Nhập môn lập trình", question: "List comprehension là gì?", answer: "List comprehension là cách tạo danh sách mới từ một iterable bằng cú pháp ngắn gọn, có thể kèm điều kiện lọc.", source: "Python căn bản, trang 19", rating: "positive", category: "Hữu ích", createdAt: "16/10/2026 16:07" },
  { id: "fb-4", student: "Phạm Gia Huy", course: "Mạng máy tính", question: "TCP và UDP khác nhau ở điểm nào?", answer: "TCP có kết nối và đảm bảo thứ tự; UDP không thiết lập kết nối và ưu tiên độ trễ thấp.", source: "Computer Networks, trang 25", rating: "negative", category: "Nguồn chưa phù hợp", createdAt: "16/10/2026 14:39" },
  { id: "fb-5", student: "Đỗ Khánh Linh", course: "Trí tuệ nhân tạo", question: "Overfitting có thể phát hiện thế nào?", answer: "Mô hình có kết quả tốt trên tập huấn luyện nhưng kém trên tập kiểm tra.", source: "Machine Learning, trang 21", rating: "positive", category: "Hữu ích", createdAt: "15/10/2026 11:42" },
];

export const initialEvaluation: EvaluationSummary = {
  setName: "Bộ câu hỏi RAG - Học kỳ 1",
  lastRun: "17/10/2026 08:30",
  recall: 87,
  answerQuality: 89,
  citationAccuracy: demoEvaluationMetrics.citationAccuracy,
  refusalAccuracy: demoEvaluationMetrics.refusalAccuracy,
  history: [68, 74, 72, 81, 77, 89],
};

export const initialSettings: SystemSettings = {
  llmModel: "LLM Demo - Balanced",
  embeddingModel: "Embedding Demo - v2",
  topK: 5,
  chunkSize: 800,
  overlap: 120,
  retrievalThreshold: 0.72,
  refusalEnabled: true,
};
