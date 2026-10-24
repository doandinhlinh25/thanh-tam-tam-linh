"""Conversation repository interface."""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.entities.conversation import Conversation

class IConversationRepository(ABC):
    @abstractmethod
    async def get_by_id(self, conversation_id: str, tenant_id: str) -> Optional[Conversation]:
        pass

    @abstractmethod
    async def list_by_user(self, user_id: str, tenant_id: str) -> List[Conversation]:
        pass

    @abstractmethod
    async def save(self, conversation: Conversation) -> None:
        pass

    @abstractmethod
    async def delete(self, conversation_id: str, tenant_id: str) -> None:
        pass
