"""Schemas for LLM inputs and outputs."""
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.llm import (
    Message,
    GenerateRequest,
    Usage,
    Output,
    GenerateOutput,
    GenerateResponse,
    ErrorBody,
    ErrorResponse,
)


class LLMMessage(BaseModel):
    role: str
    content: str


class LLMRequest(BaseModel):
    messages: List[LLMMessage]
    temperature: float = 0.1
    max_tokens: int = 2048
    output_format: str = "text"


class LLMResponse(BaseModel):
    content: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    finish_reason: Optional[str] = "stop"


__all__ = [
    "LLMMessage",
    "LLMRequest",
    "LLMResponse",
    "Message",
    "GenerateRequest",
    "Usage",
    "Output",
    "GenerateOutput",
    "GenerateResponse",
    "ErrorBody",
    "ErrorResponse",
]

