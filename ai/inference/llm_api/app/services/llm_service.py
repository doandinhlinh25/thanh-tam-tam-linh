"""Application service điều phối một yêu cầu sinh nội dung."""

import json

from app.core.config import Settings
from app.providers.base import LLMProvider, ProviderResult
from app.schemas.llm import GenerateRequest
from app.services.errors import InvalidJSONOutputError, RequestLimitError


class LLMService:
    """Kiểm tra giới hạn, gọi provider và xác thực output."""

    def __init__(self, provider: LLMProvider, settings: Settings) -> None:
        self.provider = provider
        self.settings = settings

    async def generate(self, request: GenerateRequest) -> ProviderResult:
        """Thực hiện generate mà không làm lộ dữ liệu nhạy cảm."""
        input_chars = sum(len(message.content) for message in request.messages)
        if input_chars > self.settings.llm_max_input_chars or request.max_output_tokens > self.settings.llm_max_output_tokens:
            raise RequestLimitError
        result = await self.provider.generate(request)
        if request.output_format == "json_object":
            try:
                value = json.loads(result.text)
            except json.JSONDecodeError as exc:
                raise InvalidJSONOutputError from exc
            if not isinstance(value, dict):
                raise InvalidJSONOutputError
            result = ProviderResult(result.model, json.dumps(value, ensure_ascii=False, separators=(",", ":")), result.finish_reason, result.usage)
        return result
