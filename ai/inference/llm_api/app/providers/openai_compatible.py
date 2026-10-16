"""Adapter bất đồng bộ cho OpenAI-compatible Chat Completions."""

import httpx

from app.core.config import Settings
from app.providers.base import ProviderResult
from app.schemas.llm import GenerateRequest, Usage
from app.services.errors import ProviderAuthError, ProviderInvalidResponseError, ProviderRateLimitError, ProviderUnavailableError, ProviderTimeoutError


class OpenAICompatibleProvider:
    """Gọi endpoint `/chat/completions` của provider qua HTTP."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def generate(self, request: GenerateRequest) -> ProviderResult:
        """Gửi một request tới upstream và chuẩn hóa response."""
        payload: dict[str, object] = {
            "model": self.settings.llm_model,
            "messages": [message.model_dump() for message in request.messages],
            "max_tokens": request.max_output_tokens,
            "temperature": request.temperature,
        }
        if request.output_format == "json_object":
            payload["response_format"] = {"type": "json_object"}
        headers = {"Authorization": f"Bearer {self.settings.llm_api_key}", "Content-Type": "application/json"}
        url = self.settings.llm_base_url.rstrip("/") + "/chat/completions"
        try:
            async with httpx.AsyncClient(timeout=self.settings.llm_timeout_seconds) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.TimeoutException as exc:
            raise ProviderTimeoutError from exc
        except httpx.HTTPError as exc:
            raise ProviderUnavailableError from exc
        if response.status_code == 429:
            raise ProviderRateLimitError
        if response.status_code in (401, 403):
            raise ProviderAuthError
        if response.status_code >= 500:
            raise ProviderUnavailableError
        if response.status_code >= 400:
            raise ProviderUnavailableError
        try:
            data = response.json()
            choice = data["choices"][0]
            message = choice["message"]
            text = message["content"]
            model = data.get("model") or self.settings.llm_model
            finish_reason = choice["finish_reason"]
            if not isinstance(text, str) or not text.strip() or not isinstance(finish_reason, str):
                raise ValueError
            raw_usage = data.get("usage")
            usage = None if raw_usage is None else Usage(
                input_tokens=raw_usage.get("prompt_tokens"),
                output_tokens=raw_usage.get("completion_tokens"),
                total_tokens=raw_usage.get("total_tokens"),
            )
            return ProviderResult(model=model, text=text, finish_reason=finish_reason, usage=usage)
        except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
            raise ProviderInvalidResponseError from exc
