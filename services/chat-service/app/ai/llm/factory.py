"""Factory to instantiate configured LLM provider."""
from typing import Optional
from app.core.config import Settings, get_settings
from app.ai.llm.base import BaseLLMProvider
from app.ai.llm.providers.openai_provider import OpenAIProvider


class LLMFactory:
    @staticmethod
    def get_provider(settings: Optional[Settings] = None) -> BaseLLMProvider:
        cfg = settings or get_settings()
        provider_name = (
            getattr(cfg, "LLM_PROVIDER", None)
            or getattr(cfg, "llm_provider", "openai")
            or "openai"
        )
        normalized = str(provider_name).strip().lower()
        if normalized in ("openai", "openai_compatible", "openai-compatible"):
            return OpenAIProvider(cfg)
        raise ValueError(f"Unknown LLM provider: {provider_name}")

