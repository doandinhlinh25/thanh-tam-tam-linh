"""Base abstract class and protocol for LLM providers."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Protocol, Union
from app.ai.llm.schemas import LLMRequest, LLMResponse
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


class BaseLLMProvider(ABC):
    @abstractmethod
    async def generate(self, request: Union[LLMRequest, GenerateRequest]) -> Union[LLMResponse, ProviderResult]:
        pass
