"""Điểm khởi động FastAPI cho LLM API độc lập."""

import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes.health import router as health_router
from app.api.routes.llm import router as llm_router
from app.services.errors import LLMServiceError

app = FastAPI(title="LLM Inference API", version="0.1.0")
app.include_router(health_router)
app.include_router(llm_router)


def _request_id(request: Request) -> str:
    """Lấy request ID hợp lệ hoặc tạo mới cho lỗi validation."""
    try:
        return str(uuid.UUID(request.headers.get("X-Request-ID", "")))
    except ValueError:
        return str(uuid.uuid4())


@app.exception_handler(LLMServiceError)
async def service_error_handler(request: Request, exc: LLMServiceError) -> JSONResponse:
    """Trả lỗi nghiệp vụ không chứa chi tiết upstream."""
    return JSONResponse(status_code=exc.status_code, content={"request_id": getattr(exc, "request_id", _request_id(request)), "error": {"code": exc.code, "message": exc.message}})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Trả lỗi validation an toàn, không phản hồi secret hoặc raw body."""
    return JSONResponse(status_code=422, content={"request_id": _request_id(request), "error": {"code": "LLM_INVALID_REQUEST", "message": "Request không hợp lệ"}})
