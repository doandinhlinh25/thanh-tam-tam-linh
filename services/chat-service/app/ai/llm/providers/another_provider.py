"""Alternative LLM provider implementation (e.g. Anthropic, Ollama, Self-hosted)."""
from app.ai.llm.base import BaseLLMProvider
from app.ai.llm.schemas import LLMRequest, LLMResponse

class AnotherProvider(BaseLLMProvider):
    async def generate(self, request: LLMRequest) -> LLMResponse:
        raise NotImplementedError
