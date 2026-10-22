"""Chat service orchestrating RAG query workflow."""
from app.domain.value_objects.tenant_context import TenantContext

class ChatService:
    """Coordinates context retrieval, evidence gating, LLM response, and citation validation."""
    def __init__(self):
        pass

    async def answer_question(self, context: TenantContext, question: str):
        raise NotImplementedError
