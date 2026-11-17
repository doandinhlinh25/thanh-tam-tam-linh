# Chat Service

Chat & RAG Service với cơ chế thẩm định bằng chứng (evidence gate), kiểm định trích dẫn (citation validator) và từ chối trả lời an toàn khi không đủ bằng chứng.

## Cấu trúc thư mục

- `app/api/`: Routing, controllers, middlewares và xử lý lỗi HTTP.
- `app/schemas/`: DTOs/Pydantic schemas cho request và response.
- `app/core/`: Cấu hình, logging, exceptions, security, constants.
- `app/domain/`: Entities, Value Objects, Enums, Repositories interfaces theo DDD.
- `app/services/`: Application services điều phối nghiệp vụ.
- `app/repositories/`: Cài đặt MongoDB repositories và document mappings.
- `app/ai/`: RAG pipeline, context builder, evidence gate, citation validator, prompt templates, LLM adapters.
- `app/integrations/`: Tích hợp database session/unit of work và HTTP client tới Retrieval Service.
- `app/evaluation/`: Bộ công cụ đánh giá (faithfulness, citation accuracy, answer relevance) và datasets.
- `app/observability/`: Metrics, Tracing và Audit logging.
- `tests/`: Unit tests, integration tests, contract tests và evaluation tests.
- `scripts/`: Scripts chạy evaluation và seed dữ liệu mẫu.
- `scripts/mongodb_migrate.py`: Tạo collections và indexes idempotently.

## Cài đặt & Chạy ứng dụng

```bash
# Cài đặt dependencies
pip install -e ".[dev]"

# Tạo file .env
cp .env.example .env

# Tạo collections và indexes trong MongoDB
python -m scripts.mongodb_migrate

# Chạy server
uvicorn app.main:app --reload --port 8000
```

Chat Service uses its own MongoDB database (`tt_chat_db`). Local development requires a MongoDB replica set because conversation/message/citation and delete operations use multi-document transactions. Configure `MONGODB_URI` and `MONGODB_DATABASE` through environment variables; production credentials must come from deployment secrets. For repository integration tests on Windows with Docker Desktop, run `docker compose -f tests/integration/mongo-replica-set.compose.yaml up -d --wait`, then initialize the member with `docker compose -f tests/integration/mongo-replica-set.compose.yaml exec mongo mongosh --port 27018 --quiet --file /tmp/mongo-init.js`. Set `MONGODB_TEST_URI=mongodb://localhost:27018/?replicaSet=rs0` for pytest; the fixture verifies that the host connection sees a writable `rs0` primary.
