"""Conversation service handling thread lifecycle and message history."""
from app.domain.value_objects.tenant_context import TenantContext

class ConversationService:
    def __init__(self):
        pass

    async def get_conversation(self, context: TenantContext, conversation_id: str):
        raise NotImplementedError
