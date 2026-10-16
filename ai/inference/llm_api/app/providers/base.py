"""Giao diện provider độc lập với giao thức HTTP cụ thể."""

from dataclasses import dataclass
from typing import Protocol

from app.schemas.llm import GenerateRequest, Usage


@dataclass(frozen=True)
class ProviderResult:
    """Kết quả chuẩn hóa từ một provider."""

    model: str
    text: str
    finish_reason: str
    usage: Usage | None


class LLMProvider(Protocol):
    """Protocol để provider thật và fake provider cùng được inject."""

    async def generate(self, request: GenerateRequest) -> ProviderResult:
        """Sinh nội dung từ danh sách messages."""
        ...
