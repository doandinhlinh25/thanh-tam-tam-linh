"""Global error handlers mapping exceptions to standard API failure responses."""
import uuid
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from app.core.exceptions import AppBaseException
from app.services.errors import LLMServiceError


def _request_id(request: Request) -> str:
    """Lấy request ID hợp lệ hoặc tạo mới cho lỗi validation/service."""
    req_state_id = getattr(getattr(request, "state", None), "request_id", None)
    if req_state_id:
        try:
            return str(uuid.UUID(req_state_id))
        except ValueError:
            pass
    val = request.headers.get("X-Request-ID", "")
    if val:
        try:
            return str(uuid.UUID(val))
        except ValueError:
            pass
    return str(uuid.uuid4())



def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppBaseException)
    async def app_exception_handler(request: Request, exc: AppBaseException):
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": exc.error_code,
                    "message": exc.message,
                    "details": exc.details,
                },
            },
        )

    @app.exception_handler(LLMServiceError)
    async def llm_service_error_handler(request: Request, exc: LLMServiceError) -> JSONResponse:
        req_id = getattr(exc, "request_id", None) or _request_id(request)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "request_id": req_id,
                "error": {
                    "code": exc.code,
                    "message": exc.message,
                },
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Trả lỗi validation an toàn, không phản hồi secret hoặc raw body."""
        if "/internal/llm" in request.url.path:
            return JSONResponse(
                status_code=422,
                content={
                    "request_id": _request_id(request),
                    "error": {"code": "LLM_INVALID_REQUEST", "message": "Request không hợp lệ"},
                },
            )
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Handle unexpected exceptions gracefully without leaking sensitive info."""
        if "/internal/llm" in request.url.path:
            return JSONResponse(
                status_code=500,
                content={
                    "request_id": _request_id(request),
                    "error": {"code": "LLM_INTERNAL_ERROR", "message": "Lỗi máy chủ nội bộ"},
                },
            )
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})
