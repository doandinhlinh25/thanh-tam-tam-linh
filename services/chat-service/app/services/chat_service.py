"""Chat service orchestrating RAG query workflow."""
from typing import Optional
from app.domain.value_objects.tenant_context import TenantContext
from app.ai.pipeline import AIPipeline, PipelineResult


class ChatService:
    """Coordinates context retrieval, evidence gating, LLM response, and citation validation."""

    def __init__(self, pipeline: Optional[AIPipeline] = None):
        self.pipeline = pipeline or AIPipeline()

    async def answer_question(self, context: TenantContext, question: str) -> PipelineResult:
        """Answer user question using RAG AI pipeline."""
        return await self.pipeline.run(user_query=question, tenant_context=context)

    async def close(self) -> None:
        """Close underlying pipeline resources."""
        if hasattr(self.pipeline, "close"):
            await self.pipeline.close()

    async def aclose(self) -> None:
        """Alias for close()."""
        await self.close()

    async def __aenter__(self) -> "ChatService":
        return self

    async def __aexit__(self, exc_type: object, exc_val: object, exc_tb: object) -> None:
        await self.close()
