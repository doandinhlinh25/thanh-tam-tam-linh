"""Route generate và dependency injection cho provider."""

import secrets
import time
import uuid

from fastapi import APIRouter, Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.providers.base import LLMProvider
from app.providers.openai_compatible import OpenAICompatibleProvider
from app.schemas.llm import ErrorBody, GenerateRequest, GenerateResponse, Output
from app.services.errors import LLMServiceError
from app.services.llm_service import LLMService

router = APIRouter(tags=["llm"])
bearer = HTTPBearer(auto_error=False)


def get_provider(settings: Settings = Depends(get_settings)) -> LLMProvider:
    """Tạo provider mặc định; test có thể override dependency này."""
    return OpenAICompatibleProvider(settings)


def request_id_from_header(value: str | None) -> str:
    """Chỉ dùng X-Request-ID nếu có dạng UUID hợp lệ."""
    if value:
        try:
            return str(uuid.UUID(value))
        except ValueError:
            pass
    return str(uuid.uuid4())


@router.post("/internal/llm/generate", response_model=GenerateResponse, responses={401: {"model": ErrorBody}, 422: {"model": ErrorBody}, 502: {"model": ErrorBody}, 503: {"model": ErrorBody}, 504: {"model": ErrorBody}}, summary="Generate text")
async def generate(
    payload: GenerateRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
    provider: LLMProvider = Depends(get_provider),
    x_request_id: str | None = Header(default=None),
) -> GenerateResponse:
    """Xác thực bearer token rồi gọi application service."""
    request_id = request_id_from_header(x_request_id)
    if credentials is None or credentials.scheme.lower() != "bearer" or not settings.llm_api_access_token or not secrets.compare_digest(credentials.credentials, settings.llm_api_access_token):
        raise LLMServiceErrorWithStatus("LLM_UNAUTHORIZED", 401, "Bearer token không hợp lệ", request_id)
    started = time.perf_counter()
    result = await LLMService(provider, settings).generate(payload)
    return GenerateResponse(request_id=request_id, model=result.model, output=Output(text=result.text, finish_reason=result.finish_reason), usage=result.usage, latency_ms=max(0, int((time.perf_counter() - started) * 1000)))


class LLMServiceErrorWithStatus(LLMServiceError):
    """Lỗi xác thực có request ID để handler dùng."""

    def __init__(self, code: str, status_code: int, message: str, request_id: str) -> None:
        self.code, self.status_code, self.message, self.request_id = code, status_code, message, request_id
