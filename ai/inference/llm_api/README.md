# LLM Inference API

Đây là ứng dụng LLM API độc lập dùng Python 3.11+, FastAPI và adapter HTTP bất đồng bộ tương thích OpenAI Chat Completions.

## Cài đặt và chạy

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

Điền các biến `LLM_MODEL`, `LLM_API_KEY` và `LLM_API_ACCESS_TOKEN` trong `.env`. Không commit `.env`.

## Kiểm tra

```powershell
python -m pytest -q
python -c "from app.main import app; print(app.title)"
```

`GET /health/live` luôn trả `{"status":"alive"}`. `GET /health/ready` chỉ kiểm tra cấu hình tại chỗ; thiếu cấu hình trả `503` và không gọi provider.

## Ví dụ gọi API

```powershell
curl.exe http://localhost:8000/internal/llm/generate `
  -H "Authorization: Bearer <LLM_API_ACCESS_TOKEN>" `
  -H "Content-Type: application/json" `
  -d '{"messages":[{"role":"user","content":"API là gì?"}],"max_output_tokens":64,"temperature":0.2,"output_format":"text","prompt_version":"demo-v1"}'
```

Swagger UI có tại `/docs`. Tests dùng fake provider và không gửi request có phí tới provider thật.
