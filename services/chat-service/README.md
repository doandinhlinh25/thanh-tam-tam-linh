# Chat Service

Chat & RAG Service với cơ chế thẩm định bằng chứng (evidence gate), kiểm định trích dẫn (citation validator) và từ chối trả lời an toàn khi không đủ bằng chứng.

## Cấu trúc thư mục

- `app/api/`: Routing, controllers, middlewares và xử lý lỗi HTTP.
- `app/schemas/`: DTOs/Pydantic schemas cho request và response.
- `app/core/`: Cấu hình, logging, exceptions, security, constants.
- `app/domain/`: Entities, Value Objects, Enums, Repositories interfaces theo DDD.
- `app/services/`: Application services điều phối nghiệp vụ.
- `app/repositories/`: Cài đặt repository (PostgreSQL / SQLAlchemy models).
- `app/ai/`: RAG pipeline, context builder, evidence gate, citation validator, prompt templates, LLM adapters.
- `app/integrations/`: Tích hợp database session/unit of work và HTTP client tới Retrieval Service.
- `app/evaluation/`: Bộ công cụ đánh giá (faithfulness, citation accuracy, answer relevance) và datasets.
- `app/observability/`: Metrics, Tracing và Audit logging.
- `tests/`: Unit tests, integration tests, contract tests và evaluation tests.
- `scripts/`: Scripts chạy evaluation và seed dữ liệu mẫu.
- `migrations/`: Alembic database migrations.

## Cài đặt & Chạy ứng dụng

```bash
# Cài đặt dependencies
pip install -e ".[dev]"

# Tạo file .env
cp .env.example .env

# Chạy migration
alembic upgrade head

# Chạy server
uvicorn app.main:app --reload --port 8000
```
