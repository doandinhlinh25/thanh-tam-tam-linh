# Người 4 — RAG, Chat & Evaluation Lead

**Trạng thái:** Chưa có Chat Service, RAG orchestration hoặc evaluation runner.<br>
**Nguồn:** Sổ tay AI-01, mục 5.2–5.3, 8, 9.4, 10 và 14.<br>
**Phạm vi mã nguồn dự kiến:** `services/chat-service/`, contract Chat trong `contracts/openapi/`, prompt/evaluation assets thuộc service hoặc `ai/reports/` khi được tạo. RAG orchestration nằm trong Chat Service cho MVP; chỉ tách service riêng khi có contract và nhu cầu vận hành rõ ràng.

## Mục tiêu

Biến evidence được phép truy cập thành câu trả lời có citation kiểm chứng được, từ chối khi thiếu bằng chứng và báo cáo chất lượng A/B/C. Chat Service sở hữu conversation, message, citation và feedback theo tenant/user; không đọc trực tiếp database Document hay Tenant.

## Công việc theo thứ tự

1. **Tuần 1–2 — contract:** thống nhất với Người 3 retrieval/evidence, với Người 1 response `answered`, `insufficient_evidence`, `error` và feedback, với Người 2 session/tenant authorization, quota và error envelope. Dùng `ApiResponse` của `@saas/common` tại HTTP boundary.
2. **Tuần 2–3 — dữ liệu Chat:** tạo Chat Service từ template, DBML/migration riêng, conversation/message/citation/feedback; kiểm tra ownership của conversation và course trước khi đọc/ghi.
3. **Tuần 3–4 — orchestration:** gọi retrieval đã lọc quyền, reranker và LLM qua adapter có timeout/token-cost limit; cấu hình variant A/B/C và ghi request ID, model/prompt version, latency. Không gửi evidence ngoài quyền sang reranker/LLM.
4. **Tuần 4 — evidence và citation:** hiệu chỉnh evidence gate trên dev set; nếu thiếu evidence trả `insufficient_evidence` không gọi LLM không cần thiết. Parse output có cấu trúc, xác minh mọi citation ID thuộc tập evidence và lấy document/page metadata từ server.
5. **Tuần 4–5 — evaluation:** tạo bộ câu hỏi có/không evidence, rubric faithfulness/citation, evaluation runner và báo cáo Recall/MRR/nDCG từ Người 3 cùng citation precision, refusal accuracy, latency và error analysis end-to-end.

## Phụ thuộc và bàn giao cho nhóm

| Cần từ | Nội dung |
|---|---|
| Người 2 | Xác thực, quyền tenant/course, quota, service credential và hạ tầng |
| Người 3 | Retrieval/evidence contract, reranker A/B/C, document metadata và version mô hình |
| Người 1 | Cách hiển thị answer, citation, refusal, lỗi provider, history và feedback |

**Sản phẩm bàn giao:** Chat Service, OpenAPI, DBML/migration, prompt version, evaluation set/runner, metrics/report và demo cả ba trạng thái trả lời.

## Điều kiện nghiệm thu

- `answered` có citation hợp lệ, thuộc đúng tenant/course và khớp evidence snapshot; không có citation tự tạo bởi LLM.
- `insufficient_evidence` không có citation giả; timeout/429/lỗi provider trả lỗi kỹ thuật qua `ApiResponse`, không giả thiếu bằng chứng.
- Test prompt injection, IDOR conversation, citation ID sai, document vừa bị xóa, reranker down, LLM timeout và câu hỏi ngoài corpus.
- Báo cáo A/B/C dùng cùng test set, nêu cấu hình và giới hạn; build/typecheck/test cho service đạt.
