"""Pydantic schemas cho yêu cầu và phản hồi sinh nội dung."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Message(BaseModel):
    """Một message gửi tới model."""

    model_config = ConfigDict(extra="forbid")
    role: Literal["system", "user", "assistant"]
    content: str

    @field_validator("content")
    @classmethod
    def content_must_not_be_empty(cls, value: str) -> str:
        """Từ chối content rỗng hoặc chỉ chứa khoảng trắng."""
        value = value.strip()
        if not value:
            raise ValueError("content must not be empty")
        return value


class GenerateRequest(BaseModel):
    """Dữ liệu đầu vào của endpoint generate."""

    model_config = ConfigDict(extra="forbid")
    messages: list[Message] = Field(min_length=1, max_length=20)
    max_output_tokens: int = Field(gt=0)
    temperature: float = Field(ge=0, le=1)
    output_format: Literal["text", "json_object"] = "text"
    prompt_version: str | None = Field(default=None, max_length=100)


class Usage(BaseModel):
    """Thông tin token usage do provider trả về."""

    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None


class Output(BaseModel):
    """Nội dung và lý do kết thúc từ provider."""

    text: str
    finish_reason: str


class GenerateResponse(BaseModel):
    """Phản hồi thành công của endpoint generate."""

    request_id: str
    model: str
    output: Output
    usage: Usage | None
    latency_ms: int = Field(ge=0)


class ErrorBody(BaseModel):
    """Phản hồi lỗi ổn định của API."""

    request_id: str
    error: dict[str, str]
