"""Schemas for LLM inputs and outputs."""

from pydantic import BaseModel

from app.schemas.llm import (
    ErrorBody,
    ErrorResponse,
    GenerateOutput,
    GenerateRequest,
    GenerateResponse,
    Message,
    Output,
    Usage,
)


class LLMMessage(BaseModel):
    role: str
    content: str


class LLMRequest(BaseModel):
    messages: list[LLMMessage]
    temperature: float = 0.1
    max_tokens: int = 2048
    output_format: str = "text"


class LLMResponse(BaseModel):
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    finish_reason: str | None = "stop"


__all__ = [
    "ErrorBody",
    "ErrorResponse",
    "GenerateOutput",
    "GenerateRequest",
    "GenerateResponse",
    "LLMMessage",
    "LLMRequest",
    "LLMResponse",
    "Message",
    "Output",
    "Usage",
]

