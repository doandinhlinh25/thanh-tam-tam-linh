"""Application configuration loaded from environment variables."""
from functools import lru_cache
from typing import Any, List
from pydantic import model_validator
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

    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
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


@lru_cache
def get_settings() -> Settings:
    """Trả về instance cấu hình dùng chung trong tiến trình."""
    return Settings()


settings = get_settings()
