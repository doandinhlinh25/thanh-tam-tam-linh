"""Application configuration loaded from environment variables."""
import math
from functools import lru_cache
from typing import Any
from urllib.parse import urlsplit

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    APP_NAME: str = "chat-service"
    APP_PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/chat_db"
    DATABASE_SYNC_URL: str = "postgresql://postgres:postgres@localhost:5432/chat_db"

    LLM_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = "sk-placeholder"
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"

    # LLM upstream inference configuration
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""
    LLM_API_ACCESS_TOKEN: str = ""
    LLM_TIMEOUT_SECONDS: float = 30.0
    LLM_MAX_INPUT_CHARS: int = 20_000
    LLM_MAX_OUTPUT_TOKENS: int = 2_048
    LLM_MAX_RETRIES: int = 0

    RETRIEVAL_SERVICE_URL: str = "http://localhost:8001"
    RETRIEVAL_TIMEOUT_SECONDS: float = 10.0

    TENANT_SERVICE_URL: str = ""
    CHAT_SERVICE_TOKEN: SecretStr = SecretStr("")
    TENANT_AUTHORIZATION_TIMEOUT_SECONDS: float = 5.0

    CORS_ORIGINS: list[str] = []
    AUTH_SECRET_KEY: str = "change-me-in-production"

    @model_validator(mode="before")
    @classmethod
    def normalize_keys(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return {k.upper(): v for k, v in data.items()}
        return data

    def __getattr__(self, name: str) -> Any:
        upper = name.upper()
        if upper in type(self).model_fields:
            return getattr(self, upper)
        raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")

    def __setattr__(self, name: str, value: Any) -> None:
        upper = name.upper()
        if upper in type(self).model_fields:
            super().__setattr__(upper, value)
        else:
            super().__setattr__(name, value)

    def is_ready(self) -> bool:
        """Cho biết cấu hình thiết yếu đã được cung cấp hay chưa."""
        return all(
            (
                bool(self.LLM_BASE_URL and self.LLM_BASE_URL.strip()),
                bool(self.LLM_MODEL and self.LLM_MODEL.strip()),
                bool(self.LLM_API_KEY and self.LLM_API_KEY.strip()),
                bool(self.LLM_API_ACCESS_TOKEN and self.LLM_API_ACCESS_TOKEN.strip()),
            )
        )

    def validate_chat_authorization(self) -> None:
        """Validate the mandatory Chat-to-Tenant security configuration at startup.

        :raises ValueError: If the service URL, shared credential, timeout, or
            browser Origin allowlist is absent or unsafe.
        """
        tenant_url = self.TENANT_SERVICE_URL.strip()
        parsed_url = urlsplit(tenant_url)
        try:
            _ = parsed_url.port
        except ValueError:
            raise ValueError("TENANT_SERVICE_URL must have a valid port") from None
        if (
            not tenant_url
            or parsed_url.scheme not in {"http", "https"}
            or not parsed_url.hostname
            or parsed_url.username
            or parsed_url.password
            or parsed_url.path not in {"", "/"}
            or parsed_url.query
            or parsed_url.fragment
        ):
            raise ValueError("TENANT_SERVICE_URL must be an absolute HTTP(S) service origin")

        token = self.CHAT_SERVICE_TOKEN.get_secret_value()
        if len(token) < 32 or "\r" in token or "\n" in token:
            raise ValueError("CHAT_SERVICE_TOKEN must contain at least 32 safe characters")

        if (
            not math.isfinite(self.TENANT_AUTHORIZATION_TIMEOUT_SECONDS)
            or self.TENANT_AUTHORIZATION_TIMEOUT_SECONDS <= 0
        ):
            raise ValueError("TENANT_AUTHORIZATION_TIMEOUT_SECONDS must be positive")

        if not self.CORS_ORIGINS or "*" in self.CORS_ORIGINS:
            raise ValueError("CORS_ORIGINS must explicitly list allowed browser Origins")
        for origin in self.CORS_ORIGINS:
            parsed_origin = urlsplit(origin)
            try:
                _ = parsed_origin.port
            except ValueError:
                raise ValueError("CORS_ORIGINS entries must have a valid port") from None
            if (
                origin != origin.strip()
                or parsed_origin.scheme not in {"http", "https"}
                or not parsed_origin.netloc
                or parsed_origin.path
                or parsed_origin.query
                or parsed_origin.fragment
                or parsed_origin.username
                or parsed_origin.password
                or origin == "null"
            ):
                raise ValueError("CORS_ORIGINS entries must be exact HTTP(S) Origins")


@lru_cache
def get_settings() -> Settings:
    """Trả về instance cấu hình dùng chung trong tiến trình."""
    return Settings()


settings = get_settings()
