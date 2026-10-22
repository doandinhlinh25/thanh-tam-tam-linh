"""OpenAI provider implementation."""
from typing import Optional, Union
import httpx

from app.core.config import Settings, get_settings
from app.ai.llm.base import BaseLLMProvider, ProviderResult
from app.ai.llm.schemas import LLMRequest, LLMResponse
from app.schemas.llm import GenerateRequest, Usage
from app.services.errors import (
    ProviderAuthError,
    ProviderInvalidResponseError,
    ProviderRateLimitError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    LLMUpstreamBadGatewayError,
    LLMUnavailableError,
)


class OpenAIProvider(BaseLLMProvider):
    """Gọi endpoint `/chat/completions` của provider qua HTTP."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self._client = client

    def _resolve_model(self) -> str:
        """Xác định model được cấu hình với fallback hợp lệ."""
        configured = (
            getattr(self.settings, "LLM_MODEL", None)
            or getattr(self.settings, "llm_model", None)
            or getattr(self.settings, "OPENAI_MODEL", None)
            or "gpt-4o"
        )
        if isinstance(configured, str):
            val = configured.strip()
            if val:
                return val
        return "gpt-4o"

    def _resolve_api_key(self) -> str:
        """Xác định API key với fallback an toàn."""
        api_key = (
            getattr(self.settings, "LLM_API_KEY", None)
            or getattr(self.settings, "llm_api_key", None)
            or getattr(self.settings, "OPENAI_API_KEY", "")
            or ""
        )
        return api_key.strip() if isinstance(api_key, str) else str(api_key)

    async def generate(self, request: Union[GenerateRequest, LLMRequest]) -> Union[ProviderResult, LLMResponse]:
        """Gửi request tới upstream LLM và chuẩn hóa kết quả."""
        if isinstance(request, LLMRequest):
            payload: dict[str, object] = {
                "model": self._resolve_model(),
                "messages": [{"role": getattr(m, "role", "user"), "content": getattr(m, "content", "")} for m in request.messages],
                "max_tokens": request.max_tokens,
                "temperature": request.temperature,
            }
            if getattr(request, "output_format", "text") == "json_object":
                payload["response_format"] = {"type": "json_object"}
            result = await self._send_completion_request(payload)
            prompt_tokens = result.usage.input_tokens if result.usage and result.usage.input_tokens is not None else 0
            completion_tokens = result.usage.output_tokens if result.usage and result.usage.output_tokens is not None else 0
            total_tokens = result.usage.total_tokens if result.usage and result.usage.total_tokens is not None else (prompt_tokens + completion_tokens)
            return LLMResponse(
                content=result.text,
                model=result.model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                finish_reason=result.finish_reason,
            )
        return await self._generate_internal(request)

    async def _generate_internal(self, request: GenerateRequest) -> ProviderResult:
        """Gửi một request tới upstream và chuẩn hóa response."""
        payload: dict[str, object] = {
            "model": self._resolve_model(),
            "messages": [message.model_dump() for message in request.messages],
            "max_tokens": request.max_output_tokens,
            "temperature": request.temperature,
        }
        if request.output_format == "json_object":
            payload["response_format"] = {"type": "json_object"}
        return await self._send_completion_request(payload)

    async def _send_completion_request(self, payload: dict[str, object]) -> ProviderResult:
        """Gửi completion payload tới upstream LLM provider và xử lý kết quả."""
        raw_base_url = (
            getattr(self.settings, "LLM_BASE_URL", None)
            or getattr(self.settings, "llm_base_url", None)
            or "https://api.openai.com/v1"
        )
        base_url = str(raw_base_url).strip().rstrip("/")
        if base_url.endswith("/chat/completions"):
            url = base_url
        else:
            url = f"{base_url}/chat/completions"

        api_key = self._resolve_api_key()
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        timeout = float(
            getattr(self.settings, "LLM_TIMEOUT_SECONDS", None)
            or getattr(self.settings, "llm_timeout_seconds", 30.0)
            or 30.0
        )

        max_retries = max(
            0,
            int(
                getattr(self.settings, "LLM_MAX_RETRIES", None)
                or getattr(self.settings, "llm_max_retries", 0)
                or 0
            ),
        )

        attempts = 0
        response = None
        while True:
            attempts += 1
            try:
                if self._client is not None:
                    response = await self._client.post(url, json=payload, headers=headers)
                else:
                    async with httpx.AsyncClient(timeout=timeout) as client:
                        response = await client.post(url, json=payload, headers=headers)
            except httpx.TimeoutException as exc:
                if attempts <= max_retries:
                    continue
                raise ProviderTimeoutError from exc
            except httpx.HTTPError as exc:
                if attempts <= max_retries:
                    continue
                raise ProviderUnavailableError from exc

            if response.status_code == 429:
                if attempts <= max_retries:
                    continue
                raise ProviderRateLimitError
            if response.status_code in (401, 403):
                raise ProviderAuthError
            if response.status_code == 502:
                if attempts <= max_retries:
                    continue
                raise LLMUpstreamBadGatewayError
            if response.status_code in (408, 504):
                if attempts <= max_retries:
                    continue
                raise ProviderTimeoutError
            if response.status_code == 503:
                if attempts <= max_retries:
                    continue
                raise LLMUnavailableError
            if response.status_code >= 500:
                if attempts <= max_retries:
                    continue
                raise ProviderUnavailableError
            if response.status_code >= 400:
                raise ProviderUnavailableError
            break

        try:
            data = response.json()
            choice = data["choices"][0]
            message = choice["message"]
            text = message["content"]
            raw_model = data.get("model") or payload.get("model") or "gpt-4o"
            model = str(raw_model).strip() if raw_model else "gpt-4o"
            finish_reason = choice["finish_reason"]
            if not isinstance(text, str) or not text.strip() or not isinstance(finish_reason, str):
                raise ValueError("Response text or finish_reason invalid")
            raw_usage = data.get("usage")
            if raw_usage is not None:
                p_tokens = raw_usage.get("prompt_tokens")
                c_tokens = raw_usage.get("completion_tokens")
                t_tokens = raw_usage.get("total_tokens")
                if t_tokens is None and (p_tokens is not None or c_tokens is not None):
                    t_tokens = (p_tokens or 0) + (c_tokens or 0)
                usage = Usage(
                    input_tokens=p_tokens,
                    output_tokens=c_tokens,
                    total_tokens=t_tokens,
                )
            else:
                usage = None
            return ProviderResult(model=model, text=text, finish_reason=finish_reason, usage=usage)
        except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
            raise ProviderInvalidResponseError from exc

    async def aclose(self) -> None:
        """Close any injected AsyncClient if applicable."""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()


OpenAICompatibleProvider = OpenAIProvider
