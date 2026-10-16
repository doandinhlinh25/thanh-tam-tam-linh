"""Đọc và kiểm tra cấu hình từ biến môi trường."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Cấu hình máy chủ và nhà cung cấp LLM."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    llm_base_url: str = "https://api.openai.com/v1"
    llm_model: str = ""
    llm_api_key: str = ""
    llm_api_access_token: str = ""
    llm_timeout_seconds: float = 30.0
    llm_max_input_chars: int = 20_000
    llm_max_output_tokens: int = 2_048
    llm_max_retries: int = 0

    def is_ready(self) -> bool:
        """Cho biết cấu hình thiết yếu đã được cung cấp hay chưa."""
        return all((self.llm_base_url.strip(), self.llm_model.strip(), self.llm_api_key.strip(), self.llm_api_access_token.strip()))


@lru_cache
def get_settings() -> Settings:
    """Trả về instance cấu hình dùng chung trong tiến trình."""
    return Settings()
