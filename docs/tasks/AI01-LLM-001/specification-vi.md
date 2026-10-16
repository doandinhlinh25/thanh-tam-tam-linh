# AI01-LLM-001 — Đặc tả LLM API độc lập bằng Python và FastAPI

**Phiên bản:** 0.4  
**Trạng thái:** BẢN NHÁP — chờ duyệt trước khi triển khai  
**Ngôn ngữ tài liệu:** Tiếng Việt (giữ nguyên tên kỹ thuật trong mã nguồn và hợp đồng HTTP)  
**Thư mục mã nguồn đề xuất:** `ai/inference/llm_api/`  
**Đường dẫn lưu tài liệu đề xuất:** `docs/tasks/AI01-LLM-001/specification-vi.md`

> **Giới hạn tài liệu:** Đây là đặc tả của **một ứng dụng LLM API độc lập**. Tài liệu chỉ mô tả cách xây, cấu hình, vận hành và kiểm thử API gọi mô hình ngôn ngữ. Không đưa ra quyết định kiến trúc hoặc yêu cầu tích hợp với ứng dụng, hệ thống hoặc API khác. Hiện chưa có mã nguồn hay kết quả kiểm thử được xác nhận trong tài liệu này.

## 1. Mục tiêu

Xây dựng một dịch vụ HTTP bằng **Python 3.11+** và **FastAPI** để nhận yêu cầu sinh văn bản, gửi yêu cầu đến một nhà cung cấp mô hình ngôn ngữ lớn (LLM) và trả lại kết quả dưới định dạng nhất quán.

Kết quả cần đạt:

- Khởi động được FastAPI và truy cập tài liệu tương tác tại `/docs`.
- Sinh nội dung qua một endpoint HTTP duy nhất, với dữ liệu vào/ra được kiểm tra chặt chẽ bằng Pydantic.
- Cấu hình model, khóa truy cập nhà cung cấp, timeout và giới hạn tài nguyên bằng biến môi trường.
- Có cơ chế bảo vệ endpoint sinh nội dung bằng bearer token của chính LLM API.
- Xử lý có phân loại các lỗi timeout, quá tải, xác thực nhà cung cấp, phản hồi sai định dạng.
- Có thể chạy toàn bộ kiểm thử tự động bằng nhà cung cấp giả lập, không cần API key thật.

## 2. Phạm vi chức năng

### 2.1. Chức năng phải có

1. **Khởi tạo FastAPI:** cấu hình ứng dụng, routing, lifecycle, logging an toàn.
2. **Kiểm tra tình trạng:** `/health/live` và `/health/ready`.
3. **Sinh nội dung:** `POST /internal/llm/generate`.
4. **Kiểm tra dữ liệu:** số lượng message, role hợp lệ, độ dài input, giới hạn token đầu ra, nhiệt độ sinh và định dạng mong muốn.
5. **Adapter nhà cung cấp:** giao diện `LLMProvider` và một adapter HTTP bất đồng bộ theo giao thức *OpenAI-compatible Chat Completions*.
6. **Xử lý lỗi:** mã lỗi ứng dụng ổn định, không trả về secret hoặc raw provider response nhạy cảm.
7. **Quan sát vận hành:** mã request, thời gian phản hồi, model và token usage khi nhà cung cấp trả về.
8. **Kiểm thử:** unit test, API test và kiểm thử lỗi với fake/mock provider.
9. **Tài liệu chạy ứng dụng:** README tiếng Việt, `.env.example` và mô tả HTTP/OpenAPI.

### 2.2. Không thuộc phạm vi tài liệu này

- Không xây giao diện web hoặc ứng dụng khách.
- Không triển khai cơ sở dữ liệu, lưu hội thoại, quản lý tài khoản hoặc lịch sử người dùng.
- Không xử lý PDF, embedding, tìm kiếm vector, reranking hoặc fine-tuning.
- Không xây dựng workflow nhiều bước hoặc các module ứng dụng khác xung quanh LLM API.
- Không yêu cầu chỉnh sửa bất kỳ mã nguồn hiện có nào ngoài thư mục LLM API và tài liệu OpenAPI tương ứng.

## 3. Công nghệ và thư viện

| Hạng mục | Lựa chọn đề xuất | Vai trò |
|---|---|---|
| Ngôn ngữ | Python 3.11+ | Mã nguồn LLM API |
| HTTP framework | FastAPI | Định tuyến và tự sinh OpenAPI |
| Kiểm tra dữ liệu/cấu hình | Pydantic v2, pydantic-settings | Request/response schema và biến môi trường |
| HTTP client | httpx.AsyncClient | Gọi nhà cung cấp LLM bất đồng bộ |
| ASGI server | Uvicorn | Chạy ứng dụng |
| Kiểm thử | pytest, httpx/ASGITransport | Test offline, test endpoint |
| Định dạng dependencies | `pyproject.toml` | Đóng gói Python độc lập |

Nhà cung cấp thực tế, model thực tế và mức chi phí **chưa được chọn**. Adapter OpenAI-compatible là lựa chọn kỹ thuật ban đầu nhằm kiểm thử một giao thức thống nhất; không khẳng định tất cả nhà cung cấp hỗ trợ toàn bộ tùy chọn như nhau.

## 4. Thiết kế HTTP API — bản nháp v0.1

### 4.1. `GET /health/live`

Kiểm tra tiến trình HTTP đang hoạt động. Không cần bearer token và **không gửi yêu cầu đến nhà cung cấp LLM**.

- Thành công: `200 OK`.
- Dữ liệu trả về đề xuất: `{"status":"alive"}`.

### 4.2. `GET /health/ready`

Kiểm tra ứng dụng đã được cấu hình đủ để xử lý yêu cầu sinh nội dung hay chưa. Chỉ kiểm tra cấu hình **tại chỗ**, không gửi thử request sinh nội dung có thể phát sinh chi phí.

- Đủ cấu hình: `200 OK`, ví dụ `{"status":"ready"}`.
- Thiếu cấu hình bắt buộc: `503 Service Unavailable`, ví dụ `{"status":"not_ready"}`.

Readiness theo cấu hình không có nghĩa là dịch vụ bên ngoài chắc chắn đang khả dụng.

### 4.3. `POST /internal/llm/generate`

Sinh một kết quả từ dãy message được gửi lên. Đường dẫn này được **giữ từ đặc tả trước để tránh thay đổi hợp đồng không cần thiết**; từ `internal` chỉ là một phần của URL, không có chức năng bảo mật tự động.

**HTTP header:**

```http
Authorization: Bearer <LLM_API_ACCESS_TOKEN>
Content-Type: application/json
X-Request-ID: <optional-request-id>
```

Ứng dụng phải so sánh bearer token an toàn. Nếu `X-Request-ID` bị thiếu hoặc không hợp lệ, ứng dụng sinh mã request mới; không tin giá trị header như chứng cứ xác thực.

**Request mẫu:**

```json
{
  "messages": [
    {"role": "system", "content": "Trả lời ngắn gọn và rõ ràng bằng tiếng Việt."},
    {"role": "user", "content": "Giải thích khái niệm API là gì."}
  ],
  "max_output_tokens": 256,
  "temperature": 0.2,
  "output_format": "text",
  "prompt_version": "demo-v1"
}
```

**Quy tắc xác thực dữ liệu (đề xuất):**

| Trường | Quy tắc |
|---|---|
| `messages` | Bắt buộc; từ 1 đến 20 phần tử |
| `messages[].role` | Chỉ nhận `system`, `user`, `assistant` |
| `messages[].content` | Chuỗi không rỗng sau khi loại khoảng trắng thừa |
| Tổng `content` | Không quá `LLM_MAX_INPUT_CHARS`, mặc định 20.000 ký tự |
| `max_output_tokens` | Số nguyên dương, tối đa `LLM_MAX_OUTPUT_TOKENS`, mặc định 2.048 |
| `temperature` | Số từ 0 đến 1 |
| `output_format` | `text` hoặc `json_object` |
| `prompt_version` | Tùy chọn, chuỗi nhãn ngắn; không dùng làm đầu vào thực thi tùy ý |
| `model` | Chỉ đọc từ cấu hình server; client không tự chọn model |

**Response thành công (`200 OK`):**

```json
{
  "request_id": "b2f128c3-b6a4-4c6e-bbfa-d44ec1d8c90a",
  "model": "configured-model",
  "output": {
    "text": "API là giao diện giúp các chương trình trao đổi dữ liệu và chức năng với nhau.",
    "finish_reason": "stop"
  },
  "usage": {
    "input_tokens": 26,
    "output_tokens": 18,
    "total_tokens": 44
  },
  "latency_ms": 312
}
```

Đây chỉ là dữ liệu minh họa, **không phải kết quả đã chạy**. Nếu nhà cung cấp không trả usage, ứng dụng trả `"usage": null`, không tự bịa token count.

Nếu `output_format=json_object`, ứng dụng cần xác nhận nội dung là JSON hợp lệ với giá trị gốc kiểu **object**; nội dung không hợp lệ phải trả lỗi `LLM_INVALID_RESPONSE`.

**Response lỗi mẫu:**

```json
{
  "request_id": "b2f128c3-b6a4-4c6e-bbfa-d44ec1d8c90a",
  "error": {
    "code": "LLM_UPSTREAM_TIMEOUT",
    "message": "Nhà cung cấp LLM đã hết thời gian phản hồi"
  }
}
```

### 4.4. Mã lỗi và HTTP status

| Điều kiện | HTTP status đề xuất | Mã lỗi hoặc cách xử lý |
|---|---:|---|
| Thiếu bearer token hoặc token sai | `401` | `LLM_UNAUTHORIZED`, không gọi provider |
| Dữ liệu request không hợp lệ | `422` | Chi tiết validation an toàn; không gọi provider |
| Timeout khi gọi nhà cung cấp | `504` | `LLM_UPSTREAM_TIMEOUT` |
| Nhà cung cấp giới hạn tốc độ (`429`) | `503` | `LLM_PROVIDER_RATE_LIMITED` |
| Nhà cung cấp trả `401/403` | `502` | `LLM_PROVIDER_AUTH_FAILED` |
| Nhà cung cấp lỗi `5xx` hoặc lỗi kết nối | `502` | `LLM_PROVIDER_UNAVAILABLE` |
| Thiếu nội dung trả về hoặc JSON output sai | `502` | `LLM_INVALID_RESPONSE` |
| Ứng dụng thiếu cấu hình | `503` tại `/health/ready` | Không làm lộ giá trị biến môi trường |

Mọi lỗi do nhà cung cấp gây ra phải được ánh xạ sang cấu trúc lỗi ổn định; không chuyển tiếp stack trace hoặc chi tiết bí mật từ upstream.

## 5. Thiết kế module

```text
ai/inference/llm_api/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   └── routes/
│   │       ├── health.py
│   │       └── llm.py
│   ├── core/
│   │   └── config.py
│   ├── schemas/
│   │   └── llm.py
│   ├── providers/
│   │   ├── base.py
│   │   └── openai_compatible.py
│   └── services/
│       └── llm_service.py
├── tests/
│   ├── test_health.py
│   ├── test_auth.py
│   ├── test_generate.py
│   └── test_provider_errors.py
├── pyproject.toml
├── .env.example
└── README.md
```

### Vai trò từng module

- `app/main.py`: khởi tạo FastAPI, đăng ký router và xử lý lỗi toàn cục.
- `app/api/routes/`: nhận HTTP request, xác thực token, kiểm tra dữ liệu và chuyển xử lý tới application service.
- `app/schemas/llm.py`: Pydantic DTO cho request, response và lỗi.
- `app/providers/base.py`: giao diện `LLMProvider` không chứa chi tiết HTTP bên ngoài.
- `app/providers/openai_compatible.py`: gọi upstream qua `httpx.AsyncClient`, parse/validate response.
- `app/services/llm_service.py`: điều phối một lệnh generate, giới hạn output, xử lý kết quả/trạng thái lỗi.
- `tests/`: kiểm thử nhanh bằng fake/mock; không yêu cầu kết nối Internet.

## 6. Cấu hình

**Ví dụ `.env.example` (không chứa secret thật):**

```dotenv
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=
LLM_API_KEY=
LLM_API_ACCESS_TOKEN=
LLM_TIMEOUT_SECONDS=30
LLM_MAX_INPUT_CHARS=20000
LLM_MAX_OUTPUT_TOKENS=2048
LLM_MAX_RETRIES=0
```

Quy tắc:

- `.env` chứa dữ liệu thật phải nằm ngoài Git theo `.gitignore`.
- Không ghi API key, bearer token, nội dung message thô hoặc toàn bộ upstream response vào log mặc định.
- Khi thiếu `LLM_MODEL`, `LLM_API_KEY` hoặc `LLM_API_ACCESS_TOKEN`, readiness trả 503; ứng dụng vẫn có thể khởi động để phục vụ liveness và báo lỗi cấu hình.
- Mặc định `LLM_MAX_RETRIES=0` vì retry sau timeout có thể gửi request trùng, phát sinh chi phí; nếu có retry sau này phải giới hạn và kiểm soát rõ ràng.
- Đường dẫn `/internal/` không ngăn người ngoài truy cập; môi trường triển khai phải giới hạn truy cập mạng hoặc áp dụng cơ chế bảo vệ tương ứng.

## 7. Yêu cầu chất lượng

### 7.1. Độ tin cậy

- Kết thúc request trong giới hạn timeout đã cấu hình.
- Khi provider trả dữ liệu sai định dạng, không trả `200` với dữ liệu tự suy đoán.
- Model và `finish_reason` được chuẩn hóa từ thông tin upstream; nếu thiếu dữ liệu bắt buộc thì báo lỗi có cấu trúc.
- Không cho phép caller tùy ý chỉ định URL của upstream để tránh tấn công SSRF.

### 7.2. Bảo mật

- Bearer token của chính LLM API được kiểm tra trước khi gọi provider.
- Secret không nằm trong mã nguồn, file tài liệu hoặc log.
- Thông báo lỗi không lộ chi tiết truy cập nhà cung cấp.
- HTTP client có timeout; bảo vệ trước request body quá lớn theo giới hạn cấu hình.

### 7.3. Khả năng kiểm thử

- Provider có thể thay bằng fake thông qua dependency injection.
- Tests chạy offline, không tính phí hoặc sử dụng API key thật.
- OpenAPI phải khớp với hành vi endpoint thực tế.

## 8. Bộ kiểm thử tối thiểu

| Mã | Tình huống | Kết quả mong đợi |
|---|---|---|
| T01 | Liveness | `200` và không gọi provider |
| T02 | Readiness khi thiếu cấu hình | `503`, không lộ secret |
| T03 | Request thiếu bearer token | `401`, provider không được gọi |
| T04 | Request hợp lệ với fake provider | `200`, trả đúng schema |
| T05 | Request thiếu message hoặc quá dài | `422`, không gọi provider |
| T06 | Generate dưới dạng `json_object` hợp lệ | `200`, giữ nguyên JSON text chuẩn hóa |
| T07 | Generate yêu cầu JSON nhưng upstream trả JSON sai | `502`, `LLM_INVALID_RESPONSE` |
| T08 | Upstream timeout | `504`, `LLM_UPSTREAM_TIMEOUT` |
| T09 | Upstream rate limit (`429`) | `503`, `LLM_PROVIDER_RATE_LIMITED` |
| T10 | Upstream `401/403` | `502`, không lộ token upstream |
| T11 | Upstream `5xx` hoặc lỗi mạng | `502`, `LLM_PROVIDER_UNAVAILABLE` |
| T12 | Upstream không cung cấp usage | `200`, `usage: null` |

## 9. Chạy và kiểm thử (sau khi có mã nguồn)

Tại thư mục `ai/inference/llm_api/`:

```bash
python -m pip install -e ".[dev]"
python -m pytest -q
uvicorn app.main:app --reload --port 8000
```

Sau khi khởi chạy, có thể truy cập `http://localhost:8000/docs` để xem giao diện tương tác và `http://localhost:8000/health/live` để kiểm tra liveness.

Các lệnh trên là **hướng dẫn dự kiến**, chưa có bằng chứng chúng đã chạy thành công. Hướng dẫn thử nhà cung cấp thật chỉ được thực hiện khi người phát triển tự cấu hình API key, hiểu chi phí và chủ động cho phép.

## 10. Điều kiện nghiệm thu

- [ ] Có FastAPI application độc lập và chạy được bằng Uvicorn.
- [ ] Có đầy đủ 3 HTTP endpoint theo mục 4.
- [ ] Có adapter nhà cung cấp tách biệt với HTTP routes.
- [ ] Cấu hình nằm trong environment và được kiểm tra hợp lệ.
- [ ] Endpoint generate được xác thực, validate dữ liệu và giới hạn tài nguyên.
- [ ] Trường hợp thành công và thất bại trả về schema, status code nhất quán.
- [ ] Không in hoặc đưa secret ra response.
- [ ] Có tài liệu README tiếng Việt và hợp đồng OpenAPI.
- [ ] Có tests offline cho các trường hợp tối thiểu tại mục 8.
- [ ] Ghi rõ lệnh test thực tế và trạng thái đạt/chưa đạt sau khi triển khai.

---

**Ghi chú kiểm soát phiên bản:** Đây là phiên bản thuần LLM API, thay cho đặc tả 0.3 có đề cập đến các thành phần ứng dụng khác. Tài liệu chưa phải báo cáo triển khai và không xác nhận bất kỳ endpoint nào đã tồn tại.


